/**
 * chart-pie-label-helpers.ts: small pure helpers `chart-pie-labels` shares
 * between its inside, outside and bestFit placement paths (label font,
 * manual-drag offset, leader-line geometry). Split out to keep that module
 * within the repo's file-size limit.
 *
 * @module chart-pie-label-helpers
 */
import type { PptxChartShapeProps } from 'pptx-viewer-core';

import { chartFontPx } from './chart-font';
import type { ChartAnchorPoint } from './chart-manual-layout';
import { applyLabelManualLayout, chartFrameToViewOffset } from './chart-manual-layout';
import type { PieLabelContent, PieLabelParams } from './chart-pie-labels';
import type { PieSliceGeometry, SvgLine, SvgText } from './chart-view-model';

/**
 * Resolve a label's SvgText font, starting from the given defaults (the
 * fixed inside/outside styling this module always used) and overriding with
 * a per-point txPr (C2-G1 data-label half) when the resolved label content
 * carries one. Returns every field required by `SvgText` so callers can
 * spread the result without a duplicate-key/optional-override conflict.
 */
export function labelTextStyle(
	content: PieLabelContent,
	defaults: Pick<SvgText, 'fontSize'> & Partial<Pick<SvgText, 'fontWeight'>>,
): Pick<SvgText, 'fontFamily' | 'fontSize' | 'fontWeight'> {
	const fontWeight =
		content.bold !== undefined ? (content.bold ? 'bold' : 'normal') : defaults.fontWeight;
	return {
		fontSize: content.fontSize !== undefined ? chartFontPx(content.fontSize) : defaults.fontSize,
		...(fontWeight !== undefined ? { fontWeight } : {}),
		...(content.fontFamily ? { fontFamily: content.fontFamily } : {}),
	};
}

/**
 * Shift an automatic label point by its manual-layout drag, when both a
 * `layoutFor` resolver and the chart `frame` were given. The pie engine lays
 * out on a letterboxed `size x size` SVG square distinct from the element's
 * own box, so the offset is applied in frame-space and converted back.
 */
export function applyManualDrag(
	point: ChartAnchorPoint,
	pointIndex: number,
	params: PieLabelParams,
): ChartAnchorPoint {
	const { layoutFor, frame, svgWidth, svgHeight } = params;
	if (!layoutFor || !frame || svgWidth === undefined || svgHeight === undefined) {
		return point;
	}
	const layout = layoutFor(pointIndex);
	const viewOffset = chartFrameToViewOffset(frame, { svgWidth, svgHeight });
	const framePoint = { x: point.x + viewOffset.x, y: point.y + viewOffset.y };
	const shifted = applyLabelManualLayout(layout, frame, framePoint);
	return { x: shifted.x - viewOffset.x, y: shifted.y - viewOffset.y };
}

/** A leader line from the slice's rim point to a label at `to`. */
export function leaderLine(
	slice: PieSliceGeometry,
	cx: number,
	cy: number,
	outerR: number,
	to: ChartAnchorPoint,
	style: PptxChartShapeProps | undefined,
): SvgLine {
	return {
		kind: 'line',
		x1: cx + outerR * Math.cos(slice.midAngle),
		y1: cy + outerR * Math.sin(slice.midAngle),
		x2: to.x,
		y2: to.y,
		stroke: style?.strokeColor ?? '#94a3b8',
		strokeWidth: 0.75,
	};
}
