/**
 * chart-interaction-stacked.ts: drag-to-value math for one segment of a
 * stacked / percentStacked bar, line, or area mark.
 *
 * `chart-cartesian.ts` deliberately omits `ChartViewModel.valueDrag` for a
 * stacked chart (a segment sits on a running sum, so a naive vertical drag
 * would not track the pointer the way a clustered mark's does). This module
 * is the actual stacked-aware inversion: the segment's BASE (the running sum
 * of the series below it, same sign group) is held fixed, and the pointer's
 * projected value/percent minus that base becomes the dragged series' own new
 * contribution. `computeStackedSeriesPlots` (chart-stacked-series.ts) is the
 * exact running-sum bookkeeping the stacked line/area builders already use,
 * so `baseValue` here can never disagree with what is on screen; plain
 * stacked bars use the same running-sum math (see `computeStackedBarRects`'s
 * own doc comment).
 *
 * @module chart-interaction-stacked
 */
import type { PptxChartData } from 'pptx-viewer-core';

import { computeLayoutOptions } from './chart-axis';
import { roundDragValue, shareToValue, valueFromY } from './chart-interaction';
import { computeStackedSeriesPlots } from './chart-stacked-series';
import { computePlotLayout, computeStackedValueRange } from './chart-view-model';
import type { ValueRange } from './chart-view-model';

/** Geometry a stacked/percentStacked segment drag needs, resolved once at drag start. */
export interface StackedDragGeometry {
	range: ValueRange;
	plotTop: number;
	plotBottom: number;
	/** Running sum of the same-sign series below this one, at this category. */
	baseValue: number;
	/** Sum of every OTHER series' absolute value at this category (percentStacked only). */
	otherAbsSum: number;
	percent: boolean;
}

/**
 * Resolve the drag geometry for one (seriesIndex, pointIndex) stacked
 * segment, or `null` when the chart is not stacked/percentStacked, the series
 * has no values, or the point is out of range.
 */
export function buildStackedDragGeometry(
	element: { width: number; height: number },
	chartData: PptxChartData,
	seriesIndex: number,
	pointIndex: number,
): StackedDragGeometry | null {
	const grouping = chartData.grouping;
	if (grouping !== 'stacked' && grouping !== 'percentStacked') {
		return null;
	}
	const seriesValues = chartData.series.map((s) => s.values),
		draggedValues = seriesValues[seriesIndex];
	if (!draggedValues || pointIndex < 0 || pointIndex >= draggedValues.length) {
		return null;
	}
	const percent = grouping === 'percentStacked',
		catCount = Math.max(
			chartData.categories.length,
			...seriesValues.map((values) => values.length),
			pointIndex + 1,
		),
		plots = computeStackedSeriesPlots(seriesValues, catCount, percent),
		baseValue = plots[seriesIndex]?.base[pointIndex] ?? 0,
		otherAbsSum = seriesValues.reduce(
			(sum, values, si) => (si === seriesIndex ? sum : sum + Math.abs(values[pointIndex] ?? 0)),
			0,
		),
		range: ValueRange = percent
			? { min: 0, max: 100, span: 100 }
			: computeStackedValueRange(chartData.series, catCount),
		layoutOpts = computeLayoutOptions(chartData.axes, chartData.dataTable, chartData.series.length),
		layout = computePlotLayout(element.width, element.height, chartData, true, layoutOpts);
	return {
		range,
		plotTop: layout.plotTop,
		plotBottom: layout.plotBottom,
		baseValue,
		otherAbsSum,
		percent,
	};
}

/**
 * New value for the dragged series at this category given the pointer's Y
 * (view-box units). The pointer projects to a cumulative value/percent at the
 * segment's top edge; subtracting the fixed base below it gives the dragged
 * series' own new share. A plain stacked chart uses that directly (the other
 * series' absolute values are untouched, so the category total simply grows
 * or shrinks); percentStacked instead treats it as a percentage SHARE and
 * converts it back to an absolute value via {@link shareToValue}, holding
 * every other series' value fixed (matching the pie slice renormalisation).
 */
export function resolveStackedDragValue(geometry: StackedDragGeometry, pointerY: number): number {
	const { range, plotTop, plotBottom, baseValue, otherAbsSum, percent } = geometry,
		pointerScalar = valueFromY(pointerY, range, plotTop, plotBottom),
		delta = pointerScalar - baseValue;
	if (!percent) {
		return roundDragValue(delta, range);
	}
	const sign = delta < 0 ? -1 : 1,
		absValue = shareToValue(Math.abs(delta) / 100, otherAbsSum),
		valueRange: ValueRange = {
			min: 0,
			max: Math.max(otherAbsSum, absValue, 1),
			span: Math.max(otherAbsSum, absValue, 1),
		};
	return roundDragValue(sign * absValue, valueRange);
}
