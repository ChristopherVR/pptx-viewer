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
 * Stock charts (HLC / OHLC candlesticks):
 *   3-series HLC  → series: High, Low, Close
 *   4-series OHLC → series: Open, High, Low, Close
 *   Per candle: a vertical wick line (high–low) + a body rect (open–close).
 *   Body is green when close ≥ open, red otherwise.
 *
 * @module chart-combo-stock
 */

import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import { computeLayoutOptions, computeValueRangeForChart } from './chart-axis';
import { verticalAxisX } from './chart-axis-crossing';
import { buildPrimaryAxis } from './chart-axis-render';
import { computeDataTablePrimitives } from './chart-data-table-render';
import { DEFAULT_CHART_DATA_LABEL_PX } from './chart-font';
import { shouldRenderMajorGridlines } from './chart-gridlines-toggle';
import { computeHelperLinePrimitives } from './chart-helper-lines';
import { buildCartesianHorizontalAxis } from './chart-horizontal-axis';
import {
	computeAxisTitlePrimitives,
	computeErrorBarPrimitives,
	computeTrendlinePrimitives,
} from './chart-overlays';
import type {
	ChartViewModel,
	PlotLayout,
	SvgLine,
	SvgPrimitive,
	SvgRect,
	SvgText,
	ValueRange,
} from './chart-view-model';
import {
	buildGridlinesAndLabels,
	buildLegend,
	buildZeroLine,
	computePlotLayout,
	formatAxisValue,
	valueToY,
} from './chart-view-model';

export { buildComboViewModel } from './chart-combo';

// ─────────────────────────────────────────────────────────────────────────────
// Candle colours (stock chart)
// ─────────────────────────────────────────────────────────────────────────────

const CANDLE_UP_FILL = '#22c55e';
const CANDLE_DOWN_FILL = '#ef4444';
const CANDLE_WICK_COLOR = '#334155';

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
 * Per data point the builder emits:
 *   - An `SvgLine` for the high-to-low wick (vertical).
 *   - An `SvgRect` for the open-to-close candle body.
 *
 * Candle body is green (#22c55e) when close ≥ open, red (#ef4444) otherwise.
 * When no open series is present the close value is used as the open (HLC
 * mode), causing all candles to show as a coloured body between close and the
 * previously computed running close – but for simplicity, with no open we set
 * open = low value, matching PowerPoint's own HLC rendering heuristic.
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
	const range: ValueRange = computeValueRangeForChart(chartData.series, chartData.axes);

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

	// `c:hiLowLines` and `c:upDownBars` are not decoration on a stock chart, they
	// ARE the chart: PowerPoint's own "Open-High-Low-Close" preset writes both,
	// and without them the plot is four detached candles. They are drawn first so
	// the candles stay on top.
	primitives.push(
		...computeHelperLinePrimitives(chartData, layout, range, catCount, {
			mode: 'bar',
			xPositions: horizontalAxis.xPositions,
		}),
	);

	if (highSeries && lowSeries && closeSeries) {
		const barGroupWidth = layout.plotWidth / catCount;
		const candleWidth = barGroupWidth * 0.5;

		for (let displayIndex = 0; displayIndex < catCount; displayIndex++) {
			const sourceIndex = sourceIndices[displayIndex] ?? displayIndex;
			const high = highSeries.values[sourceIndex] ?? 0;
			const low = lowSeries.values[sourceIndex] ?? 0;
			const open = openSeries ? (openSeries.values[sourceIndex] ?? low) : low;
			const close = closeSeries.values[sourceIndex] ?? high;
			const isUp = close >= open;

			const cx =
				horizontalAxis.xPositions?.[displayIndex] ??
				layout.plotLeft + barGroupWidth * displayIndex + barGroupWidth / 2;
			const highY = valueToY(high, range, layout.plotTop, layout.plotBottom);
			const lowY = valueToY(low, range, layout.plotTop, layout.plotBottom);
			const openY = valueToY(open, range, layout.plotTop, layout.plotBottom);
			const closeY = valueToY(close, range, layout.plotTop, layout.plotBottom);

			// Wick: vertical line from high to low.
			primitives.push({
				kind: 'line',
				x1: cx,
				y1: highY,
				x2: cx,
				y2: lowY,
				stroke: CANDLE_WICK_COLOR,
				strokeWidth: 1,
			} satisfies SvgLine);

			// Body: rect from open to close.
			const bodyTop = Math.min(openY, closeY);
			const bodyHeight = Math.max(Math.abs(openY - closeY), 1);
			primitives.push({
				kind: 'rect',
				x: cx - candleWidth / 2,
				y: bodyTop,
				w: candleWidth,
				h: bodyHeight,
				fill: isUp ? CANDLE_UP_FILL : CANDLE_DOWN_FILL,
				rx: 1,
				part: {
					role: 'dataPoint',
					seriesIndex: hasFour ? 3 : 2,
					pointIndex: sourceIndex,
				},
			} satisfies SvgRect);

			if (chartData.style?.hasDataLabels) {
				dataLabels.push({
					kind: 'text',
					x: cx,
					y: highY - 4,
					text: formatAxisValue(close),
					fontSize: DEFAULT_CHART_DATA_LABEL_PX,
					fill: '#334155',
					textAnchor: 'middle',
				} satisfies SvgText);
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

	const title = chartData.style?.hasTitle && chartData.title ? chartData.title : undefined;

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
