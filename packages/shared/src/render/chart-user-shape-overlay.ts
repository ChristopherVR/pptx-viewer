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
 * @module chart-user-shape-overlay
 */

import type { PptxChartData } from 'pptx-viewer-core';

import type { SvgLine, SvgPolygon, SvgPrimitive, SvgText } from './chart-view-model';

type UserShape = NonNullable<PptxChartData['userShapes']>[number];

/** EMU per CSS pixel at 96 DPI, mirroring core's `EMU_PER_PIXEL`. */
const EMU_PER_PIXEL = 9525;

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
	return { x, y, w: ext.cx / EMU_PER_PIXEL, h: ext.cy / EMU_PER_PIXEL };
}

/** Build the text primitives for a shape's paragraphs, stacked vertically. */
function textPrimitives(
	shape: UserShape,
	box: { x: number; y: number; w: number; h: number },
): SvgText[] {
	if (!shape.paragraphs || shape.paragraphs.length === 0) {
		return [];
	}
	const lineH = 12;
	const totalH = shape.paragraphs.length * lineH;
	let cursorY = box.y + Math.max((box.h - totalH) / 2, 0) + lineH * 0.75;
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
			fontSize: para.fontSize ?? 9,
			fill: para.color ?? '#1e293b',
			textAnchor: anchor,
			fontWeight: para.bold ? 'bold' : 'normal',
		});
		cursorY += lineH;
	}
	return out;
}

/** Project a single overlay shape into its SVG primitives. */
function projectShape(shape: UserShape, svgWidth: number, svgHeight: number): SvgPrimitive[] {
	const box = shapeBox(shape, svgWidth, svgHeight);
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
		} satisfies SvgPolygon);
	}

	primitives.push(...textPrimitives(shape, box));
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
	userShapes: ReadonlyArray<UserShape> | undefined,
	svgWidth: number,
	svgHeight: number,
): SvgPrimitive[] {
	if (!userShapes || userShapes.length === 0) {
		return [];
	}
	return userShapes.flatMap((shape) => projectShape(shape, svgWidth, svgHeight));
}
