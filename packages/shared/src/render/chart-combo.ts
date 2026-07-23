import type { PptxChartData, PptxChartSeries, PptxElement } from 'pptx-viewer-core';

import {
	computeLayoutOptions,
	computeValueRangeForAxis,
	getPrimaryValueAxisId,
	getSecondaryValueAxis,
	splitSeriesByAxis,
} from './chart-axis';
import { verticalAxisX } from './chart-axis-crossing';
import { buildPrimaryAxis, buildSecondaryAxis } from './chart-axis-render';
import { computeErrorBarPrimitives } from './chart-error-bars';
import { computeHelperLinePrimitives } from './chart-helper-lines';
import { buildCartesianHorizontalAxis } from './chart-horizontal-axis';
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
	buildGridlinesAndLabels,
	buildLegend,
	buildZeroLine,
	computeBarRects,
	computePlotLayout,
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
	const primaryAxisId = getPrimaryValueAxisId(chartData.axes);
	const primaryAxis = chartData.axes?.find((axis) => axis.axisId === primaryAxisId);
	const secondaryAxisFormatting = getSecondaryValueAxis(chartData.axes);
	const primaryRange = computeValueRangeForAxis(primarySeries, primaryAxis);
	const secondaryRange =
		secondary.length > 0
			? computeValueRangeForAxis(
					secondary.map((entry) => entry.series),
					secondaryAxisFormatting,
				)
			: undefined;

	const primaryCategoryAxis = chartData.axes?.find(
		(axis) =>
			(axis.axisType === 'catAx' || axis.axisType === 'dateAx') &&
			axis.axisId === primaryAxis?.crossAxisId,
	);
	const primaryAxisX = verticalAxisX(
		primaryCategoryAxis,
		catCount,
		layout,
		'left',
		chartData.dateCategories?.values,
	);
	const primaryRendered =
		primaryCategoryAxis?.crosses !== undefined || primaryCategoryAxis?.crossesAt !== undefined
			? buildPrimaryAxis(primaryRange, layout, primaryAxis, primaryAxisX)
			: buildGridlinesAndLabels(primaryRange, layout);
	const { gridlines, axisLabels } = primaryRendered;
	const secondaryCategoryAxis = chartData.axes?.find(
		(axis) =>
			(axis.axisType === 'catAx' || axis.axisType === 'dateAx') &&
			axis.axisId === secondaryAxisFormatting?.crossAxisId,
	);
	const secondaryAxis = secondaryRange
		? buildSecondaryAxis(
				secondaryRange,
				layout,
				secondaryAxisFormatting,
				verticalAxisX(
					secondaryCategoryAxis,
					catCount,
					layout,
					'right',
					chartData.dateCategories?.values,
				),
			)
		: undefined;
	const zeroLine = primaryRange.logScale ? undefined : buildZeroLine(primaryRange, layout);
	const horizontalAxis = buildCartesianHorizontalAxis(
		chartData,
		categoryLabels,
		layout,
		'combo',
		primaryRange,
		secondaryRange,
	);
	const sourceIndices = horizontalAxis.sourceIndices;
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

	// Drop / hi-low / up-down helper lines, drawn behind the combo marks.
	const helperOpts = { mode: 'line' as const, xPositions: horizontalAxis.xPositions };
	primitives.push(
		...computeHelperLinePrimitives(chartData, layout, primaryRange, catCount, helperOpts),
	);

	const barSeries = chartData.series.slice(0, 1);
	if (barSeries[0]) {
		const barRange = rangeForSeries(0, primaryRange, secondaryRange, secondaryIndexes);
		const displayBarSeries = [
			{ ...barSeries[0], values: sourceIndices.map((index) => barSeries[0].values[index] ?? 0) },
		];
		primitives.push(
			...computeBarRects(displayBarSeries, catCount, layout, barRange, chartData.colorPalette).map(
				(rect, displayIndex) => ({
					kind: 'rect' as const,
					x: horizontalAxis.xPositions
						? (horizontalAxis.xPositions[displayIndex] ?? rect.x) - rect.w / 2
						: rect.x,
					y: rect.y,
					w: rect.w,
					h: rect.h,
					fill: rect.fill,
					rx: 1,
					part: {
						role: 'dataPoint' as const,
						seriesIndex: 0,
						pointIndex: sourceIndices[displayIndex] ?? displayIndex,
					},
				}),
			),
		);
		appendBarLabels(
			barSeries[0],
			chartData,
			layout,
			catCount,
			barRange,
			sourceIndices,
			dataLabels,
			horizontalAxis.xPositions,
		);
	}

	const barGroupWidth = layout.plotWidth / catCount;
	chartData.series.slice(1).forEach((series, offset) => {
		const seriesIndex = offset + 1;
		if (series.values.length === 0) {
			return;
		}
		const range = rangeForSeries(seriesIndex, primaryRange, secondaryRange, secondaryIndexes);
		const fill = seriesColor(series, seriesIndex, chartData.colorPalette);
		const points = sourceIndices.map((sourceIndex, displayIndex) => {
			const value = series.values[sourceIndex] ?? 0;
			return {
				x:
					horizontalAxis.xPositions?.[displayIndex] ??
					layout.plotLeft + barGroupWidth * displayIndex + barGroupWidth / 2,
				y: valueToY(value, range, layout.plotTop, layout.plotBottom),
				sourceIndex,
				value,
			};
		});
		primitives.push({
			kind: 'polyline',
			points: points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '),
			stroke: fill,
			strokeWidth: 2.4,
			fill: 'none',
		} satisfies SvgPolyline);
		primitives.push(
			...points.map(
				(point) =>
					({
						kind: 'circle',
						cx: point.x,
						cy: point.y,
						r: 2.5,
						fill,
						part: { role: 'dataPoint', seriesIndex, pointIndex: point.sourceIndex },
					}) satisfies SvgCircle,
			),
		);
		if (chartData.style?.hasDataLabels) {
			points.forEach((point) => {
				if (point) {
					dataLabels.push({
						kind: 'text',
						x: point.x,
						y: point.y - 7,
						text: formatAxisValue(point.value),
						fontSize: 7,
						fill: '#334155',
						textAnchor: 'middle',
					});
				}
			});
		}
	});
	primitives.push(...horizontalAxis.tickMarks);
	const displayChartData = horizontalAxis.displayChartData;
	primitives.push(
		...computeErrorBarPrimitives(displayChartData, catCount, layout, primaryRange, 'line', {
			xPositions: horizontalAxis.xPositions,
			seriesRanges: chartData.series.map((_series, index) =>
				rangeForSeries(index, primaryRange, secondaryRange, secondaryIndexes),
			),
			seriesModes: chartData.series.map((_series, index) => (index === 0 ? 'bar' : 'line')),
		}),
	);

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title: chartData.style?.hasTitle && chartData.title ? chartData.title : undefined,
		titleX: layout.svgWidth / 2,
		titleY: 12,
		gridlines,
		axisLabels,
		zeroLine,
		categoryLabels: horizontalAxis.labels,
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
	sourceIndices: ReadonlyArray<number>,
	labels: SvgText[],
	xPositions?: ReadonlyArray<number>,
): void {
	if (!chartData.style?.hasDataLabels) {
		return;
	}
	const groupWidth = layout.plotWidth / catCount;
	const barWidth = groupWidth * 0.7;
	const offset = (groupWidth - barWidth) / 2;
	sourceIndices.forEach((sourceIndex, displayIndex) => {
		const value = series.values[sourceIndex] ?? 0;
		const zeroY = valueToY(0, range, layout.plotTop, layout.plotBottom);
		const valueY = valueToY(value, range, layout.plotTop, layout.plotBottom);
		labels.push({
			kind: 'text',
			x:
				xPositions?.[displayIndex] ??
				layout.plotLeft + groupWidth * displayIndex + offset + barWidth / 2,
			y: value >= 0 ? Math.min(zeroY, valueY) - 4 : Math.max(zeroY, valueY) + 10,
			text: formatAxisValue(value),
			fontSize: 7,
			fill: '#334155',
			textAnchor: 'middle',
		});
	});
}
