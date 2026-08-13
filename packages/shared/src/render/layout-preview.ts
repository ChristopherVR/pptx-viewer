/**
 * layout-preview.ts: geometry for the New Slide / Layout gallery thumbnails.
 *
 * A thumbnail draws the layout's real artwork at slide scale inside a small
 * box, which every binding does the same way: size an inner surface to the
 * slide's own pixel dimensions, scale it down with a transform, and outline
 * the placeholder frames on top. Only the last step is subtle, so it lives
 * here rather than five times over.
 *
 * The functions are pure and framework-neutral: they return numbers and a
 * descriptor, and the binding maps that onto its own style object.
 *
 * @module render/layout-preview
 */

/** A layout as far as a thumbnail is concerned. */
export interface LayoutPreviewSource {
	/** Slide width in CSS pixels. */
	width?: number;
	/** Slide height in CSS pixels. */
	height?: number;
	backgroundColor?: string;
	placeholders?: readonly LayoutPreviewPlaceholder[];
}

/** A placeholder slot, as reported by the core layout preview. */
export interface LayoutPreviewPlaceholder {
	type: string;
	idx?: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
}

/** One placeholder outline, already positioned in unscaled slide space. */
export interface LayoutPreviewFrame {
	/** Stable key for list rendering. */
	key: string;
	type: string;
	left: number;
	top: number;
	width: number;
	height: number;
}

/** Everything a binding needs to render one thumbnail. */
export interface LayoutPreviewGeometry {
	/** Outer box, in CSS pixels. */
	boxWidth: number;
	boxHeight: number;
	/** Inner surface size, in unscaled slide pixels. */
	surfaceWidth: number;
	surfaceHeight: number;
	/** Factor to apply as `transform: scale(...)` on the inner surface. */
	scale: number;
	backgroundColor: string;
	/**
	 * Border width for placeholder outlines, pre-divided by {@link scale}.
	 *
	 * The outlines live inside the scaled surface, so a plain 1.5px border
	 * would be multiplied down to a hairline that vanishes at thumbnail size.
	 * Dividing here keeps the drawn width constant on screen whatever the
	 * slide dimensions are.
	 */
	frameBorderWidth: number;
	frames: LayoutPreviewFrame[];
}

/** Slide pixel size assumed when a layout reports none (16:9 at 96dpi). */
const FALLBACK_SLIDE_WIDTH = 960;
const FALLBACK_SLIDE_HEIGHT = 540;

/** On-screen thickness the placeholder outlines should keep after scaling. */
const FRAME_BORDER_PX = 1.5;

/** Painted when neither the layout nor its master resolves a background. */
const FALLBACK_BACKGROUND = '#ffffff';

/**
 * Compute the geometry for one layout thumbnail.
 *
 * @param layout - The layout preview from `getLayoutPreview`, or any object
 *   carrying the same dimensions and placeholder frames.
 * @param boxWidth - Thumbnail width in CSS pixels.
 * @param boxHeight - Thumbnail height in CSS pixels.
 * @returns A descriptor the binding maps onto its own styles.
 *
 * @example
 * ```ts
 * const geometry = buildLayoutPreviewGeometry({ width: 960, height: 540 }, 128, 72);
 * // => geometry.scale === 0.1333...
 * ```
 */
export function buildLayoutPreviewGeometry(
	layout: LayoutPreviewSource | undefined,
	boxWidth: number,
	boxHeight: number,
): LayoutPreviewGeometry {
	const surfaceWidth = positive(layout?.width, FALLBACK_SLIDE_WIDTH);
	const surfaceHeight = positive(layout?.height, FALLBACK_SLIDE_HEIGHT);
	// Fit rather than fill, so a 4:3 layout is not cropped inside a 16:9 box.
	const scale = Math.min(boxWidth / surfaceWidth, boxHeight / surfaceHeight);

	return {
		boxWidth,
		boxHeight,
		surfaceWidth,
		surfaceHeight,
		scale,
		backgroundColor: layout?.backgroundColor || FALLBACK_BACKGROUND,
		frameBorderWidth: scale > 0 ? FRAME_BORDER_PX / scale : FRAME_BORDER_PX,
		frames: buildLayoutPreviewFrames(layout?.placeholders),
	};
}

/**
 * Turn placeholder slots into drawable outlines.
 *
 * Slots without a full frame are skipped: a placeholder that inherits its
 * position from the master reports no geometry at all, and defaulting the
 * missing values to zero would stack empty boxes in the top-left corner.
 */
export function buildLayoutPreviewFrames(
	placeholders: readonly LayoutPreviewPlaceholder[] | undefined,
): LayoutPreviewFrame[] {
	const frames: LayoutPreviewFrame[] = [];
	placeholders?.forEach((placeholder, index) => {
		const { x, y, width, height } = placeholder;
		if (
			!isFiniteNumber(x) ||
			!isFiniteNumber(y) ||
			!isFiniteNumber(width) ||
			!isFiniteNumber(height) ||
			width <= 0 ||
			height <= 0
		) {
			return;
		}
		frames.push({
			key: `${placeholder.type}-${placeholder.idx ?? index}`,
			type: placeholder.type,
			left: x,
			top: y,
			width,
			height,
		});
	});
	return frames;
}

function positive(value: number | undefined, fallback: number): number {
	return isFiniteNumber(value) && value > 0 ? value : fallback;
}

function isFiniteNumber(value: number | undefined): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}
