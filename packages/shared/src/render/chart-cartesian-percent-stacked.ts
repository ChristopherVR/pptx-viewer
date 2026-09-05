/**
 * chart-cartesian-percent-stacked.ts: the percentStacked bar/column builder,
 * split out of `chart-cartesian-bars.ts` (which still owns clustered and
 * plain stacked) to keep each module within the repo's ~300-LOC limit.
 *
 * @module chart-cartesian-percent-stacked
 */
import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';

import type { SeriesPlotResult } from './chart-cartesian-plots';
import { dataLabelFontOverride, resolveDataLabelTextStyle } from './chart-data-label-text';
import { resolveDataPointFill } from './chart-datapoint-style';
import { DEFAULT_CHART_DATA_LABEL_PX } from './chart-font';
import type { PlotLayout, SvgPrimitive, SvgRect, SvgText, ValueRange } from './chart-view-model';
import { buildMarkTooltip, paletteColor, seriesColor, valueToY } from './chart-view-model';

/** Per-category absolute totals (for percentStacked normalisation). */
function categoryTotals(series: ReadonlyArray<PptxChartSeries>, catCount: number): number[] {
	return Array.from({ length: catCount }, (_, ci) =>
		series.reduce((sum, s) => sum + Math.abs(s.values[ci] ?? 0), 0),
	);
}

/**
 * Build percentStacked bar/column primitives: normalise each category to
 * 100% with in-bar percent labels (matching React's `renderStackedBarChart`).
 * `invertNegativeFill` is injected from `chart-cartesian-bars.ts` (the only
 * other consumer of `c:invertIfNegative`) rather than duplicated here.
 */
export function buildPercentStackedBars(
	chartData: PptxChartData,
	catCount: number,
	layout: PlotLayout,
	primaryRange: ValueRange,
	sourceIndices: ReadonlyArray<number>,
	invertNegativeFill: (
		series: PptxChartSeries,
		pointIndex: number,
		value: number,
		baseFill: string,
	) => string,
): SeriesPlotResult {
	const primitives: SvgPrimitive[] = [],
		dataLabels: SvgText[] = [],
		series = chartData.series,
		palette = chartData.colorPalette,
		showLabels = chartData.style?.hasDataLabels,
		barGroupWidth = layout.plotWidth / Math.max(catCount, 1),
		barW = barGroupWidth * 0.6,
		barOffset = (barGroupWidth - barW) / 2,
		displaySeries = series.map((entry) => ({
			...entry,
			values: sourceIndices.map((sourceIndex) => entry.values[sourceIndex] ?? 0),
		})),
		totals = categoryTotals(displaySeries, catCount);

	for (let ci = 0; ci < catCount; ci++) {
		let posRunning = 0,
			negRunning = 0;
		const catTotal = totals[ci] || 1;

		for (let si = 0; si < series.length; si++) {
			const sourceIndex = sourceIndices[ci] ?? ci,
				rawVal = series[si].values[sourceIndex] ?? 0,
				val = catTotal > 0 ? (rawVal / catTotal) * 100 : 0,
				isNeg = val < 0,
				base = isNeg ? negRunning : posRunning,
				top = base + val,
				x = layout.plotLeft + barGroupWidth * ci + barOffset,
				baseY = valueToY(base, primaryRange, layout.plotTop, layout.plotBottom),
				topY = valueToY(top, primaryRange, layout.plotTop, layout.plotBottom),
				y = Math.min(baseY, topY),
				h = Math.max(Math.abs(baseY - topY), 0.5),
				pctBaseFill =
					resolveDataPointFill(series[si], sourceIndex, paletteColor(si, palette)) ??
					seriesColor(series[si], si, palette);
			primitives.push({
				kind: 'rect',
				x,
				y,
				w: barW,
				h,
				fill: invertNegativeFill(series[si], sourceIndex, rawVal, pctBaseFill),
				part: { role: 'dataPoint', seriesIndex: si, pointIndex: sourceIndex },
				title: buildMarkTooltip(
					series[si].name,
					chartData.categories[sourceIndex],
					rawVal,
					series[si].numberFormat,
				),
			} satisfies SvgRect);

			if (showLabels && Math.abs(val) > 0) {
				dataLabels.push({
					kind: 'text',
					x: x + barW / 2,
					y: y + h / 2 + 3,
					text: `${Math.round(val)}%`,
					fontSize: DEFAULT_CHART_DATA_LABEL_PX,
					fill: '#ffffff',
					textAnchor: 'middle',
					fontWeight: 'bold',
					...dataLabelFontOverride(resolveDataLabelTextStyle(chartData, series[si], sourceIndex)),
				});
			}

			if (isNeg) {
				negRunning += val;
			} else {
				posRunning += val;
			}
		}
	}
	return { primitives, dataLabels };
}
