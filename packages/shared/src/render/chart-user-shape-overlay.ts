/**
 * Chart drawing-overlay projector (`c:userShapes`).
 *
 * Projects the parsed {@link PptxChartUserShape} model (resolved by core from
 * the chart's separate `ppt/drawings/drawingN.xml` part) into `SvgPrimitive`
 * descriptors positioned on top of the chart plot. Anchor geometry is
 * chart-relative: `relSizeAnchor` corners are fractions of the chart area,
 * `absSizeAnchor` extents are EMU converted to pixels. Rendered last so the
 * overlay sits above the data marks.
 *
 * A `grpSp` entry (grouped annotation shapes with their own nested
 * transform) is expanded into positioned leaves via core's
 * `flattenChartUserShapes` before projecting, so this module never has to
 * know about groups itself.
 *
 * @module chart-user-shape-overlay
 */

import type { PptxChartData } from 'pptx-viewer-core';
import { flattenChartUserShapes } from 'pptx-viewer-core';

import { DEFAULT_CHART_TEXT_PX, chartFontPx } from './chart-font';
import type { SvgLine, SvgPolygon, SvgPrimitive, SvgText } from './chart-view-model';

/** The raw, un-flattened overlay model as parsed/edited (may contain `grpSp` entries). */
type RawUserShape = NonNullable<PptxChartData['userShapes']>[number];

/** A leaf overlay shape (never `grpSp`), after `flattenChartUserShapes` applies any group transform. */
type UserShape = ReturnType<typeof flattenChartUserShapes>[number];

/** EMU per CSS pixel at 96 DPI, mirroring core's `EMU_PER_PIXEL`. */
const EMU_PER_PIXEL = 9525;

/**
 * Build an SVG `transform` for a leaf's own composed rotation/flip (already
 * resolved by core's `flattenChartUserShapes`: a group's rotation composed
 * onto each contained leaf, added; flip, XORed), about the leaf's OWN box
 * centre. Mirrors {@link https://ecma-international.org/ ECMA-376}'s "flip,
 * then rotate, both about own centre" order (see
 * `element-style-transform.ts`'s `getElementTransform` doc for the same
 * convention applied as CSS elsewhere in this codebase): the flip
 * (`translate` + `scale` + `translate` back) is placed AFTER `rotate` in the
 * string so it applies FIRST (SVG, like CSS, applies a transform list
 * right-to-left to a point). `undefined` when neither rotation nor flip is
 * set, so an ordinary unrotated shape's markup is unchanged.
 */
function overlayTransform(
	rotation: number | undefined,
	flipH: boolean | undefined,
	flipV: boolean | undefined,
	box: { x: number; y: number; w: number; h: number },
): string | undefined {
	if (!rotation && !flipH && !flipV) {
		return undefined;
	}
	const cx = box.x + box.w / 2;
	const cy = box.y + box.h / 2;
	const parts: string[] = [];
	if (rotation) {
		parts.push(`rotate(${rotation} ${cx} ${cy})`);
	}
	if (flipH || flipV) {
		const sx = flipH ? -1 : 1;
		const sy = flipV ? -1 : 1;
		parts.push(`translate(${cx} ${cy}) scale(${sx} ${sy}) translate(${-cx} ${-cy})`);
	}
	return parts.join(' ');
}

/** Resolve the pixel bounding box of an anchored overlay shape. */
function shapeBox(
	shape: UserShape,
	svgWidth: number,
	svgHeight: number,
): { x: number; y: number; w: number; h: number } {
	const x = shape.from.x * svgWidth;
	const y = shape.from.y * svgHeight;
	if (shape.anchor === 'rel' && shape.to) {
		return {
			x,
			y,
			w: Math.max((shape.to.x - shape.from.x) * svgWidth, 0),
			h: Math.max((shape.to.y - shape.from.y) * svgHeight, 0),
		};
	}
	const ext = shape.ext ?? { cx: 0, cy: 0 };
	// `buildChartUserShapeOverlay` always passes a `chartBox` to
	// `flattenChartUserShapes`, so a group-nested leaf's offset is already
	// folded into `from` and this is normally undefined; it is only set as a
	// fallback for some other, chartBox-less caller of `flattenChartUserShapes`
	// (see `absGroupOffsetEmu`'s doc), in which case it is an extra EMU
	// position delta applied here in the same absolute-EMU-to-pixel unit
	// `ext` already uses, not as a further fraction of `from`.
	const offset = shape.absGroupOffsetEmu;
	return {
		x: x + (offset ? offset.x / EMU_PER_PIXEL : 0),
		y: y + (offset ? offset.y / EMU_PER_PIXEL : 0),
		w: ext.cx / EMU_PER_PIXEL,
		h: ext.cy / EMU_PER_PIXEL,
	};
}

/**
 * Build the text primitives for a shape's paragraphs, stacked vertically.
 * `rotation` (the shape's own composed spin, degrees) is applied to each
 * line about the SHAPE's own box centre so the text rotates as one rigid
 * unit with its box; flip is deliberately NOT applied to text (mirroring it
 * would render backwards), matching how an ordinary rotated/flipped slide
 * shape keeps its text upright via `element-style-transform.ts`'s
 * `getTextCompensationTransform`.
 */
function textPrimitives(
	shape: UserShape,
	box: { x: number; y: number; w: number; h: number },
	rotation: number | undefined,
): SvgText[] {
	if (!shape.paragraphs || shape.paragraphs.length === 0) {
		return [];
	}
	// para.fontSize is parsed in POINTS (core's chart-user-shapes-parser); it
	// crosses the pt -> px boundary here (see chart-font.ts).
	const fontPxOf = (para: NonNullable<UserShape['paragraphs']>[number]): number =>
		para.fontSize !== undefined ? chartFontPx(para.fontSize) : DEFAULT_CHART_TEXT_PX;
	const lineH = Math.max(12, ...shape.paragraphs.map((para) => fontPxOf(para) * 1.2));
	const totalH = shape.paragraphs.length * lineH;
	let cursorY = box.y + Math.max((box.h - totalH) / 2, 0) + lineH * 0.75;
	const cx = box.x + box.w / 2;
	const cy = box.y + box.h / 2;
	const out: SvgText[] = [];
	for (const para of shape.paragraphs) {
		if (para.text.length === 0) {
			cursorY += lineH;
			continue;
		}
		const align = para.align ?? 'ctr';
		const anchor: SvgText['textAnchor'] =
			align === 'l' ? 'start' : align === 'r' ? 'end' : 'middle';
		const tx = align === 'l' ? box.x + 2 : align === 'r' ? box.x + box.w - 2 : box.x + box.w / 2;
		out.push({
			kind: 'text',
			x: tx,
			y: cursorY,
			text: para.text,
			fontSize: fontPxOf(para),
			fill: para.color ?? '#1e293b',
			textAnchor: anchor,
			fontWeight: para.bold ? 'bold' : 'normal',
			...(rotation ? { transform: `rotate(${rotation} ${cx} ${cy})` } : {}),
		});
		cursorY += lineH;
	}
	return out;
}

/** Project a single overlay shape into its SVG primitives. */
function projectShape(shape: UserShape, svgWidth: number, svgHeight: number): SvgPrimitive[] {
	const box = shapeBox(shape, svgWidth, svgHeight);
	const transform = overlayTransform(shape.rotation, shape.flipH, shape.flipV, box);
	const primitives: SvgPrimitive[] = [];

	if (shape.kind === 'cxnSp') {
		// A connector spans the anchor diagonal.
		primitives.push({
			kind: 'line',
			x1: box.x,
			y1: box.y,
			x2: box.x + box.w,
			y2: box.y + box.h,
			stroke: shape.stroke ?? '#000000',
			strokeWidth: shape.strokeWidth ?? 1,
			...(transform ? { transform } : {}),
		} satisfies SvgLine);
		return primitives;
	}

	// sp / pic: draw the shape box (a polygon carries both fill and stroke)
	// when it has a fill or a stroke. `SvgRect` has no stroke, so a polygon is
	// used to preserve the shape outline.
	if ((shape.fill || shape.stroke) && box.w > 0 && box.h > 0) {
		primitives.push({
			kind: 'polygon',
			points: `${box.x},${box.y} ${box.x + box.w},${box.y} ${box.x + box.w},${box.y + box.h} ${box.x},${box.y + box.h}`,
			fill: shape.fill ?? 'none',
			stroke: shape.stroke ?? 'none',
			strokeWidth: shape.strokeWidth ?? (shape.stroke ? 1 : 0),
			...(transform ? { transform } : {}),
		} satisfies SvgPolygon);
	}

	primitives.push(...textPrimitives(shape, box, shape.rotation));
	return primitives;
}

/**
 * Build overlay primitives for all of a chart's user shapes.
 *
 * @param userShapes - Parsed overlay shapes from `chartData.userShapes`.
 * @param svgWidth - View-model SVG width (chart area width in px).
 * @param svgHeight - View-model SVG height (chart area height in px).
 * @returns Overlay primitives, or an empty array when there are none.
 */
export function buildChartUserShapeOverlay(
	userShapes: ReadonlyArray<RawUserShape> | undefined,
	svgWidth: number,
	svgHeight: number,
): SvgPrimitive[] {
	if (!userShapes || userShapes.length === 0) {
		return [];
	}
	// The chart's own rendered box, in EMU (matching the unit `ext` already
	// uses): lets core resolve a top-level `relSizeAnchor` group's real
	// (possibly non-square) rotation aspect and fold a grouped `absSizeAnchor`
	// leaf's offset straight into `from`, instead of approximating both (see
	// `ChartUserShapesChartBox`'s doc in `chart-user-shapes-parser.ts`).
	const leaves = flattenChartUserShapes(userShapes, {
		width: svgWidth * EMU_PER_PIXEL,
		height: svgHeight * EMU_PER_PIXEL,
	});
	return leaves.flatMap((shape) => projectShape(shape, svgWidth, svgHeight));
}
