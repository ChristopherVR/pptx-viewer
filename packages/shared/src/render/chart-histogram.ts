import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import { resolveChartTitleText } from './chart-auto-title';
import { buildValueAxisGridlinesAndLabels, findValueAxis } from './chart-cx-axis-units';
import { dataLabelFontOverride, resolveDataLabelTextStyle } from './chart-data-label-text';
import { distributionRange } from './chart-distribution-range';
import { DEFAULT_CHART_DATA_LABEL_PX } from './chart-font';
import { aggregateByCategory, computeHistogramBins } from './chart-histogram-binning';
import { buildParetoAxis, buildParetoPrimitives, orderParetoEntries } from './chart-pareto';
import type { ParetoEntry } from './chart-pareto';
import type {
	ChartViewModel,
	PlotLayout,
	SvgPrimitive,
	SvgRect,
	SvgText,
	ValueRange,
} from './chart-view-model';
import {
	buildCategoryLabels,
	buildLegend,
	buildZeroLine,
	computePlotLayout,
	formatAxisValue,
	paletteColor,
	valueToY,
} from './chart-view-model';

// Re-exported so `chart-distribution.ts`'s existing `export * from
// './chart-histogram'` barrel keeps surfacing these after the split.
export { aggregateByCategory, computeHistogramBins } from './chart-histogram-binning';
export type { HistogramBin } from './chart-histogram-binning';

const DATA_LABEL_COLOR = '#334155';

export interface HistogramBar {
	x: number;
	y: number;
	w: number;
	h: number;
	fill: string;
	pointIndex?: number;
}

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
	return values.map((val, pointIndex) => {
		const zeroY = valueToY(0, range, layout.plotTop, layout.plotBottom);
		const valY = valueToY(val, range, layout.plotTop, layout.plotBottom);
		return {
			x: layout.plotLeft + barWidth * pointIndex,
			y: Math.min(zeroY, valY),
			w: Math.max(barWidth - 0.5, 1),
			h: Math.max(Math.abs(zeroY - valY), 1),
			fill: seriesColorOverride ?? paletteColor(pointIndex, colorPalette),
			pointIndex,
		};
	});
}

export function buildHistogramViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const paretoIndex = chartData.series.findIndex(
		(item) => item.histogramOptions?.layout === 'pareto',
	);
	const layout = computePlotLayout(element.width, element.height, chartData, true, {
		hasSecondaryValueAxis: paretoIndex >= 0,
	});
	const histogramIndex = Math.max(
		chartData.series.findIndex((series) => series.histogramOptions?.layout !== 'pareto'),
		0,
	);
	const series = chartData.series[histogramIndex];
	const options = series?.histogramOptions;
	const bins = options?.aggregateByCategory
		? aggregateByCategory(series?.values ?? [], categoryLabels)
		: options?.layout === 'histogram'
			? computeHistogramBins(series?.values ?? [], options)
			: undefined;
	const baseEntries: ParetoEntry[] = (
		bins?.map((bin) => ({ value: bin.value, label: bin.label })) ??
		(series?.values ?? []).map((value, index) => ({
			value,
			label: categoryLabels[index] ?? '',
		}))
	).map((entry, sourcePointIndex) => ({ ...entry, sourcePointIndex }));
	const entries = paretoIndex >= 0 ? orderParetoEntries(baseEntries) : baseEntries;
	const values = entries.map((entry) => entry.value);
	const labels = entries.map((entry) => entry.label);
	const range = distributionRange([{ name: series?.name ?? '', values }]);
	const bars = computeHistogramBars(
		values,
		labels.length,
		layout,
		range,
		series?.color,
		chartData.colorPalette,
	);
	const primitives: SvgPrimitive[] = bars.map(
		(bar, displayIndex) =>
			({
				kind: 'rect',
				x: bar.x,
				y: bar.y,
				w: bar.w,
				h: bar.h,
				fill: bar.fill,
				opacity: 0.85,
				...(bins
					? {}
					: {
							part: {
								role: 'dataPoint',
								seriesIndex: histogramIndex,
								pointIndex: entries[displayIndex]?.sourcePointIndex ?? displayIndex,
							},
						}),
			}) satisfies SvgRect,
	);
	if (paretoIndex >= 0) {
		primitives.push(
			...buildParetoPrimitives(entries, layout, chartData.series[paretoIndex], paretoIndex),
		);
	}
	const dataLabels: SvgText[] = chartData.style?.hasDataLabels
		? bars.map((bar, index) => ({
				kind: 'text',
				x: bar.x + bar.w / 2,
				y: bar.y - 4,
				text: formatAxisValue(values[index]),
				fontSize: DEFAULT_CHART_DATA_LABEL_PX,
				fill: DATA_LABEL_COLOR,
				textAnchor: 'middle',
				...(series
					? dataLabelFontOverride(
							resolveDataLabelTextStyle(
								chartData,
								series,
								entries[index]?.sourcePointIndex ?? index,
							),
						)
					: {}),
			}))
		: [];
	const { gridlines, axisLabels } = buildValueAxisGridlinesAndLabels(
		range,
		layout,
		findValueAxis(chartData.axes),
	);
	const paretoAxis = paretoIndex >= 0 ? buildParetoAxis(layout) : undefined;
	const { legend, legendX, legendY, legendAnchor } = buildLegend(
		chartData.series,
		chartData.colorPalette,
		layout.svgWidth,
		chartData.style?.legendPosition ?? 'b',
		layout.svgHeight,
		layout.plotTop,
	);
	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title: resolveChartTitleText(chartData),
		titleX: layout.svgWidth / 2,
		titleY: 12,
		gridlines,
		axisLabels,
		zeroLine: buildZeroLine(range, layout),
		categoryLabels: buildCategoryLabels(labels, layout, 'bar'),
		primitives,
		dataLabels,
		legend: chartData.style?.hasLegend ? legend : [],
		legendX,
		legendY,
		legendAnchor,
		secondaryGridlines: paretoAxis?.secondaryGridlines,
		secondaryAxisLabels: paretoAxis?.secondaryAxisLabels,
	};
}
