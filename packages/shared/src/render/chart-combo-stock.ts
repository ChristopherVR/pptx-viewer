/**
 * View-model builders for combo and stock chart kinds.
 *
 * Ported from:
 *   packages/react/src/viewer/utils/chart-waterfall-combo.tsx  (renderComboChart)
 *   packages/react/src/viewer/utils/chart-stock.tsx             (renderStockChart)
 *
 * All functions here are pure TypeScript with zero Angular dependencies.
 * The component consumes a single `ChartViewModel` (same contract as the
 * helpers in chart-renderer-helpers.ts) that is the projection of a
 * `ChartPptxElement` -> SVG primitives.
 *
 * Combo charts:
 *   series[0]   → bar/column rectangles  (one per category)
 *   series[1…N] → line + dots            (one polyline + N circles per series)
 *
 * Stock charts (HLC / OHLC):
 *   3-series HLC  → series: High, Low, Close. A vertical hi-lo wick, no body,
 *     plus a short close tick (PowerPoint has no `c:upDownBars` on HLC).
 *   4-series OHLC → series: Open, High, Low, Close. The wick plus a candle
 *     body from open to close, filled from `c:upDownBars` (see
 *     `chart-stock-candles.ts`; never a hardcoded up/down colour).
 *
 * @module chart-combo-stock
 */

import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import { resolveChartTitleText } from './chart-auto-title';
import { computeLayoutOptions, computeValueRangeForChart } from './chart-axis';
import { verticalAxisX } from './chart-axis-crossing';
import { buildPrimaryAxis } from './chart-axis-render';
import { computeDataTablePrimitives } from './chart-data-table-render';
import { shouldRenderMajorGridlines } from './chart-gridlines-toggle';
import { computeDropLinePrimitives } from './chart-helper-lines';
import { buildCartesianHorizontalAxis } from './chart-horizontal-axis';
import {
	computeAxisTitlePrimitives,
	computeErrorBarPrimitives,
	computeTrendlinePrimitives,
} from './chart-overlays';
import { computeStockCandlePrimitives } from './chart-stock-candles';
import { buildStockCloseLabel } from './chart-stock-close-label';
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
	valueToY,
} from './chart-view-model';

export { buildComboViewModel } from './chart-combo';

// ─────────────────────────────────────────────────────────────────────────────
// Stock chart
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a `ChartViewModel` for a stock (HLC / OHLC) candlestick chart.
 *
 * Series layout convention (mirrors the React renderer):
 *   3-series: series[0] = High, series[1] = Low, series[2] = Close
 *   4-series: series[0] = Open, series[1] = High, series[2] = Low, series[3] = Close
 *
 * The wick/tick/body geometry itself lives in `chart-stock-candles.ts`
 * (shared with the price portion of a volume+stock combo); this builder only
 * resolves the series slots, axes, legend and overlay depth around it.
 *
 * @param element        - The chart element providing width/height.
 * @param chartData      - Parsed chart data including series and style.
 * @param categoryLabels - Ordered category axis labels.
 * @returns A fully assembled `ChartViewModel` ready for the template.
 */
export function buildStockViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const layout: PlotLayout = computePlotLayout(
		element.width,
		element.height,
		chartData,
		true,
		computeLayoutOptions(chartData.axes, chartData.dataTable, chartData.series.length),
	);
	const catCount = Math.max(categoryLabels.length, 1);

	// Through `computeValueRangeForChart`, not the bare linear helper: a stock
	// chart is as entitled to a log or display-unit value axis as any other
	// cartesian kind, and the bare helper silently ignores `c:scaling`.
	const range: ValueRange = computeValueRangeForChart(
		chartData.series,
		chartData.axes,
		layout.plotHeight,
	);

	const valueAxis = chartData.axes?.find((axis) => axis.axisType === 'valAx' && axis.axPos !== 'r');
	const categoryAxis = chartData.axes?.find(
		(axis) =>
			(axis.axisType === 'catAx' || axis.axisType === 'dateAx') &&
			axis.axisId === valueAxis?.crossAxisId,
	);
	const showMajorGridlines = shouldRenderMajorGridlines(chartData);
	const renderedAxis =
		categoryAxis?.crosses !== undefined || categoryAxis?.crossesAt !== undefined
			? buildPrimaryAxis(
					range,
					layout,
					valueAxis,
					verticalAxisX(categoryAxis, catCount, layout, 'left', chartData.dateCategories?.values),
					showMajorGridlines,
				)
			: buildGridlinesAndLabels(range, layout, showMajorGridlines);
	const { gridlines, axisLabels } = renderedAxis;
	const zeroLine = buildZeroLine(range, layout);
	const horizontalAxis = buildCartesianHorizontalAxis(
		chartData,
		categoryLabels,
		layout,
		'stock',
		range,
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

	// ── Resolve OHLC series slots ──────────────────────────────────────────
	const hasFour = chartData.series.length >= 4;
	const openSeries = hasFour ? chartData.series[0] : undefined;
	const highSeries = chartData.series[hasFour ? 1 : 0];
	const lowSeries = chartData.series[hasFour ? 2 : 1];
	const closeSeries = chartData.series[hasFour ? 3 : 2];

	const primitives: SvgPrimitive[] = [];
	const dataLabels: SvgText[] = [];

	// `c:dropLines` is independent of the wick/tick/body geometry below (which
	// already draws the hi-lo wick and any up/down body from `c:hiLowLines` /
	// `c:upDownBars` itself), so only drop lines need the generic helper here.
	primitives.push(
		...computeDropLinePrimitives(chartData, layout, range, catCount, {
			mode: 'bar',
			xPositions: horizontalAxis.xPositions,
		}),
	);

	if (highSeries && lowSeries && closeSeries) {
		const closeIndex = hasFour ? 3 : 2;
		primitives.push(
			...computeStockCandlePrimitives(
				{ open: openSeries, high: highSeries, low: lowSeries, close: closeSeries, closeIndex },
				chartData,
				layout,
				range,
				catCount,
				sourceIndices,
				horizontalAxis.xPositions,
			),
		);

		if (chartData.style?.hasDataLabels) {
			const barGroupWidth = layout.plotWidth / catCount;
			for (let displayIndex = 0; displayIndex < catCount; displayIndex++) {
				const sourceIndex = sourceIndices[displayIndex] ?? displayIndex;
				const close = closeSeries.values[sourceIndex];
				if (close === undefined) {
					continue;
				}
				const cx =
					horizontalAxis.xPositions?.[displayIndex] ??
					layout.plotLeft + barGroupWidth * displayIndex + barGroupWidth / 2;
				const closeY = valueToY(close, range, layout.plotTop, layout.plotBottom);
				const closeLabel = buildStockCloseLabel(
					chartData,
					closeSeries,
					sourceIndex,
					close,
					cx,
					closeY,
					{
						width: layout.svgWidth,
						height: layout.svgHeight,
					},
				);
				if (closeLabel) {
					dataLabels.push(closeLabel);
				}
			}
		}
	}
	primitives.push(...horizontalAxis.tickMarks);

	// Overlay depth, matching every other cartesian kind: regression trendlines,
	// error bars, axis titles and the data-table block. `computePlotLayout`
	// already reserved room for the table via `computeLayoutOptions`, so without
	// these the space was reserved and left blank.
	const displayChartData = horizontalAxis.displayChartData;
	const overlays: SvgPrimitive[] = [
		...computeTrendlinePrimitives(
			displayChartData,
			catCount,
			layout,
			range,
			'bar',
			chartData.colorPalette,
		),
		...computeErrorBarPrimitives(displayChartData, catCount, layout, range, 'bar', {
			xPositions: horizontalAxis.xPositions,
		}),
		...computeAxisTitlePrimitives(chartData, layout),
	];
	const dataTablePrimitives = computeDataTablePrimitives(
		displayChartData,
		layout,
		chartData.colorPalette,
	);
	primitives.push(...overlays, ...dataTablePrimitives);

	const title = resolveChartTitleText(chartData);

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title,
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
		overlays: overlays.length > 0 ? overlays : undefined,
		dataTable: dataTablePrimitives.length > 0 ? dataTablePrimitives : undefined,
	};
}
