import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import { resolveChartTitleText } from './chart-auto-title';
import {
	computeLayoutOptions,
	computeValueRangeForAxis,
	getPrimaryValueAxisId,
	getSecondaryValueAxis,
	splitSeriesByAxis,
} from './chart-axis';
import { verticalAxisX } from './chart-axis-crossing';
import { buildPrimaryAxis, buildSecondaryAxis } from './chart-axis-render';
import {
	appendComboBarClusterLabels,
	computeComboBarCluster,
	groupComboSeriesIndices,
} from './chart-combo-classify';
import { appendLineSeries } from './chart-combo-series';
import { computeDataTablePrimitives } from './chart-data-table-render';
import { computeErrorBarPrimitives } from './chart-error-bars';
import { shouldRenderMajorGridlines } from './chart-gridlines-toggle';
import { computeHelperLinePrimitives } from './chart-helper-lines';
import { buildCartesianHorizontalAxis } from './chart-horizontal-axis';
import type { LegendSwatchKind } from './chart-legend-swatch';
import { computeAxisTitlePrimitives, computeTrendlinePrimitives } from './chart-overlays';
import type {
	ChartViewModel,
	PlotLayout,
	SvgPrimitive,
	SvgText,
	ValueRange,
} from './chart-view-model';
import {
	buildGridlinesAndLabels,
	buildLegend,
	buildZeroLine,
	computePlotLayout,
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
	const primaryRange = computeValueRangeForAxis(primarySeries, primaryAxis, layout.autoPlotHeight);
	const secondaryRange =
		secondary.length > 0
			? computeValueRangeForAxis(
					secondary.map((entry) => entry.series),
					secondaryAxisFormatting,
					layout.autoPlotHeight,
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
	const showMajorGridlines = shouldRenderMajorGridlines(chartData);
	const primaryRendered =
		primaryCategoryAxis?.crosses !== undefined || primaryCategoryAxis?.crossesAt !== undefined
			? buildPrimaryAxis(primaryRange, layout, primaryAxis, primaryAxisX, showMajorGridlines)
			: buildGridlinesAndLabels(primaryRange, layout, showMajorGridlines);
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
	// Which lane (bar rect vs. line+marker) each series renders in: its own
	// `seriesChartType` tag when the combo's source XML carries one, or the
	// legacy "series 0 is the bar, everything else is a line" guess when it
	// doesn't (see chart-combo-classify.ts). The legend swatch follows the
	// same split.
	const { barIndices, lineIndices } = groupComboSeriesIndices(chartData.series);
	const barIndexSet = new Set(barIndices);
	const comboSwatchKinds: LegendSwatchKind[] = chartData.series.map((_s, i) =>
		barIndexSet.has(i) ? 'rect' : 'line',
	);
	const { legend, legendX, legendY, legendAnchor } = buildLegend(
		chartData.series,
		chartData.colorPalette,
		layout.svgWidth,
		legendPos,
		layout.svgHeight,
		layout.plotTop,
		comboSwatchKinds,
	);
	const primitives: SvgPrimitive[] = [];
	const dataLabels: SvgText[] = [];

	// Drop / hi-low / up-down helper lines, drawn behind the combo marks.
	const helperOpts = { mode: 'line' as const, xPositions: horizontalAxis.xPositions };
	primitives.push(
		...computeHelperLinePrimitives(chartData, layout, primaryRange, catCount, helperOpts),
	);

	primitives.push(
		...computeComboBarCluster(
			barIndices,
			chartData,
			catCount,
			layout,
			primaryRange,
			secondaryRange,
			secondaryIndexes,
			sourceIndices,
			horizontalAxis.xPositions,
		),
	);
	appendComboBarClusterLabels(
		barIndices,
		chartData,
		layout,
		catCount,
		primaryRange,
		secondaryRange,
		secondaryIndexes,
		sourceIndices,
		dataLabels,
		horizontalAxis.xPositions,
	);

	const barGroupWidth = layout.plotWidth / catCount;
	for (const seriesIndex of lineIndices) {
		const series = chartData.series[seriesIndex];
		const range = rangeForSeries(seriesIndex, primaryRange, secondaryRange, secondaryIndexes);
		appendLineSeries(
			series,
			seriesIndex,
			chartData,
			layout,
			range,
			barGroupWidth,
			sourceIndices,
			primitives,
			dataLabels,
			horizontalAxis.xPositions,
		);
	}
	primitives.push(...horizontalAxis.tickMarks);
	const displayChartData = horizontalAxis.displayChartData;
	// Overlay depth. Error bars were already here; trendlines, axis titles and
	// the data-table block were not, even though `computeLayoutOptions` above
	// reserves the table's strip, so the space was cleared and left blank.
	const overlays: SvgPrimitive[] = [
		...computeErrorBarPrimitives(displayChartData, catCount, layout, primaryRange, 'line', {
			xPositions: horizontalAxis.xPositions,
			seriesRanges: chartData.series.map((_series, index) =>
				rangeForSeries(index, primaryRange, secondaryRange, secondaryIndexes),
			),
			seriesModes: chartData.series.map((_series, index) =>
				barIndexSet.has(index) ? 'bar' : 'line',
			),
		}),
		...computeTrendlinePrimitives(
			displayChartData,
			catCount,
			layout,
			primaryRange,
			'bar',
			chartData.colorPalette,
		),
		...computeAxisTitlePrimitives(chartData, layout),
	];
	const dataTablePrimitives = computeDataTablePrimitives(
		displayChartData,
		layout,
		chartData.colorPalette,
	);
	primitives.push(...overlays, ...dataTablePrimitives);

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title: resolveChartTitleText(chartData),
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
		overlays: overlays.length > 0 ? overlays : undefined,
		dataTable: dataTablePrimitives.length > 0 ? dataTablePrimitives : undefined,
	};
}
