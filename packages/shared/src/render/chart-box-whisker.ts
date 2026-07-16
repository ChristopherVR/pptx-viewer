import type { PptxChartBoxWhiskerOptions, PptxChartData, PptxElement } from 'pptx-viewer-core';

import { computeBoxStats } from './chart-box-whisker-stats';
import type { BoxStats } from './chart-box-whisker-stats';
import { distributionRange } from './chart-distribution-range';
import type {
	ChartViewModel,
	LegendEntry,
	PlotLayout,
	SvgCircle,
	SvgLine,
	SvgPrimitive,
	SvgRect,
	ValueRange,
} from './chart-view-model';
import {
	buildCategoryLabels,
	buildGridlinesAndLabels,
	buildLegend,
	buildZeroLine,
	computePlotLayout,
	paletteColor,
	valueToY,
} from './chart-view-model';

const WHISKER_COLOR = '#64748b';
const MEDIAN_COLOR = '#1e293b';

interface BoxPoint {
	x: number;
	y: number;
	seriesIndex: number;
	outlier: boolean;
}

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
	yMean: number;
	fill: string;
	points: BoxPoint[];
}

export function computeBoxWhiskerGeometry(
	chartData: PptxChartData,
	catCount: number,
	layout: PlotLayout,
	range: ValueRange,
	colorPalette: readonly string[] | undefined,
): BoxWhiskerGeometry[] {
	const groupWidth = layout.plotWidth / catCount;
	const boxW = groupWidth * 0.5;
	const options = chartData.series.find((series) => series.boxWhiskerOptions)?.boxWhiskerOptions;
	const method = options ? (options.quartileMethod ?? 'exclusive') : undefined;
	const output: BoxWhiskerGeometry[] = [];
	for (let categoryIndex = 0; categoryIndex < catCount; categoryIndex++) {
		const observations = chartData.series
			.map((series, seriesIndex) => ({ value: series.values[categoryIndex], seriesIndex }))
			.filter((item): item is { value: number; seriesIndex: number } => item.value !== undefined);
		const stats = computeBoxStats(
			observations.map((item) => item.value),
			method,
		);
		if (!stats) {
			continue;
		}
		const iqr = stats.q3 - stats.q1;
		const lowerFence = stats.q1 - 1.5 * iqr;
		const upperFence = stats.q3 + 1.5 * iqr;
		const inliers = observations.filter(
			(item) => !options || (item.value >= lowerFence && item.value <= upperFence),
		);
		const whiskerMin = Math.min(...inliers.map((item) => item.value));
		const whiskerMax = Math.max(...inliers.map((item) => item.value));
		const boxX = layout.plotLeft + groupWidth * categoryIndex + (groupWidth - boxW) / 2;
		const mean = observations.reduce((sum, item) => sum + item.value, 0) / observations.length;
		output.push({
			stats,
			boxX,
			boxW,
			xMid: boxX + boxW / 2,
			yMin: valueToY(whiskerMin, range, layout.plotTop, layout.plotBottom),
			yMax: valueToY(whiskerMax, range, layout.plotTop, layout.plotBottom),
			yQ1: valueToY(stats.q1, range, layout.plotTop, layout.plotBottom),
			yQ3: valueToY(stats.q3, range, layout.plotTop, layout.plotBottom),
			yMed: valueToY(stats.median, range, layout.plotTop, layout.plotBottom),
			yMean: valueToY(mean, range, layout.plotTop, layout.plotBottom),
			fill: paletteColor(categoryIndex, colorPalette),
			points: observations.map((item, index) => ({
				x: boxX + boxW * (0.2 + (0.6 * (index + 1)) / (observations.length + 1)),
				y: valueToY(item.value, range, layout.plotTop, layout.plotBottom),
				seriesIndex: item.seriesIndex,
				outlier: item.value < whiskerMin || item.value > whiskerMax,
			})),
		});
	}
	return output;
}

function whiskerPrimitives(geometry: BoxWhiskerGeometry): SvgPrimitive[] {
	const g = geometry;
	return [
		{
			kind: 'line',
			x1: g.xMid,
			y1: g.yMax,
			x2: g.xMid,
			y2: g.yQ3,
			stroke: WHISKER_COLOR,
			strokeWidth: 1,
		},
		{
			kind: 'line',
			x1: g.xMid,
			y1: g.yQ1,
			x2: g.xMid,
			y2: g.yMin,
			stroke: WHISKER_COLOR,
			strokeWidth: 1,
		},
		{
			kind: 'line',
			x1: g.boxX + g.boxW * 0.25,
			y1: g.yMax,
			x2: g.boxX + g.boxW * 0.75,
			y2: g.yMax,
			stroke: WHISKER_COLOR,
			strokeWidth: 1,
		},
		{
			kind: 'line',
			x1: g.boxX + g.boxW * 0.25,
			y1: g.yMin,
			x2: g.boxX + g.boxW * 0.75,
			y2: g.yMin,
			stroke: WHISKER_COLOR,
			strokeWidth: 1,
		},
		{
			kind: 'rect',
			x: g.boxX,
			y: Math.min(g.yQ1, g.yQ3),
			w: g.boxW,
			h: Math.abs(g.yQ1 - g.yQ3),
			fill: g.fill,
			rx: 1,
			opacity: 0.8,
		},
		{
			kind: 'line',
			x1: g.boxX,
			y1: g.yMed,
			x2: g.boxX + g.boxW,
			y2: g.yMed,
			stroke: MEDIAN_COLOR,
			strokeWidth: 2,
		},
	] satisfies Array<SvgLine | SvgRect>;
}

function optionPrimitives(
	geometry: BoxWhiskerGeometry,
	options: PptxChartBoxWhiskerOptions | undefined,
	categoryIndex: number,
): SvgPrimitive[] {
	if (!options) {
		return [];
	}
	const output: SvgPrimitive[] = [];
	if (options.showMeanLine) {
		output.push({
			kind: 'line',
			x1: geometry.boxX,
			y1: geometry.yMean,
			x2: geometry.boxX + geometry.boxW,
			y2: geometry.yMean,
			stroke: '#0f766e',
			strokeWidth: 1.5,
		} satisfies SvgLine);
	}
	if (options.showMeanMarker) {
		output.push({
			kind: 'circle',
			cx: geometry.xMid,
			cy: geometry.yMean,
			r: 3,
			fill: '#0f766e',
		} satisfies SvgCircle);
	}
	for (const point of geometry.points) {
		if (
			(point.outlier && !options.showOutlierPoints) ||
			(!point.outlier && !options.showInnerPoints)
		) {
			continue;
		}
		output.push({
			kind: 'circle',
			cx: point.x,
			cy: point.y,
			r: 2.25,
			fill: point.outlier ? '#dc2626' : MEDIAN_COLOR,
			part: { role: 'dataPoint', seriesIndex: point.seriesIndex, pointIndex: categoryIndex },
		} satisfies SvgCircle);
	}
	return output;
}

export function buildBoxWhiskerViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const layout = computePlotLayout(element.width, element.height, chartData, true);
	const range = distributionRange(chartData.series);
	const options = chartData.series.find((series) => series.boxWhiskerOptions)?.boxWhiskerOptions;
	const geometries = computeBoxWhiskerGeometry(
		chartData,
		Math.max(categoryLabels.length, 1),
		layout,
		range,
		chartData.colorPalette,
	);
	const primitives = geometries.flatMap((geometry, index) => [
		...whiskerPrimitives(geometry),
		...optionPrimitives(geometry, options, index),
	]);
	const { gridlines, axisLabels } = buildGridlinesAndLabels(range, layout);
	const { legend, legendX, legendY, legendAnchor } = buildLegend(
		chartData.series,
		chartData.colorPalette,
		layout.svgWidth,
		chartData.style?.legendPosition ?? 'b',
		layout.svgHeight,
		layout.plotTop,
	);
	const categoryLegend: LegendEntry[] = categoryLabels.map((label, index) => ({
		color: paletteColor(index, chartData.colorPalette),
		label,
	}));
	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title: chartData.style?.hasTitle ? chartData.title : undefined,
		titleX: layout.svgWidth / 2,
		titleY: 12,
		gridlines,
		axisLabels,
		zeroLine: buildZeroLine(range, layout),
		categoryLabels: buildCategoryLabels(categoryLabels, layout, 'bar'),
		primitives,
		dataLabels: [],
		legend: chartData.style?.hasLegend ? (categoryLegend.length ? categoryLegend : legend) : [],
		legendX,
		legendY,
		legendAnchor,
	};
}
