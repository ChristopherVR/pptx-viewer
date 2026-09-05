/**
 * chart-data-label-anchor.ts: `c:dLblPos` -> pixel anchor for bar / column /
 * line / area / scatter data labels, plus the per-point manual-drag offset
 * (`c:dLbl/c:layout`) applied on top of it.
 *
 * `c:dLblPos` is parsed and preserved end-to-end (`chart-data-label-parser.ts`,
 * `chart-data-labels-serializer.ts`) but every cartesian builder used a fixed
 * "outside end" offset regardless of its value: `ctr` (centred in a bar),
 * `inBase` / `inEnd` (inside the bar, near the base / value end) and the
 * line/scatter `t`/`b`/`l`/`r` positions were all silently ignored. Only pie
 * (`chart-pie-labels.ts`) ever consulted `position`.
 *
 * @module chart-data-label-anchor
 */
import type {
	PptxChartData,
	PptxChartDataLabel,
	PptxChartDataLabelPosition,
	PptxChartSeries,
} from 'pptx-viewer-core';

import { applyLabelManualLayout } from './chart-manual-layout';
import type { ChartAnchorPoint, ChartFrameSize } from './chart-manual-layout';

/** A bar/column rectangle in the chart's pixel space. */
export interface LabelAnchorRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** A resolved label anchor: where to draw it, and how to align text on it. */
export interface LabelAnchor {
	x: number;
	y: number;
	textAnchor: 'start' | 'middle' | 'end';
	dominantBaseline?: 'central';
}

/** This point's `c:dLbl` override, when the series declares one. */
export function findPointLabel(
	series: PptxChartSeries,
	pointIndex: number,
): PptxChartDataLabel | undefined {
	return series.dataLabels?.find((label) => label.idx === pointIndex);
}

/**
 * Cascade a data label's `c:dLblPos`: the per-point `c:dLbl` wins, then the
 * series-level `c:ser/c:dLbls`, then the chart-type-level `c:*Chart/c:dLbls`.
 * Mirrors the content-flag cascade in `chart-data-label-text.ts`'s
 * `resolveDataLabelContent`.
 */
export function resolveLabelPosition(
	chartData: PptxChartData,
	series: PptxChartSeries,
	pointIndex: number,
): PptxChartDataLabelPosition | undefined {
	return (
		findPointLabel(series, pointIndex)?.position ??
		series.dataLabelOptions?.position ??
		chartData.style?.dataLabels?.position
	);
}

/**
 * Anchor a bar/column data label from its `c:dLblPos`.
 *
 * `rect` is the bar's own rectangle; `value` decides which end is the "value
 * end" for `inEnd`/`outEnd` on a signed axis (a negative bar's value end is
 * its bottom, not its top). Positions outside `CT_DLblPos`'s bar/column set
 * (`t`/`b`/`l`/`r`) fall through to the historical `outEnd`-style default, same
 * as an absent `position`, so an untouched chart renders byte-identically.
 */
export function resolveBarLabelAnchor(
	position: PptxChartDataLabelPosition | undefined,
	rect: LabelAnchorRect,
	value: number,
	orientation: 'vertical' | 'horizontal',
): LabelAnchor {
	const positive = value >= 0;
	if (orientation === 'vertical') {
		const midX = rect.x + rect.width / 2;
		switch (position) {
			case 'ctr':
				return {
					x: midX,
					y: rect.y + rect.height / 2,
					textAnchor: 'middle',
					dominantBaseline: 'central',
				};
			case 'inBase':
				return {
					x: midX,
					y: positive ? rect.y + rect.height - 4 : rect.y + 10,
					textAnchor: 'middle',
				};
			case 'inEnd':
				return {
					x: midX,
					y: positive ? rect.y + 10 : rect.y + rect.height - 4,
					textAnchor: 'middle',
				};
			default:
				// outEnd / bestFit / absent: beyond the value end (above a positive
				// bar's top, below a negative bar's bottom).
				return {
					x: midX,
					y: positive ? rect.y - 4 : rect.y + rect.height + 10,
					textAnchor: 'middle',
				};
		}
	}
	// Horizontal (transposed) bars: the value end is the right edge for a
	// positive value, the left edge for a negative one.
	const midY = rect.y + rect.height / 2;
	switch (position) {
		case 'ctr':
			return {
				x: rect.x + rect.width / 2,
				y: midY,
				textAnchor: 'middle',
				dominantBaseline: 'central',
			};
		case 'inBase':
			return {
				x: positive ? rect.x + 4 : rect.x + rect.width - 4,
				y: midY,
				textAnchor: positive ? 'start' : 'end',
				dominantBaseline: 'central',
			};
		case 'inEnd':
			return {
				x: positive ? rect.x + rect.width - 4 : rect.x + 4,
				y: midY,
				textAnchor: positive ? 'end' : 'start',
				dominantBaseline: 'central',
			};
		default:
			return {
				x: positive ? rect.x + rect.width + 4 : rect.x - 4,
				y: midY,
				textAnchor: positive ? 'start' : 'end',
				dominantBaseline: 'central',
			};
	}
}

/**
 * Anchor a line/area/scatter/bubble marker's data label from its `c:dLblPos`
 * (`t`/`b`/`l`/`r`/`ctr`; the bar-only `inBase`/`inEnd`/`outEnd` values fall
 * through to the historical "above the marker" default, matching PowerPoint's
 * own Format Data Labels list for these chart kinds).
 */
export function resolveMarkerLabelAnchor(
	position: PptxChartDataLabelPosition | undefined,
	point: ChartAnchorPoint,
	offset = 7,
): LabelAnchor {
	switch (position) {
		case 'ctr':
			return { x: point.x, y: point.y, textAnchor: 'middle', dominantBaseline: 'central' };
		case 'b':
			return { x: point.x, y: point.y + offset + 4, textAnchor: 'middle' };
		case 'l':
			return {
				x: point.x - offset - 3,
				y: point.y,
				textAnchor: 'end',
				dominantBaseline: 'central',
			};
		case 'r':
			return {
				x: point.x + offset + 3,
				y: point.y,
				textAnchor: 'start',
				dominantBaseline: 'central',
			};
		default:
			// 't' / bestFit / inBase / inEnd / outEnd / absent: PowerPoint's own
			// default for a line/scatter/bubble marker is above it.
			return { x: point.x, y: point.y - offset, textAnchor: 'middle' };
	}
}

/**
 * Full per-point placement pipeline for a bar/column label: resolve
 * `c:dLblPos`, anchor it on the bar rect, then shift by any per-point
 * `c:dLbl/c:layout` manual drag. `frame` is the chart element's own pixel box
 * (`layout.svgWidth` / `svgHeight` in every cartesian builder), which is what
 * a manual layout's fractional coordinates are measured against.
 */
export function resolveBarLabelPlacement(
	chartData: PptxChartData,
	series: PptxChartSeries,
	pointIndex: number,
	rect: LabelAnchorRect,
	value: number,
	orientation: 'vertical' | 'horizontal',
	frame: ChartFrameSize,
): LabelAnchor {
	const point = findPointLabel(series, pointIndex),
		position =
			point?.position ?? series.dataLabelOptions?.position ?? chartData.style?.dataLabels?.position,
		anchor = resolveBarLabelAnchor(position, rect, value, orientation),
		shifted = applyLabelManualLayout(point?.layout, frame, anchor);
	return { ...anchor, x: shifted.x, y: shifted.y };
}

/**
 * Full per-point placement pipeline for a line/area/scatter/bubble marker
 * label: resolve `c:dLblPos`, anchor it against the marker point, then shift
 * by any per-point `c:dLbl/c:layout` manual drag.
 *
 * @param defaultPosition - Position to use when nothing at any cascade level
 * authored a `c:dLblPos`. Line/scatter/bubble markers keep the historical
 * "above the point" default (`resolveMarkerLabelAnchor`'s own fallback
 * branch); a stock chart's close label defaults to `'r'` (right of the tick,
 * PowerPoint's own placement) instead, so this only needs to be passed by
 * callers wanting a different default.
 */
export function resolveMarkerLabelPlacement(
	chartData: PptxChartData,
	series: PptxChartSeries,
	pointIndex: number,
	point: ChartAnchorPoint,
	frame: ChartFrameSize,
	offset = 7,
	defaultPosition?: PptxChartDataLabelPosition,
): LabelAnchor {
	const override = findPointLabel(series, pointIndex),
		position =
			override?.position ??
			series.dataLabelOptions?.position ??
			chartData.style?.dataLabels?.position ??
			defaultPosition,
		anchor = resolveMarkerLabelAnchor(position, point, offset),
		shifted = applyLabelManualLayout(override?.layout, frame, anchor);
	return { ...anchor, x: shifted.x, y: shifted.y };
}
