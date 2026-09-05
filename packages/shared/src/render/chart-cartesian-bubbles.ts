/**
 * chart-cartesian-bubbles.ts: bubble-chart plot-primitive builder, split out
 * of `chart-cartesian-plots.ts` (which still owns `buildScatter` and the
 * shared XY plumbing this file imports) to keep each module within the
 * repo's ~300-LOC limit.
 *
 * @module chart-cartesian-bubbles
 */
import type { PptxChartData } from 'pptx-viewer-core';

import { elementFrame, seriesXValues, xyMarkTooltip } from './chart-cartesian-plots';
import type { SeriesPlotResult } from './chart-cartesian-plots';
import { resolveMarkerLabelPlacement } from './chart-data-label-anchor';
import {
	buildDataLabelText,
	dataLabelFontOverride,
	resolveDataLabelTextStyle,
} from './chart-data-label-text';
import { resolveDataPointFill } from './chart-datapoint-style';
import { DEFAULT_CHART_DATA_LABEL_PX } from './chart-font';
import type { PlotLayout, SvgCircle, SvgPrimitive, SvgText, ValueRange } from './chart-view-model';
import {
	computeBubbleRadius,
	computeScatterDots,
	computeScatterXDomain,
	formatAxisValue,
	seriesColor,
} from './chart-view-model';

/**
 * Build bubble-chart primitives.
 *
 * Every series carries its own `c:xVal`, `c:yVal` AND `c:bubbleSize`, so each
 * one is a complete bubble series. The engine used to read sizes off "the third
 * series", which drew equal-sized dots for the ordinary one-series bubble chart
 * and silently deleted every series past the second from a three-series one.
 *
 * Honours `c:bubbleChart`'s three display options (`chartData.bubbleOptions`):
 * `bubbleScale` (a percent multiplier on the whole size envelope), `sizeRepresents`
 * (`'area'`, ECMA-376's own default: radius scales with the square root of the
 * value so the bubble's AREA tracks it; `'w'`: radius scales linearly with the
 * value), and `showNegativeBubbles` (default false: a negative-size point is not
 * plotted at all, matching PowerPoint, rather than floored to zero).
 */
export function buildBubbles(
	chartData: PptxChartData,
	layout: PlotLayout,
	range: ValueRange,
): SeriesPlotResult {
	const primitives: SvgPrimitive[] = [],
		dataLabels: SvgText[] = [],
		showLabels = chartData.style?.hasDataLabels,
		allIndices = chartData.series.flatMap((s) => s.values.map((_, i) => i)),
		maxXIndex = Math.max(1, ...allIndices),
		perSeriesX = chartData.series.map((series) => seriesXValues(chartData, series)),
		xDomain = computeScatterXDomain(perSeriesX),
		// One size scale for the whole chart, so bubbles stay comparable across series.
		allSizes = chartData.series.flatMap((series) => series.bubbleSizes ?? []),
		maxBubble = allSizes.length > 0 ? Math.max(1, ...allSizes.map(Math.abs)) : 1,
		medianRadius = Math.min(layout.plotWidth, layout.plotHeight) * 0.04,
		// c:bubbleScale/c:sizeRepresents/c:showNegBubbles: PowerPoint's own
		// defaults (100%, area-proportional, negative bubbles hidden) apply even
		// when the chart authors none of the three `c:bubbleChart` elements.
		radiusOptions = {
			bubbleScale: chartData.bubbleOptions?.bubbleScale,
			sizeRepresents: chartData.bubbleOptions?.sizeRepresents ?? ('area' as const),
		},
		showNegativeBubbles = chartData.bubbleOptions?.showNegativeBubbles === true;

	for (let si = 0; si < chartData.series.length; si++) {
		const series = chartData.series[si],
			c = seriesColor(series, si, chartData.colorPalette),
			dots = computeScatterDots(series.values, maxXIndex, layout, range, perSeriesX[si], xDomain);
		dots.forEach((dot, vi) => {
			const size = series.bubbleSizes?.[vi];
			if (size !== undefined && size < 0 && !showNegativeBubbles) {
				// c:showNegBubbles default false: PowerPoint does not plot a
				// negative-size bubble at all, it does not floor it to zero.
				return;
			}
			const r = computeBubbleRadius(size, maxBubble, medianRadius, radiusOptions),
				label =
					size !== undefined
						? `${xyMarkTooltip(series.name, perSeriesX[si]?.[vi], series.values[vi] ?? 0, series.numberFormat)}, size ${formatAxisValue(size)}`
						: xyMarkTooltip(
								series.name,
								perSeriesX[si]?.[vi],
								series.values[vi] ?? 0,
								series.numberFormat,
							);
			primitives.push({
				kind: 'circle',
				cx: dot.cx,
				cy: dot.cy,
				r,
				fill: resolveDataPointFill(series, vi, c) ?? c,
				opacity: 0.6,
				part: { role: 'dataPoint', seriesIndex: si, pointIndex: vi },
				title: label,
			} satisfies SvgCircle);
		});
		if (showLabels) {
			series.values.forEach((val, vi) => {
				const dot = dots[vi],
					size = series.bubbleSizes?.[vi];
				if (size !== undefined && size < 0 && !showNegativeBubbles) {
					return;
				}
				const label = buildDataLabelText({ chartData, series, pointIndex: vi, value: val });
				if (!dot || label === undefined) {
					return;
				}
				const anchor = resolveMarkerLabelPlacement(
					chartData,
					series,
					vi,
					{ x: dot.cx, y: dot.cy },
					elementFrame(layout),
					10,
				);
				dataLabels.push({
					kind: 'text',
					x: anchor.x,
					y: anchor.y,
					text: label.text,
					fontSize: DEFAULT_CHART_DATA_LABEL_PX,
					fill: label.color ?? '#334155',
					textAnchor: anchor.textAnchor,
					...(anchor.dominantBaseline ? { dominantBaseline: anchor.dominantBaseline } : {}),
					...dataLabelFontOverride(resolveDataLabelTextStyle(chartData, series, vi)),
				});
			});
		}
	}
	return { primitives, dataLabels };
}
