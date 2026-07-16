import type {
	PptxChartData,
	PptxChartHistogramOptions,
	PptxChartSeries,
	PptxElement,
} from 'pptx-viewer-core';

import { distributionRange } from './chart-distribution-range';
import type {
	ChartViewModel,
	PlotLayout,
	SvgCircle,
	SvgPolyline,
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

const DATA_LABEL_COLOR = '#334155';

export interface HistogramBin {
	value: number;
	label: string;
	sourceIndices: number[];
}

function binLabel(lower: number, upper: number, closed: 'l' | 'r'): string {
	return closed === 'r'
		? `(${formatAxisValue(lower)}, ${formatAxisValue(upper)}]`
		: `[${formatAxisValue(lower)}, ${formatAxisValue(upper)})`;
}

/** Bin raw observations according to ChartEx binning properties. */
export function computeHistogramBins(
	values: ReadonlyArray<number>,
	options: PptxChartHistogramOptions,
): HistogramBin[] {
	const closed = options.intervalClosed ?? 'l';
	const finite = values
		.map((value, sourceIndex) => ({ value, sourceIndex }))
		.filter((item) => Number.isFinite(item.value));
	if (finite.length === 0) {
		return [];
	}
	const underflow = typeof options.underflow === 'number' ? options.underflow : undefined;
	const overflow = typeof options.overflow === 'number' ? options.overflow : undefined;
	const under =
		underflow === undefined
			? []
			: finite.filter((item) =>
					closed === 'r' ? item.value <= underflow : item.value < underflow,
				);
	const over =
		overflow === undefined
			? []
			: finite.filter((item) => (closed === 'l' ? item.value >= overflow : item.value > overflow));
	const regular = finite.filter((item) => !under.includes(item) && !over.includes(item));
	const result: HistogramBin[] = [];
	if (underflow !== undefined) {
		result.push({
			value: under.length,
			label: `${closed === 'r' ? '≤' : '<'} ${formatAxisValue(underflow)}`,
			sourceIndices: under.map((item) => item.sourceIndex),
		});
	}
	if (regular.length > 0) {
		const min = Math.min(...regular.map((item) => item.value));
		const max = Math.max(...regular.map((item) => item.value));
		const requestedSize = options.binSize && options.binSize > 0 ? options.binSize : undefined;
		const requestedCount = options.binCount && options.binCount > 0 ? options.binCount : undefined;
		const start = requestedSize ? Math.floor(min / requestedSize) * requestedSize : min;
		const count = requestedSize
			? Math.max(
					closed === 'l'
						? Math.floor((max - start) / requestedSize) + 1
						: Math.ceil((max - start) / requestedSize),
					1,
				)
			: Math.max(requestedCount ?? Math.ceil(Math.sqrt(regular.length)), 1);
		const width = requestedSize ?? Math.max((max - start) / count, 1);
		const bins = Array.from({ length: count }, (_, index) => ({
			value: 0,
			label: binLabel(start + index * width, start + (index + 1) * width, closed),
			sourceIndices: [] as number[],
		}));
		for (const item of regular) {
			const rawIndex =
				closed === 'r'
					? Math.ceil((item.value - start) / width) - 1
					: Math.floor((item.value - start) / width);
			const index = Math.max(0, Math.min(rawIndex, bins.length - 1));
			bins[index].value += 1;
			bins[index].sourceIndices.push(item.sourceIndex);
		}
		result.push(...bins);
	}
	if (overflow !== undefined) {
		result.push({
			value: over.length,
			label: `${closed === 'l' ? '≥' : '>'} ${formatAxisValue(overflow)}`,
			sourceIndices: over.map((item) => item.sourceIndex),
		});
	}
	return result;
}

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

function paretoPrimitives(
	values: ReadonlyArray<number>,
	layout: PlotLayout,
	series: PptxChartSeries,
	seriesIndex: number,
): SvgPrimitive[] {
	const total = values.reduce((sum, value) => sum + Math.max(value, 0), 0);
	if (total <= 0) {
		return [];
	}
	let cumulative = 0;
	const points = values.map((value, pointIndex) => {
		cumulative += Math.max(value, 0);
		return {
			x: layout.plotLeft + (layout.plotWidth * (pointIndex + 0.5)) / values.length,
			y: layout.plotBottom - (layout.plotHeight * cumulative) / total,
			pointIndex,
		};
	});
	const color = series.color ?? '#ED7D31';
	return [
		{
			kind: 'polyline',
			points: points.map((point) => `${point.x},${point.y}`).join(' '),
			stroke: color,
			strokeWidth: 2,
			fill: 'none',
			part: { role: 'series', seriesIndex },
		} satisfies SvgPolyline,
		...points.map(
			(point) =>
				({
					kind: 'circle',
					cx: point.x,
					cy: point.y,
					r: 2.5,
					fill: color,
					part: { role: 'dataPoint', seriesIndex, pointIndex: point.pointIndex },
				}) satisfies SvgCircle,
		),
	];
}

export function buildHistogramViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const layout = computePlotLayout(element.width, element.height, chartData, true);
	const histogramIndex = Math.max(
		chartData.series.findIndex((series) => series.histogramOptions?.layout !== 'pareto'),
		0,
	);
	const series = chartData.series[histogramIndex];
	const options = series?.histogramOptions;
	const bins = options ? computeHistogramBins(series?.values ?? [], options) : undefined;
	const values = bins?.map((bin) => bin.value) ?? series?.values ?? [];
	const labels = bins?.map((bin) => bin.label) ?? [...categoryLabels];
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
		(bar, pointIndex) =>
			({
				kind: 'rect',
				x: bar.x,
				y: bar.y,
				w: bar.w,
				h: bar.h,
				fill: bar.fill,
				opacity: 0.85,
				...(bins ? {} : { part: { role: 'dataPoint', seriesIndex: histogramIndex, pointIndex } }),
			}) satisfies SvgRect,
	);
	const paretoIndex = chartData.series.findIndex(
		(item) => item.histogramOptions?.layout === 'pareto',
	);
	if (paretoIndex >= 0) {
		primitives.push(
			...paretoPrimitives(values, layout, chartData.series[paretoIndex], paretoIndex),
		);
	}
	const dataLabels: SvgText[] = chartData.style?.hasDataLabels
		? bars.map((bar, index) => ({
				kind: 'text',
				x: bar.x + bar.w / 2,
				y: bar.y - 4,
				text: formatAxisValue(values[index]),
				fontSize: 7,
				fill: DATA_LABEL_COLOR,
				textAnchor: 'middle',
			}))
		: [];
	const { gridlines, axisLabels } = buildGridlinesAndLabels(range, layout);
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
		title: chartData.style?.hasTitle ? chartData.title : undefined,
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
	};
}
