/**
 * View-model builders for histogram and box-and-whisker chart kinds.
 *
 * Ported from:
 *   packages/react/src/viewer/utils/chart-bar.tsx (renderHistogramChart,
 *     renderBoxWhiskerChart)
 *   packages/vue/src/viewer/components/chart/HistogramChart.vue
 *   packages/vue/src/viewer/components/chart/BoxWhiskerChart.vue
 *
 * Both kinds are cartesian (gridlines + axis labels + category labels). The
 * value range follows the React convention (min includes zero, max floored at
 * 1) so a single shared scale drives both bindings; the Vue components received
 * an externally-computed range that resolves to the same numbers.
 *
 * Histogram:  contiguous bars (no inter-bar gap) for series[0].
 * BoxWhisker: per category, the cross-series values form the five-number
 *             summary (min / Q1 / median / Q3 / max). Each category renders a
 *             whisker line + caps, an IQR box (Q1..Q3) and a median line.
 *
 * @module chart-distribution
 */

import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import type {
	ChartViewModel,
	LegendEntry,
	PlotLayout,
	SvgLine,
	SvgPrimitive,
	SvgRect,
	SvgText,
	ValueRange,
} from './chart-view-model';
import {
	buildCategoryLabels,
	buildGridlinesAndLabels,
	buildLegend,
	buildZeroLine,
	computePlotLayout,
	formatAxisValue,
	paletteColor,
	valueToY,
} from './chart-view-model';

const WHISKER_COLOR = '#64748b';
const MEDIAN_COLOR = '#1e293b';
const DATA_LABEL_COLOR = '#334155';

/**
 * Range across all series with zero forced into the lower bound and the upper
 * bound floored at 1. Mirrors React's box-whisker / `computeValueRangeForChart`
 * floor behaviour so histogram and box-whisker share one scale.
 */
function distributionRange(series: PptxChartData['series']): ValueRange {
	const all = series.flatMap((s) => s.values);
	const min = Math.min(...all, 0);
	const max = Math.max(...all, 1);
	return { min, max, span: Math.max(max - min, 1) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Histogram
// ─────────────────────────────────────────────────────────────────────────────

/** One contiguous histogram bar. */
export interface HistogramBar {
	x: number;
	y: number;
	w: number;
	h: number;
	fill: string;
}

/**
 * Compute contiguous (gapless) histogram bars for a single value series.
 * Bar width = plotWidth / max(catCount, valueCount, 1); each bar is shrunk by
 * 0.5px to give a hairline divider. Mirrors React / Vue histogram geometry.
 */
export function computeHistogramBars(
	values: ReadonlyArray<number>,
	catCount: number,
	layout: PlotLayout,
	range: ValueRange,
	seriesColorOverride: string | undefined,
	colorPalette: readonly string[] | undefined,
): HistogramBar[] {
	const count = Math.max(catCount, values.length, 1);
	const barWidth = layout.plotWidth / count;
	return values.map((val, i) => {
		const x = layout.plotLeft + barWidth * i;
		const zeroY = valueToY(0, range, layout.plotTop, layout.plotBottom);
		const valY = valueToY(val, range, layout.plotTop, layout.plotBottom);
		const y = Math.min(zeroY, valY);
		const h = Math.max(Math.abs(zeroY - valY), 1);
		return {
			x,
			y,
			w: Math.max(barWidth - 0.5, 1),
			h,
			fill: seriesColorOverride ?? paletteColor(i, colorPalette),
		};
	});
}

/**
 * Build the view-model for a histogram chart: contiguous bars from series[0].
 * Mirrors `renderHistogramChart` (React) / `HistogramChart.vue`.
 */
export function buildHistogramViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const layout = computePlotLayout(element.width, element.height, chartData, true);
	const range = distributionRange(chartData.series);
	const values = chartData.series[0]?.values ?? [];
	const catCount = Math.max(categoryLabels.length, values.length, 1);
	const barWidth = layout.plotWidth / catCount;

	const bars = computeHistogramBars(
		values,
		categoryLabels.length,
		layout,
		range,
		chartData.series[0]?.color,
		chartData.colorPalette,
	);

	const primitives: SvgPrimitive[] = bars.map(
		(b) =>
			({
				kind: 'rect',
				x: b.x,
				y: b.y,
				w: b.w,
				h: b.h,
				fill: b.fill,
				opacity: 0.85,
			}) satisfies SvgRect,
	);

	const dataLabels: SvgText[] = [];
	if (chartData.style?.hasDataLabels) {
		bars.forEach((b, i) => {
			const val = values[i];
			if (val === undefined) {
				return;
			}
			dataLabels.push({
				kind: 'text',
				x: b.x + barWidth / 2,
				y: b.y - 4,
				text: formatAxisValue(val),
				fontSize: 7,
				fill: DATA_LABEL_COLOR,
				textAnchor: 'middle',
			});
		});
	}

	const { gridlines, axisLabels } = buildGridlinesAndLabels(range, layout);
	const zeroLine = buildZeroLine(range, layout);
	const catLabels = buildCategoryLabels(categoryLabels, layout, 'bar');

	const legendPos = chartData.style?.legendPosition ?? 'b';
	const { legend, legendX, legendY, legendAnchor } = buildLegend(
		chartData.series,
		chartData.colorPalette,
		layout.svgWidth,
		legendPos,
		layout.svgHeight,
		layout.plotTop,
	);

	const title = chartData.style?.hasTitle && chartData.title ? chartData.title : undefined;

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title,
		titleX: layout.svgWidth / 2,
		titleY: 12,
		gridlines,
		axisLabels,
		zeroLine,
		categoryLabels: catLabels,
		primitives,
		dataLabels,
		legend: chartData.style?.hasLegend ? legend : [],
		legendX,
		legendY,
		legendAnchor,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// Box-and-whisker
// ─────────────────────────────────────────────────────────────────────────────

/** The five-number summary for one box-and-whisker category. */
export interface BoxStats {
	min: number;
	q1: number;
	median: number;
	q3: number;
	max: number;
}

/**
 * Compute the five-number summary (min / Q1 / median / Q3 / max) from a
 * category's cross-series values. Quartiles use the floor-index method that the
 * React and Vue bindings share: index = floor(n * quantile) over the sorted
 * values. Returns undefined when fewer than two values are present.
 */
export function computeBoxStats(values: ReadonlyArray<number>): BoxStats | undefined {
	if (values.length < 2) {
		return undefined;
	}
	const sorted = [...values].sort((a, b) => a - b);
	const n = sorted.length;
	return {
		min: sorted[0],
		q1: sorted[Math.floor(n * 0.25)],
		median: sorted[Math.floor(n * 0.5)],
		q3: sorted[Math.floor(n * 0.75)],
		max: sorted[n - 1],
	};
}

/** Geometry for one rendered box-and-whisker category (px coordinates). */
export interface BoxWhiskerGeometry {
	stats: BoxStats;
	boxX: number;
	boxW: number;
	xMid: number;
	yMin: number;
	yMax: number;
	yQ1: number;
	yQ3: number;
	yMed: number;
	fill: string;
}

/**
 * Compute per-category box-and-whisker geometry. Categories with fewer than two
 * cross-series values are skipped. Mirrors the React / Vue box-whisker math.
 */
export function computeBoxWhiskerGeometry(
	chartData: PptxChartData,
	catCount: number,
	layout: PlotLayout,
	range: ValueRange,
	colorPalette: readonly string[] | undefined,
): BoxWhiskerGeometry[] {
	const boxGroupW = layout.plotWidth / catCount;
	const boxW = boxGroupW * 0.5;
	const boxOffset = (boxGroupW - boxW) / 2;
	const out: BoxWhiskerGeometry[] = [];

	for (let ci = 0; ci < catCount; ci++) {
		const catVals = chartData.series.map((s) => s.values[ci] ?? 0);
		const stats = computeBoxStats(catVals);
		if (!stats) {
			continue;
		}
		const boxX = layout.plotLeft + boxGroupW * ci + boxOffset;
		out.push({
			stats,
			boxX,
			boxW,
			xMid: boxX + boxW / 2,
			yMin: valueToY(stats.min, range, layout.plotTop, layout.plotBottom),
			yMax: valueToY(stats.max, range, layout.plotTop, layout.plotBottom),
			yQ1: valueToY(stats.q1, range, layout.plotTop, layout.plotBottom),
			yQ3: valueToY(stats.q3, range, layout.plotTop, layout.plotBottom),
			yMed: valueToY(stats.median, range, layout.plotTop, layout.plotBottom),
			fill: paletteColor(ci, colorPalette),
		});
	}
	return out;
}

/**
 * Build the view-model for a box-and-whisker chart. The cross-series values for
 * each category form the whisker statistics. Mirrors `renderBoxWhiskerChart`
 * (React) / `BoxWhiskerChart.vue`.
 */
export function buildBoxWhiskerViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const layout = computePlotLayout(element.width, element.height, chartData, true);
	const range = distributionRange(chartData.series);
	const catCount = Math.max(categoryLabels.length, 1);

	const geometries = computeBoxWhiskerGeometry(
		chartData,
		catCount,
		layout,
		range,
		chartData.colorPalette,
	);

	const primitives: SvgPrimitive[] = [];
	for (const g of geometries) {
		// Upper + lower whiskers.
		primitives.push(
			{
				kind: 'line',
				x1: g.xMid,
				y1: g.yMax,
				x2: g.xMid,
				y2: g.yQ3,
				stroke: WHISKER_COLOR,
				strokeWidth: 1,
			} satisfies SvgLine,
			{
				kind: 'line',
				x1: g.xMid,
				y1: g.yQ1,
				x2: g.xMid,
				y2: g.yMin,
				stroke: WHISKER_COLOR,
				strokeWidth: 1,
			} satisfies SvgLine,
		);
		// Whisker caps.
		primitives.push(
			{
				kind: 'line',
				x1: g.boxX + g.boxW * 0.25,
				y1: g.yMax,
				x2: g.boxX + g.boxW * 0.75,
				y2: g.yMax,
				stroke: WHISKER_COLOR,
				strokeWidth: 1,
			} satisfies SvgLine,
			{
				kind: 'line',
				x1: g.boxX + g.boxW * 0.25,
				y1: g.yMin,
				x2: g.boxX + g.boxW * 0.75,
				y2: g.yMin,
				stroke: WHISKER_COLOR,
				strokeWidth: 1,
			} satisfies SvgLine,
		);
		// IQR box (Q1..Q3).
		primitives.push({
			kind: 'rect',
			x: g.boxX,
			y: Math.min(g.yQ1, g.yQ3),
			w: g.boxW,
			h: Math.abs(g.yQ1 - g.yQ3),
			fill: g.fill,
			rx: 1,
			opacity: 0.8,
		} satisfies SvgRect);
		// Median line.
		primitives.push({
			kind: 'line',
			x1: g.boxX,
			y1: g.yMed,
			x2: g.boxX + g.boxW,
			y2: g.yMed,
			stroke: MEDIAN_COLOR,
			strokeWidth: 2,
		} satisfies SvgLine);
	}

	const { gridlines, axisLabels } = buildGridlinesAndLabels(range, layout);
	const zeroLine = buildZeroLine(range, layout);
	const catLabels = buildCategoryLabels(categoryLabels, layout, 'bar');

	const legendPos = chartData.style?.legendPosition ?? 'b';
	const { legend, legendX, legendY, legendAnchor } = buildLegend(
		chartData.series,
		chartData.colorPalette,
		layout.svgWidth,
		legendPos,
		layout.svgHeight,
		layout.plotTop,
	);

	// Prefer per-category swatches (box fill is palette-by-category).
	const catLegend: LegendEntry[] = categoryLabels.map((label, i) => ({
		color: paletteColor(i, chartData.colorPalette),
		label,
	}));

	const title = chartData.style?.hasTitle && chartData.title ? chartData.title : undefined;

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title,
		titleX: layout.svgWidth / 2,
		titleY: 12,
		gridlines,
		axisLabels,
		zeroLine,
		categoryLabels: catLabels,
		primitives,
		dataLabels: [],
		legend: chartData.style?.hasLegend ? (catLegend.length > 0 ? catLegend : legend) : [],
		legendX,
		legendY,
		legendAnchor,
	};
}
