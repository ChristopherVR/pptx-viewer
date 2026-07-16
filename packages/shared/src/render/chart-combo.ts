import type { PptxChartData, PptxChartSeries, PptxElement } from 'pptx-viewer-core';

import { computeLayoutOptions, getSecondaryValueAxis, splitSeriesByAxis } from './chart-axis';
import { buildSecondaryAxis } from './chart-axis-render';
import type {
	ChartViewModel,
	PlotLayout,
	SvgCircle,
	SvgPolyline,
	SvgPrimitive,
	SvgText,
	ValueRange,
} from './chart-view-model';
import {
	buildCategoryLabels,
	buildGridlinesAndLabels,
	buildLegend,
	buildZeroLine,
	computeBarRects,
	computePlotLayout,
	computeValueRange,
	formatAxisValue,
	seriesColor,
	valueToY,
} from './chart-view-model';

function rangeForSeries(
	index: number,
	primaryRange: ValueRange,
	secondaryRange: ValueRange | undefined,
	secondaryIndexes: ReadonlySet<number>,
): ValueRange {
	return secondaryRange && secondaryIndexes.has(index) ? secondaryRange : primaryRange;
}

/** Build a bar + line combo chart, including independently scaled secondary series. */
export function buildComboViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const layoutOptions = computeLayoutOptions(
		chartData.axes,
		chartData.dataTable,
		chartData.series.length,
	);
	const layout: PlotLayout = computePlotLayout(
		element.width,
		element.height,
		chartData,
		true,
		layoutOptions,
	);
	const catCount = Math.max(categoryLabels.length, 1);
	const { primary, secondary } = splitSeriesByAxis(chartData.series, chartData.axes);
	const secondaryIndexes = new Set(secondary.map((entry) => entry.index));
	const primarySeries =
		primary.length > 0 ? primary.map((entry) => entry.series) : chartData.series;
	const primaryRange = computeValueRange(primarySeries);
	const secondaryRange =
		secondary.length > 0 ? computeValueRange(secondary.map((entry) => entry.series)) : undefined;

	const { gridlines, axisLabels } = buildGridlinesAndLabels(primaryRange, layout);
	const secondaryAxis = secondaryRange
		? buildSecondaryAxis(secondaryRange, layout, getSecondaryValueAxis(chartData.axes))
		: undefined;
	const zeroLine = buildZeroLine(primaryRange, layout);
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
	const primitives: SvgPrimitive[] = [];
	const dataLabels: SvgText[] = [];

	const barSeries = chartData.series.slice(0, 1);
	if (barSeries[0]) {
		const barRange = rangeForSeries(0, primaryRange, secondaryRange, secondaryIndexes);
		primitives.push(
			...computeBarRects(barSeries, catCount, layout, barRange, chartData.colorPalette).map(
				(rect) => ({
					kind: 'rect' as const,
					x: rect.x,
					y: rect.y,
					w: rect.w,
					h: rect.h,
					fill: rect.fill,
					rx: 1,
				}),
			),
		);
		appendBarLabels(barSeries[0], chartData, layout, catCount, barRange, dataLabels);
	}

	const barGroupWidth = layout.plotWidth / catCount;
	chartData.series.slice(1).forEach((series, offset) => {
		const seriesIndex = offset + 1;
		if (series.values.length === 0) {
			return;
		}
		const range = rangeForSeries(seriesIndex, primaryRange, secondaryRange, secondaryIndexes);
		const fill = seriesColor(series, seriesIndex, chartData.colorPalette);
		const points = series.values.map((value, valueIndex) => ({
			x: layout.plotLeft + barGroupWidth * valueIndex + barGroupWidth / 2,
			y: valueToY(value, range, layout.plotTop, layout.plotBottom),
		}));
		primitives.push({
			kind: 'polyline',
			points: points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '),
			stroke: fill,
			strokeWidth: 2.4,
			fill: 'none',
		} satisfies SvgPolyline);
		primitives.push(
			...points.map(
				(point) => ({ kind: 'circle', cx: point.x, cy: point.y, r: 2.5, fill }) satisfies SvgCircle,
			),
		);
		if (chartData.style?.hasDataLabels) {
			series.values.forEach((value, index) => {
				const point = points[index];
				if (point) {
					dataLabels.push({
						kind: 'text',
						x: point.x,
						y: point.y - 7,
						text: formatAxisValue(value),
						fontSize: 7,
						fill: '#334155',
						textAnchor: 'middle',
					});
				}
			});
		}
	});

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title: chartData.style?.hasTitle && chartData.title ? chartData.title : undefined,
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
		secondaryGridlines: secondaryAxis?.gridlines,
		secondaryAxisLabels: secondaryAxis?.axisLabels,
	};
}

function appendBarLabels(
	series: PptxChartSeries,
	chartData: PptxChartData,
	layout: PlotLayout,
	catCount: number,
	range: ValueRange,
	labels: SvgText[],
): void {
	if (!chartData.style?.hasDataLabels) {
		return;
	}
	const groupWidth = layout.plotWidth / catCount;
	const barWidth = groupWidth * 0.7;
	const offset = (groupWidth - barWidth) / 2;
	series.values.forEach((value, index) => {
		const zeroY = valueToY(0, range, layout.plotTop, layout.plotBottom);
		const valueY = valueToY(value, range, layout.plotTop, layout.plotBottom);
		labels.push({
			kind: 'text',
			x: layout.plotLeft + groupWidth * index + offset + barWidth / 2,
			y: value >= 0 ? Math.min(zeroY, valueY) - 4 : Math.max(zeroY, valueY) + 10,
			text: formatAxisValue(value),
			fontSize: 7,
			fill: '#334155',
			textAnchor: 'middle',
		});
	});
}
