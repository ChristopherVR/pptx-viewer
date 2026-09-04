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
import { buildAreas } from './chart-cartesian-area';
import { buildCartesianAxes } from './chart-cartesian-axes';
import { buildBars } from './chart-cartesian-bars';
import { buildBubbles } from './chart-cartesian-bubbles';
import { buildLines } from './chart-cartesian-line-area';
import { buildScatter } from './chart-cartesian-plots';
import type { SeriesPlotResult } from './chart-cartesian-plots';
import { computeDataTablePrimitives } from './chart-data-table-render';
import { computeHelperLinePrimitives } from './chart-helper-lines';
import { buildCartesianHorizontalAxis } from './chart-horizontal-axis';
import { buildHorizontalBarViewModel } from './chart-horizontal-bars';
import {
	computeAxisTitlePrimitives,
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
	// `c:barDir val="bar"`: PowerPoint's horizontal Bar chart is the transpose
	// of this column-oriented engine, so it gets its own dedicated builder.
	if (kind === 'bar' && chartData.barDirection === 'bar') {
		return buildHorizontalBarViewModel(element, chartData, categoryLabels);
	}
	const seriesCount = chartData.series.length;
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const layoutOpts = computeLayoutOptions(chartData.axes, chartData.dataTable, seriesCount);
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const layout = computePlotLayout(element.width, element.height, chartData, true, layoutOpts);
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const catCount = Math.max(categoryLabels.length, 1);

	// Stacking applies to bar, line and area (`GROUPING_SUPPORTED_TYPES` in
	// chart-editor-options.ts, and lineChart/areaChart both parse a real
	// `c:grouping`): a stacked or percentStacked line/area chart must render
	// running-sum geometry and go static (no value-drag) the same way stacked
	// bar segments do, not silently fall back to clustered/draggable.
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const isStacked =
		(kind === 'bar' || kind === 'line' || kind === 'area') &&
		(chartData.grouping === 'stacked' || chartData.grouping === 'percentStacked');
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const isPercent = isStacked && chartData.grouping === 'percentStacked';

	// Split series across primary/secondary value axes (clustered cartesian only).
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const { secondary } = splitSeriesByAxis(chartData.series, chartData.axes);
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const secondaryIdx = new Set<number>(secondary.map((e) => e.index));
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const useSecondary = !isStacked && secondaryIdx.size > 0;
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const primaryPlotSeries = useSecondary
		? chartData.series.filter((_s, i) => !secondaryIdx.has(i))
		: chartData.series;
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const secondaryPlotSeries = useSecondary
		? chartData.series.filter((_s, i) => secondaryIdx.has(i))
		: [];

	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const primaryAxis = chartData.axes?.find(
		(axis) => axis.axisType === 'valAx' && axis.axPos !== 'r',
	);
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const primaryRange = isStacked
		? {
				...stackedRange(chartData, catCount, isPercent),
				...(primaryAxis?.orientation === 'maxMin' ? { reverseOrder: true } : {}),
			}
		: computeValueRangeForChart(
				primaryPlotSeries.length > 0 ? primaryPlotSeries : chartData.series,
				chartData.axes,
			);
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const secondaryRange =
		useSecondary && secondaryPlotSeries.length > 0
			? computeValueRangeForAxis(
					secondaryPlotSeries,
					chartData.axes?.find((axis) => axis.axisType === 'valAx' && axis.axPos === 'r'),
				)
			: undefined;

	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const axisRes = buildCartesianAxes(chartData, layout, primaryRange, secondaryRange, catCount);
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const zeroLine = primaryRange.logScale ? undefined : buildZeroLine(primaryRange, layout);
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const horizontalAxis = buildCartesianHorizontalAxis(
		chartData,
		categoryLabels,
		layout,
		kind,
		primaryRange,
		secondaryRange,
	);
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const { catAxisStyle, sourceIndices, displayChartData } = horizontalAxis;

	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const legendPos = chartData.style?.legendPosition ?? 'b';
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
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
			isStacked ? (isPercent ? 'percentStacked' : 'stacked') : 'clustered',
		);
	} else if (kind === 'area') {
		plot = buildAreas(
			chartData,
			catCount,
			layout,
			primaryRange,
			sourceIndices,
			horizontalAxis.xPositions,
			isStacked ? (isPercent ? 'percentStacked' : 'stacked') : 'clustered',
		);
	} else if (kind === 'scatter') {
		plot = buildScatter(chartData, layout, primaryRange);
	} else {
		plot = buildBubbles(chartData, layout, primaryRange);
	}

	// Drop lines / hi-low lines / up-down bars (line + area kinds). Drawn behind
	// the series marks so the data stays legible on top.
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const helperLines =
		kind === 'line' || kind === 'area'
			? computeHelperLinePrimitives(chartData, layout, primaryRange, catCount, {
					mode: 'line',
					xPositions: horizontalAxis.xPositions,
				})
			: [];

	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const primitives: SvgPrimitive[] = [
		...helperLines,
		...plot.primitives,
		...horizontalAxis.tickMarks,
	];

	// Overlays (depth): regression trendlines, error bars, axis titles, data table.
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
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
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const dataTablePrims = computeDataTablePrimitives(
		displayChartData,
		layout,
		chartData.colorPalette,
	);

	primitives.push(...overlays, ...dataTablePrims);

	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
	const title = chartData.style?.hasTitle && chartData.title ? chartData.title : undefined;

	// Vertical drag-to-value only has a single-value meaning for un-stacked marks:
	// stacked/percentStacked bar segments sit on running sums, so dragging one
	// would not track the pointer.
	// eslint-disable-next-line one-var -- pre-existing, unrelated to this change
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
