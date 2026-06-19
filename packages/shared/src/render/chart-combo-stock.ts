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

import type {
	ChartViewModel,
	PlotLayout,
	SvgCircle,
	SvgLine,
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
	computeBarRects,
	computePlotLayout,
	computeValueRange,
	formatAxisValue,
	seriesColor,
	valueToY,
} from './chart-view-model';

// ─────────────────────────────────────────────────────────────────────────────
// Candle colours (stock chart)
// ─────────────────────────────────────────────────────────────────────────────

const CANDLE_UP_FILL = '#22c55e';
const CANDLE_DOWN_FILL = '#ef4444';
const CANDLE_WICK_COLOR = '#334155';

// ─────────────────────────────────────────────────────────────────────────────
// Combo chart
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a `ChartViewModel` for a combo chart (bar + line overlay).
 *
 * Convention (mirrors the React renderer):
 *   - `chartData.series[0]`   → rendered as clustered bar columns
 *   - `chartData.series[1…N]` → rendered as line series with dot markers
 *
 * A single shared value-axis range is computed across ALL series so that the
 * bar and line series share the same Y scale.  The category-axis tick style is
 * "bar" (evenly spaced groups with no extra edge padding).
 *
 * @param element        - The chart element providing width/height.
 * @param chartData      - Parsed chart data including series and style.
 * @param categoryLabels - Ordered category axis labels.
 * @returns A fully assembled `ChartViewModel` ready for the template.
 */
export function buildComboViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const layout: PlotLayout = computePlotLayout(element.width, element.height, chartData, true);
	const catCount = Math.max(categoryLabels.length, 1);

	// Single shared range across all series so bar and line share Y scale.
	const range: ValueRange = computeValueRange(chartData.series);

	const { gridlines, axisLabels } = buildGridlinesAndLabels(range, layout);
	const zeroLine = buildZeroLine(range, layout);
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

	// ── Bar series (series[0]) ──────────────────────────────────────────────
	const barSeries = chartData.series.slice(0, 1);
	if (barSeries.length > 0) {
		const barRects = computeBarRects(barSeries, catCount, layout, range, chartData.colorPalette);
		for (const r of barRects) {
			primitives.push({
				kind: 'rect',
				x: r.x,
				y: r.y,
				w: r.w,
				h: r.h,
				fill: r.fill,
				rx: 1,
			} satisfies SvgRect);
		}

		if (chartData.style?.hasDataLabels && barSeries[0]) {
			const barGroupWidth = layout.plotWidth / catCount;
			const singleBarWidth = barGroupWidth * 0.7;
			const groupOffset = (barGroupWidth - singleBarWidth) / 2;

			barSeries[0].values.forEach((val, vi) => {
				const x = layout.plotLeft + barGroupWidth * vi + groupOffset + singleBarWidth / 2;
				const zeroY = valueToY(0, range, layout.plotTop, layout.plotBottom);
				const valY = valueToY(val, range, layout.plotTop, layout.plotBottom);
				const labelY = val >= 0 ? Math.min(zeroY, valY) - 4 : Math.max(zeroY, valY) + 10;
				dataLabels.push({
					kind: 'text',
					x,
					y: labelY,
					text: formatAxisValue(val),
					fontSize: 7,
					fill: '#334155',
					textAnchor: 'middle',
				} satisfies SvgText);
			});
		}
	}

	// ── Line series (series[1…N]) ───────────────────────────────────────────
	// Line X positions are centred within each bar group for visual alignment.
	const barGroupWidth = layout.plotWidth / catCount;
	const lineSeries = chartData.series.slice(1);

	lineSeries.forEach((series, si) => {
		if (series.values.length === 0) {
			return;
		}
		const seriesIdx = si + 1; // offset past the bar series
		const c = seriesColor(series, seriesIdx, chartData.colorPalette);

		// Build points centred within each bar group to align with bar midpoints.
		const pts = series.values.map((val, vi) => ({
			x: layout.plotLeft + barGroupWidth * vi + barGroupWidth / 2,
			y: valueToY(val, range, layout.plotTop, layout.plotBottom),
		}));

		const pointsStr = pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
		primitives.push({
			kind: 'polyline',
			points: pointsStr,
			stroke: c,
			strokeWidth: 2.4,
			fill: 'none',
		} satisfies SvgPolyline);

		for (const pt of pts) {
			primitives.push({
				kind: 'circle',
				cx: pt.x,
				cy: pt.y,
				r: 2.5,
				fill: c,
			} satisfies SvgCircle);
		}

		if (chartData.style?.hasDataLabels) {
			series.values.forEach((val, vi) => {
				const pt = pts[vi];
				if (!pt) {
					return;
				}
				dataLabels.push({
					kind: 'text',
					x: pt.x,
					y: pt.y - 7,
					text: formatAxisValue(val),
					fontSize: 7,
					fill: '#334155',
					textAnchor: 'middle',
				} satisfies SvgText);
			});
		}
	});

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
		categoryLabels: catLabels,
		primitives,
		dataLabels,
		legend: chartData.style?.hasLegend ? legend : [],
		legendX,
		legendY,
		legendAnchor,
	};
}

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
	const layout: PlotLayout = computePlotLayout(element.width, element.height, chartData, true);
	const catCount = Math.max(categoryLabels.length, 1);

	const range: ValueRange = computeValueRange(chartData.series);

	const { gridlines, axisLabels } = buildGridlinesAndLabels(range, layout);
	const zeroLine = buildZeroLine(range, layout);
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

	// ── Resolve OHLC series slots ──────────────────────────────────────────
	const hasFour = chartData.series.length >= 4;
	const openSeries = hasFour ? chartData.series[0] : undefined;
	const highSeries = chartData.series[hasFour ? 1 : 0];
	const lowSeries = chartData.series[hasFour ? 2 : 1];
	const closeSeries = chartData.series[hasFour ? 3 : 2];

	const primitives: SvgPrimitive[] = [];
	const dataLabels: SvgText[] = [];

	if (highSeries && lowSeries && closeSeries) {
		const barGroupWidth = layout.plotWidth / catCount;
		const candleWidth = barGroupWidth * 0.5;

		for (let ci = 0; ci < catCount; ci++) {
			const high = highSeries.values[ci] ?? 0;
			const low = lowSeries.values[ci] ?? 0;
			const open = openSeries ? (openSeries.values[ci] ?? low) : low;
			const close = closeSeries.values[ci] ?? high;
			const isUp = close >= open;

			const cx = layout.plotLeft + barGroupWidth * ci + barGroupWidth / 2;
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
			} satisfies SvgRect);

			if (chartData.style?.hasDataLabels) {
				dataLabels.push({
					kind: 'text',
					x: cx,
					y: highY - 4,
					text: formatAxisValue(close),
					fontSize: 7,
					fill: '#334155',
					textAnchor: 'middle',
				} satisfies SvgText);
			}
		}
	}

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
		categoryLabels: catLabels,
		primitives,
		dataLabels,
		legend: chartData.style?.hasLegend ? legend : [],
		legendX,
		legendY,
		legendAnchor,
	};
}
