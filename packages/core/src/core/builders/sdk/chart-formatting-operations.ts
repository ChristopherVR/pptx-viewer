/**
 * Additional headless chart mutation operations for constructs W3-D1 made
 * native on the save path: full per-point shape formatting (fill, stroke,
 * stroke width, dash style, not just fill colour), the chart-level helper
 * lines (`c:dropLines`/`c:hiLowLines`), and the chart colour-map override
 * (`c:clrMapOvr`). Split out of `chart-operations.ts` (already well over the
 * repo's 300-line-per-file guideline) rather than growing it further.
 *
 * @module sdk/chart-formatting-operations
 */

import type { PptxChartLineStyle, PptxChartShapeProps, PptxChartType } from '../../types/chart';
import type { ChartPptxElement } from '../../types/elements';
import {
	ensureChartData,
	ensureDataPoint,
	removeEmptyDataPoint,
	validateSeriesIndex,
} from './chart-operations';

/**
 * Set (or clear) the full shape formatting (fill colour, stroke colour,
 * stroke width, stroke dash style) of a single data point, overriding the
 * series' own styling for that point only. Round-trips to the saved `.pptx`
 * (`c:dPt/c:spPr` keyed by `c:idx`), including the stroke width/dash style
 * that {@link import('./chart-operations').setChartDataPointFill} does not
 * expose (it only ever sets `fillColor`).
 *
 * Pass a {@link PptxChartShapeProps} patch to merge into the point's existing
 * style, or `null` to remove it entirely (dropping the whole `c:dPt`
 * override when nothing else is set on it).
 *
 * @example
 * ```ts
 * setChartDataPointStyle(chartEl, 0, 2, { strokeColor: "#FF0000", strokeWidth: 2, strokeDashStyle: "dash" });
 * setChartDataPointStyle(chartEl, 0, 2, null); // clear
 * ```
 */
export function setChartDataPointStyle(
	element: ChartPptxElement,
	seriesIndex: number,
	pointIndex: number,
	style: PptxChartShapeProps | null,
): void {
	validateSeriesIndex(element, seriesIndex);
	const series = element.chartData!.series[seriesIndex];
	if (style === null) {
		const dp = series.dataPoints?.find((p) => p.idx === pointIndex);
		if (dp) {
			dp.spPr = undefined;
			removeEmptyDataPoint(series, pointIndex);
		}
		return;
	}
	const dp = ensureDataPoint(series, pointIndex);
	dp.spPr = { ...(dp.spPr ?? {}), ...style };
}

/** Chart-type containers that legally carry `c:dropLines`/`c:hiLowLines`. */
const HELPER_LINE_CHART_TYPES = new Set<PptxChartType>(['line', 'stock', 'combo']);

/**
 * Set (or remove) a chart-level helper line: `c:dropLines` (line/stock
 * charts) or `c:hiLowLines` (line/stock charts, joins the high/low points).
 * Round-trips to the saved `.pptx`.
 *
 * Pass a {@link PptxChartLineStyle} to set/replace the line's colour, width,
 * and dash style (an empty `{}` shows the line with default styling), or
 * `null` to remove the element entirely.
 *
 * @throws {Error} If the chart is not a line, stock, or combo chart.
 *
 * @example
 * ```ts
 * setChartHelperLine(chartEl, "hiLowLines", { color: "#888888", width: 0.75 });
 * setChartHelperLine(chartEl, "dropLines", null); // remove
 * ```
 */
export function setChartHelperLine(
	element: ChartPptxElement,
	line: 'dropLines' | 'hiLowLines',
	style: PptxChartLineStyle | null,
): void {
	ensureChartData(element);
	if (!HELPER_LINE_CHART_TYPES.has(element.chartData.chartType)) {
		throw new Error(
			`${line} is only valid on line, stock, or combo charts (got "${element.chartData.chartType}").`,
		);
	}
	element.chartData[line] = style;
}

/**
 * Set (or clear) the chart's colour-map override (`c:clrMapOvr`), remapping
 * up to 12 theme colour roles (`bg1`, `tx1`, `bg2`, `tx2`, `accent1`-`accent6`,
 * `hlink`, `folHlink`) for this chart only. Round-trips to the saved `.pptx`.
 *
 * Pass a partial map to merge into any existing override, or `null` to
 * remove it entirely so the chart falls back to the deck's own colour map.
 *
 * @example
 * ```ts
 * setChartColorMapOverride(chartEl, { accent1: "accent2", accent2: "accent1" });
 * setChartColorMapOverride(chartEl, null); // remove
 * ```
 */
export function setChartColorMapOverride(
	element: ChartPptxElement,
	overrides: Record<string, string> | null,
): void {
	ensureChartData(element);
	if (overrides === null) {
		element.chartData.clrMapOvr = null;
		return;
	}
	element.chartData.clrMapOvr = { ...(element.chartData.clrMapOvr ?? {}), ...overrides };
}
