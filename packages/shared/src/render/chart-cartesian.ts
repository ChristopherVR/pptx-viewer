/**
 * chart-cartesian.ts: enriched cartesian (bar / line / area / scatter / bubble)
 * chart view-model builder.
 *
 * Shared cartesian rendering covers value axes, category axes, secondary axes,
 * stacking, interaction metadata, and overlays.
 *
 * @module chart-cartesian
 */
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import {
	computeLayoutOptions,
	computeValueRangeForAxis,
	computeValueRangeForChart,
	splitSeriesByAxis,
} from './chart-axis';
import { buildCartesianAxes } from './chart-cartesian-axes';
import { buildBars } from './chart-cartesian-bars';
import { buildAreas, buildBubbles, buildLines, buildScatter } from './chart-cartesian-plots';
import type { SeriesPlotResult } from './chart-cartesian-plots';
import { computeHelperLinePrimitives } from './chart-helper-lines';
import { buildCartesianHorizontalAxis } from './chart-horizontal-axis';
import {
	computeAxisTitlePrimitives,
	computeDataTablePrimitives,
	computeErrorBarPrimitives,
	computeTrendlinePrimitives,
} from './chart-overlays';
import type {
	ChartValueDrag,
	ChartViewModel,
	SupportedChartKind,
	SvgPrimitive,
	ValueRange,
} from './chart-view-model';
import {
	buildLegend,
	buildZeroLine,
	computePlotLayout,
	computeStackedValueRange,
} from './chart-view-model';

function stackedRange(chartData: PptxChartData, catCount: number, isPercent: boolean): ValueRange {
	if (isPercent) {
		return { min: 0, max: 100, span: 100 };
	}
	return computeStackedValueRange(chartData.series, catCount);
}

/**
 * Build the enriched cartesian view-model for bar / line / area / scatter /
 * bubble charts. Honours log axes, display units, secondary value axes,
 * percentStacked normalisation, and overlay/data-table depth, while staying
 * byte-identical to the original builder when none of those features is present.
 */
export function buildCartesianViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
	kind: SupportedChartKind,
): ChartViewModel {
	const seriesCount = chartData.series.length;
	const layoutOpts = computeLayoutOptions(chartData.axes, chartData.dataTable, seriesCount);
	const layout = computePlotLayout(element.width, element.height, chartData, true, layoutOpts);
	const catCount = Math.max(categoryLabels.length, 1);

	const isStacked =
		kind === 'bar' && (chartData.grouping === 'stacked' || chartData.grouping === 'percentStacked');
	const isPercent = isStacked && chartData.grouping === 'percentStacked';

	// Split series across primary/secondary value axes (clustered cartesian only).
	const { secondary } = splitSeriesByAxis(chartData.series, chartData.axes);
	const secondaryIdx = new Set<number>(secondary.map((e) => e.index));
	const useSecondary = !isStacked && secondaryIdx.size > 0;
	const primaryPlotSeries = useSecondary
		? chartData.series.filter((_s, i) => !secondaryIdx.has(i))
		: chartData.series;
	const secondaryPlotSeries = useSecondary
		? chartData.series.filter((_s, i) => secondaryIdx.has(i))
		: [];

	const primaryAxis = chartData.axes?.find(
		(axis) => axis.axisType === 'valAx' && axis.axPos !== 'r',
	);
	const primaryRange = isStacked
		? {
				...stackedRange(chartData, catCount, isPercent),
				...(primaryAxis?.orientation === 'maxMin' ? { reverseOrder: true } : {}),
			}
		: computeValueRangeForChart(
				primaryPlotSeries.length > 0 ? primaryPlotSeries : chartData.series,
				chartData.axes,
			);
	const secondaryRange =
		useSecondary && secondaryPlotSeries.length > 0
			? computeValueRangeForAxis(
					secondaryPlotSeries,
					chartData.axes?.find((axis) => axis.axisType === 'valAx' && axis.axPos === 'r'),
				)
			: undefined;

	const axisRes = buildCartesianAxes(chartData, layout, primaryRange, secondaryRange, catCount);
	const zeroLine = primaryRange.logScale ? undefined : buildZeroLine(primaryRange, layout);
	const horizontalAxis = buildCartesianHorizontalAxis(
		chartData,
		categoryLabels,
		layout,
		kind,
		primaryRange,
		secondaryRange,
	);
	const { catAxisStyle, sourceIndices, displayChartData } = horizontalAxis;

	const legendPos = chartData.style?.legendPosition ?? 'b';
	const { legend, legendX, legendY, legendAnchor } = buildLegend(
		chartData.series,
		chartData.colorPalette,
		layout.svgWidth,
		legendPos,
		layout.svgHeight,
		layout.plotTop,
	);

	let plot: SeriesPlotResult;
	if (kind === 'bar') {
		plot = buildBars(
			chartData,
			catCount,
			layout,
			primaryRange,
			secondaryRange,
			secondaryIdx,
			isStacked ? (isPercent ? 'percentStacked' : 'stacked') : 'clustered',
			sourceIndices,
		);
	} else if (kind === 'line') {
		plot = buildLines(
			chartData,
			catCount,
			layout,
			primaryRange,
			secondaryRange,
			secondaryIdx,
			sourceIndices,
			horizontalAxis.xPositions,
		);
	} else if (kind === 'area') {
		plot = buildAreas(
			chartData,
			catCount,
			layout,
			primaryRange,
			sourceIndices,
			horizontalAxis.xPositions,
		);
	} else if (kind === 'scatter') {
		plot = buildScatter(chartData, layout, primaryRange);
	} else {
		plot = buildBubbles(chartData, layout, primaryRange);
	}

	// Drop lines / hi-low lines / up-down bars (line + area kinds). Drawn behind
	// the series marks so the data stays legible on top.
	const helperLines =
		kind === 'line' || kind === 'area'
			? computeHelperLinePrimitives(chartData, layout, primaryRange, catCount, {
					mode: 'line',
					xPositions: horizontalAxis.xPositions,
				})
			: [];

	const primitives: SvgPrimitive[] = [
		...helperLines,
		...plot.primitives,
		...horizontalAxis.tickMarks,
	];

	// Overlays (depth): regression trendlines, error bars, axis titles, data table.
	const overlays: SvgPrimitive[] = [
		...computeTrendlinePrimitives(
			displayChartData,
			catCount,
			layout,
			primaryRange,
			catAxisStyle,
			chartData.colorPalette,
		),
		...computeErrorBarPrimitives(displayChartData, catCount, layout, primaryRange, catAxisStyle),
		...computeAxisTitlePrimitives(chartData, layout),
	];
	const dataTablePrims = computeDataTablePrimitives(
		displayChartData,
		layout,
		chartData.colorPalette,
	);

	primitives.push(...overlays, ...dataTablePrims);

	const title = chartData.style?.hasTitle && chartData.title ? chartData.title : undefined;

	// Vertical drag-to-value only has a single-value meaning for un-stacked marks:
	// stacked/percentStacked bar segments sit on running sums, so dragging one
	// would not track the pointer.
	const valueDrag: ChartValueDrag | undefined = isStacked
		? undefined
		: {
				range: primaryRange,
				secondaryRange,
				secondarySeriesIndexes: useSecondary ? [...secondaryIdx] : undefined,
				plotTop: layout.plotTop,
				plotBottom: layout.plotBottom,
			};

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title,
		titleX: layout.svgWidth / 2,
		titleY: 12,
		gridlines: axisRes.gridlines,
		axisLabels: axisRes.axisLabels,
		zeroLine,
		categoryLabels: horizontalAxis.labels,
		primitives,
		dataLabels: plot.dataLabels,
		legend: chartData.style?.hasLegend ? legend : [],
		legendX,
		legendY,
		legendAnchor,
		secondaryGridlines: axisRes.secondaryGridlines,
		secondaryAxisLabels: axisRes.secondaryAxisLabels,
		overlays: overlays.length > 0 ? overlays : undefined,
		dataTable: dataTablePrims.length > 0 ? dataTablePrims : undefined,
		valueDrag,
	};
}
