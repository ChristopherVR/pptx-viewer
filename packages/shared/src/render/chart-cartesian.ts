/**
 * chart-cartesian.ts: enriched cartesian (bar / line / area / scatter / bubble)
 * chart view-model builder.
 *
 * Extracted from `chart-view-model.ts` to keep both files within the repo's
 * ~300-LOC limit and to host the richer cartesian features that the React/Vue
 * renderers carry but the original shared builder dropped:
 *
 *  - **log value axis**: `computeValueRangeForChart` + log-spaced gridlines via
 *    `buildPrimaryAxis` (reuses `chart-axis.ts` `generateLogTicks`).
 *  - **display units**: axis labels scaled + suffixed via `buildPrimaryAxis`.
 *  - **secondary value axis**: `splitSeriesByAxis` + a second `ValueRange`,
 *    right-side gridlines/labels via `buildSecondaryAxis`, secondary-mapped
 *    series plotted against the secondary range.
 *  - **percentStacked**: stacked bars/areas normalised so each category sums to
 *    100%, with in-bar percent labels.
 *  - **overlays**: trendlines / error bars / axis titles / data table from
 *    `chart-overlays.ts`.
 *
 * When none of these features is present the output is byte-identical to the
 * original linear single-axis builder (same primitives, gridlines, labels).
 *
 * @module chart-cartesian
 */
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import {
	computeLayoutOptions,
	computeValueRangeForAxis,
	computeValueRangeForChart,
	getSecondaryValueAxis,
	splitSeriesByAxis,
} from './chart-axis';
import { buildPrimaryAxis, buildSecondaryAxis } from './chart-axis-render';
import { buildBars } from './chart-cartesian-bars';
import { buildAreas, buildBubbles, buildLines, buildScatter } from './chart-cartesian-plots';
import type { SeriesPlotResult } from './chart-cartesian-plots';
import {
	computeAxisTitlePrimitives,
	computeDataTablePrimitives,
	computeErrorBarPrimitives,
	computeTrendlinePrimitives,
} from './chart-overlays';
import type {
	ChartValueDrag,
	ChartViewModel,
	PlotLayout,
	SupportedChartKind,
	SvgLine,
	SvgPrimitive,
	SvgText,
	ValueRange,
} from './chart-view-model';
import {
	buildCategoryLabels,
	buildGridlinesAndLabels,
	buildLegend,
	buildZeroLine,
	computePlotLayout,
	computeStackedValueRange,
} from './chart-view-model';

/** True when the chart declares any feature beyond the linear single-axis default. */
function hasRicherAxisFeatures(chartData: PptxChartData): boolean {
	const axes = chartData.axes;
	if (axes && axes.length > 0) {
		for (const a of axes) {
			if (
				a.axisType === 'valAx' &&
				(a.logScale ||
					a.displayUnits ||
					a.axPos === 'r' ||
					a.orientation === 'maxMin' ||
					a.majorUnit !== undefined ||
					a.minorUnit !== undefined ||
					a.minorGridlines ||
					a.majorTickMark !== undefined ||
					a.minorTickMark !== undefined ||
					a.tickLblPos !== undefined)
			) {
				return true;
			}
		}
	}
	return Boolean(chartData.dataTable);
}

/** Resolve the primary value-axis formatting (non-right valAx, or first valAx). */
function findPrimaryValueAxis(chartData: PptxChartData) {
	const axes = chartData.axes;
	if (!axes) {
		return undefined;
	}
	return (
		axes.find((a) => a.axisType === 'valAx' && a.axPos !== 'r') ??
		axes.find((a) => a.axisType === 'valAx')
	);
}

interface AxisResult {
	gridlines: SvgLine[];
	axisLabels: SvgText[];
	secondaryGridlines: SvgLine[] | undefined;
	secondaryAxisLabels: SvgText[] | undefined;
}

/**
 * Build the value-axis range(s), gridlines, and labels for the cartesian chart.
 * Falls back to the original linear `buildGridlinesAndLabels` byte-for-byte when
 * the chart has no log/display-unit/secondary-axis features.
 */
function buildAxes(
	chartData: PptxChartData,
	layout: PlotLayout,
	primaryRange: ValueRange,
	secondaryRange: ValueRange | undefined,
): AxisResult {
	const richer = hasRicherAxisFeatures(chartData);
	if (!richer) {
		const { gridlines, axisLabels } = buildGridlinesAndLabels(primaryRange, layout);
		return { gridlines, axisLabels, secondaryGridlines: undefined, secondaryAxisLabels: undefined };
	}

	const primaryAxis = findPrimaryValueAxis(chartData);
	const { gridlines, axisLabels } = buildPrimaryAxis(primaryRange, layout, primaryAxis);

	let secondaryGridlines: SvgLine[] | undefined;
	let secondaryAxisLabels: SvgText[] | undefined;
	if (secondaryRange) {
		const secAxis = getSecondaryValueAxis(chartData.axes);
		const sec = buildSecondaryAxis(secondaryRange, layout, secAxis);
		secondaryGridlines = sec.gridlines;
		secondaryAxisLabels = sec.axisLabels;
	}

	return { gridlines, axisLabels, secondaryGridlines, secondaryAxisLabels };
}

/** Range for a stacked bar/area, normalised to 0..100 for percentStacked. */
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

	const axisRes = buildAxes(chartData, layout, primaryRange, secondaryRange);
	const zeroLine = primaryRange.logScale ? undefined : buildZeroLine(primaryRange, layout);
	const catAxisStyle =
		kind === 'line' || kind === 'area' || kind === 'scatter' || kind === 'bubble' ? 'line' : 'bar';
	const catLabels = buildCategoryLabels(categoryLabels, layout, catAxisStyle);

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
		);
	} else if (kind === 'line') {
		plot = buildLines(chartData, catCount, layout, primaryRange, secondaryRange, secondaryIdx);
	} else if (kind === 'area') {
		plot = buildAreas(chartData, catCount, layout, primaryRange);
	} else if (kind === 'scatter') {
		plot = buildScatter(chartData, layout, primaryRange);
	} else {
		plot = buildBubbles(chartData, layout, primaryRange);
	}

	const primitives: SvgPrimitive[] = [...plot.primitives];

	// Overlays (depth): regression trendlines, error bars, axis titles, data table.
	const overlays: SvgPrimitive[] = [
		...computeTrendlinePrimitives(
			chartData,
			catCount,
			layout,
			primaryRange,
			catAxisStyle,
			chartData.colorPalette,
		),
		...computeErrorBarPrimitives(chartData, catCount, layout, primaryRange, catAxisStyle),
		...computeAxisTitlePrimitives(chartData, layout),
	];
	const dataTablePrims = computeDataTablePrimitives(chartData, layout, chartData.colorPalette);

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
		categoryLabels: catLabels,
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
