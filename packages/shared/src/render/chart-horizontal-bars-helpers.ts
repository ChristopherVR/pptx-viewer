/**
 * chart-horizontal-bars-helpers.ts: geometry/fill helpers for the transposed
 * (horizontal) bar-chart builder, split out of `chart-horizontal-bars.ts` to
 * keep that file within the repo's ~300-LOC limit.
 *
 * @module chart-horizontal-bars-helpers
 */
import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';

import { resolveDataPointFill, resolveVaryColorFill } from './chart-datapoint-style';
import { DEFAULT_CHART_TEXT_PX } from './chart-font';
import type { PlotLayout, SvgLine, SvgText, ValueRange } from './chart-view-model';
import {
	AXIS_LABEL_COLOR,
	axisTickValues,
	formatAxisValue,
	GRIDLINE_COLOR,
	paletteColor,
	seriesColor,
} from './chart-view-model';

/** Map a value onto the horizontal (x) axis: min at the left, max at the right. */
export function valueToX(val: number, range: ValueRange, leftX: number, rightX: number): number {
	const usable = rightX - leftX;
	let ratio: number;
	if (range.logScale && range.logBase) {
		const base = range.logBase,
			clampedVal = Math.max(val, range.min),
			logVal = Math.log(clampedVal) / Math.log(base),
			logMin = Math.log(range.min) / Math.log(base);
		ratio = (logVal - logMin) / range.span;
	} else {
		ratio = (val - range.min) / range.span;
	}
	return range.reverseOrder ? rightX - ratio * usable : leftX + ratio * usable;
}

/** Vertical value gridlines + bottom tick labels (the transposed value axis). */
export function buildTransposedValueAxis(
	range: ValueRange,
	layout: PlotLayout,
): { gridlines: SvgLine[]; axisLabels: SvgText[] } {
	const gridlines: SvgLine[] = [],
		axisLabels: SvgText[] = [];
	for (const val of axisTickValues(range)) {
		const x = valueToX(val, range, layout.plotLeft, layout.plotRight);
		gridlines.push({
			kind: 'line',
			x1: x,
			y1: layout.plotTop,
			x2: x,
			y2: layout.plotBottom,
			stroke: GRIDLINE_COLOR,
			strokeWidth: 1,
		});
		axisLabels.push({
			kind: 'text',
			x,
			y: layout.plotBottom + 12,
			text: formatAxisValue(val),
			fontSize: DEFAULT_CHART_TEXT_PX,
			fill: AXIS_LABEL_COLOR,
			textAnchor: 'middle',
		});
	}
	return { gridlines, axisLabels };
}

/** Left-anchored category labels, one per band, centred on the band. */
export function buildSideCategoryLabels(
	categoryLabels: ReadonlyArray<string>,
	layout: PlotLayout,
): SvgText[] {
	const catCount = Math.max(categoryLabels.length, 1),
		band = layout.plotHeight / catCount;
	return categoryLabels.map((label, i) => ({
		kind: 'text' as const,
		x: layout.plotLeft - 4,
		y: layout.plotTop + band * (i + 0.5),
		text: label,
		fontSize: DEFAULT_CHART_TEXT_PX,
		fill: AXIS_LABEL_COLOR,
		textAnchor: 'end' as const,
		dominantBaseline: 'central',
	}));
}

/** Per-category absolute totals (for percentStacked normalisation). */
export function categoryTotals(series: ReadonlyArray<PptxChartSeries>, catCount: number): number[] {
	return Array.from({ length: catCount }, (_, ci) =>
		series.reduce((sum, s) => sum + Math.abs(s.values[ci] ?? 0), 0),
	);
}

/** Resolve the fill for one bar, honouring dPt overrides and varyColors. */
export function barFill(
	chartData: PptxChartData,
	series: PptxChartSeries,
	seriesIndex: number,
	pointIndex: number,
): string {
	const palette = chartData.colorPalette;
	if (chartData.varyColors === true && chartData.series.length === 1) {
		return resolveVaryColorFill(series, pointIndex, paletteColor(pointIndex, palette));
	}
	return (
		resolveDataPointFill(series, pointIndex, paletteColor(seriesIndex, palette)) ??
		seriesColor(series, seriesIndex, palette)
	);
}
