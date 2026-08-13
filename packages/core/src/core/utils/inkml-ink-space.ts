/**
 * The bridge between an InkML part's own coordinate system and the box the
 * `p:contentPart` occupies on the slide.
 *
 * PowerPoint stores ink in device units that have nothing to do with the slide
 * (its `traceFormat` channels are typically `units="cm"` with a `resolution`
 * channelProperty), and places the strokes with `p14:xfrm`. Measured against
 * PowerPoint's own render of `e2e/fixtures/ink-contentpart.pptx`, exported at
 * 120 px/in: a stroke whose raw X spans 100..1780 and Y spans 60..340 lands
 * exactly on the `p14:xfrm` box, filling it in BOTH axes independently. So the
 * mapping is a non-uniform stretch of the union bounding box of all traces onto
 * the element box, not a fit that preserves aspect. Re-saving the deck from
 * PowerPoint leaves `p14:xfrm` untouched however different the trace geometry
 * is, which confirms the xfrm is authoritative and the traces are normalised
 * into it.
 *
 * Brush widths are the exception: they are absolute physical measurements and
 * are NOT scaled by that stretch (the 0.05 cm stroke renders ~2.4 px at 120
 * px/in whatever the box), so they convert straight to CSS pixels.
 *
 * @module core/utils/inkml-ink-space
 */

/** CSS pixels per inch, matching `EMU_PER_PIXEL` (914400 / 9525). */
const PX_PER_INCH = 96;

const PX_PER_UNIT: Readonly<Record<string, number>> = {
	in: PX_PER_INCH,
	cm: PX_PER_INCH / 2.54,
	mm: PX_PER_INCH / 25.4,
	pt: PX_PER_INCH / 72,
	pc: PX_PER_INCH / 6,
	// 1/100 mm, the unit PowerPoint's ink stack uses internally.
	himetric: PX_PER_INCH / 2540,
	px: 1,
	// Device units carry no physical meaning; treat them as pixels.
	dev: 1,
};

/**
 * Convert an InkML measurement to CSS pixels. An unknown or absent unit is
 * treated as pixels, which is what the library's own authored ink emits.
 */
export function inkLengthToPx(value: number, units: string | undefined): number {
	if (!Number.isFinite(value)) {
		return Number.NaN;
	}
	const key = String(units ?? '')
		.trim()
		.toLowerCase();
	const scale = PX_PER_UNIT[key];
	return scale === undefined ? value : value * scale;
}

/** Axis-aligned bounds of a point cloud, or `undefined` when there are none. */
export interface InkBounds {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

/** Union bounds over several decoded traces, in the ink part's own units. */
export function inkBounds(
	traces: readonly (readonly (readonly number[])[])[],
): InkBounds | undefined {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const points of traces) {
		for (const point of points) {
			const [x, y] = point;
			if (!Number.isFinite(x) || !Number.isFinite(y)) {
				continue;
			}
			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
		}
	}
	return Number.isFinite(minX) && Number.isFinite(minY) ? { minX, minY, maxX, maxY } : undefined;
}

/** The target box a content part's strokes are normalised into, in CSS px. */
export interface InkTargetBox {
	width: number;
	height: number;
}

/**
 * Build the point mapper for one ink part. A degenerate axis (every point on
 * the same line) is centred rather than divided by zero.
 */
export function inkPointMapper(
	bounds: InkBounds,
	box: InkTargetBox,
): (x: number, y: number) => [number, number] {
	const spanX = bounds.maxX - bounds.minX;
	const spanY = bounds.maxY - bounds.minY;
	const width = Math.max(box.width, 1);
	const height = Math.max(box.height, 1);
	return (x, y) => [
		spanX > 0 ? ((x - bounds.minX) / spanX) * width : width / 2,
		spanY > 0 ? ((y - bounds.minY) / spanY) * height : height / 2,
	];
}
