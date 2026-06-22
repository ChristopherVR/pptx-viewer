/**
 * chart-advanced-helpers.ts: Pure immutable wrappers around the remaining
 * advanced chart-editing core ops that `chart-data-helpers.ts` does not already
 * expose (legend, chart-level data labels, axis scale/format edits, chart title,
 * per-series trendlines/error bars, per-data-point label overrides).
 *
 * Each function clones the element's `chartData`, runs the in-place core op on
 * the clone, and returns a new `ChartPptxElement` so the Angular editor's
 * immutable contract (and clean history entries) is preserved. The heavy lifting
 * lives in `pptx-viewer-core`; these are thin framework-agnostic adapters.
 *
 * @module angular-viewer/chart-advanced-helpers
 */

import {
	setChartAxis,
	setChartDataLabels,
	setChartDataPointLabel,
	setChartLegend,
	setChartSeriesErrorBars,
	setChartSeriesTrendline,
	setChartTitle,
} from 'pptx-viewer-core';
import type {
	ChartAxisEdit,
	ChartDataPointLabelEdit,
	ChartPptxElement,
	PptxChartAxisType,
	PptxChartDataLabelOptions,
	PptxChartErrBars,
	PptxChartLegendPosition,
	PptxChartTrendline,
} from 'pptx-viewer-core';

/** Apply an in-place core chart op to a deep clone of `element`. */
function withClonedChart(
	element: ChartPptxElement,
	mutate: (clone: ChartPptxElement) => void,
): ChartPptxElement {
	if (!element.chartData) {
		return element;
	}
	const clone: ChartPptxElement = {
		...element,
		chartData: structuredClone(element.chartData),
	};
	mutate(clone);
	return clone;
}

// ---------------------------------------------------------------------------
// Chart title
// ---------------------------------------------------------------------------

/** Set the chart title text. */
export function setTitle(element: ChartPptxElement, title: string): ChartPptxElement {
	return withClonedChart(element, (el) => setChartTitle(el, title));
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

/** Show/hide the chart legend and/or set its position. */
export function setLegend(
	element: ChartPptxElement,
	options: { show?: boolean; position?: PptxChartLegendPosition },
): ChartPptxElement {
	return withClonedChart(element, (el) => setChartLegend(el, options));
}

// ---------------------------------------------------------------------------
// Chart-level data labels
// ---------------------------------------------------------------------------

/** Toggle chart-level data labels and set their content/position. */
export function setDataLabels(
	element: ChartPptxElement,
	edit: {
		show?: boolean;
		showValue?: boolean;
		showCategory?: boolean;
		showSeriesName?: boolean;
		showPercent?: boolean;
		showLegendKey?: boolean;
		position?: PptxChartDataLabelOptions['position'];
	},
): ChartPptxElement {
	return withClonedChart(element, (el) => setChartDataLabels(el, edit));
}

// ---------------------------------------------------------------------------
// Axis scale / number format / gridline visibility / tick labels / units
// ---------------------------------------------------------------------------

/** Edit value/category axis formatting (min/max/units/format/gridlines/etc.). */
export function setAxis(
	element: ChartPptxElement,
	axisType: PptxChartAxisType,
	edit: ChartAxisEdit,
): ChartPptxElement {
	return withClonedChart(element, (el) => setChartAxis(el, axisType, edit));
}

// ---------------------------------------------------------------------------
// Per-series trendlines / error bars
// ---------------------------------------------------------------------------

/** Set or clear the primary trendline on a series. */
export function setSeriesTrendline(
	element: ChartPptxElement,
	seriesIndex: number,
	trendline: PptxChartTrendline | null,
): ChartPptxElement {
	return withClonedChart(element, (el) => setChartSeriesTrendline(el, seriesIndex, trendline));
}

/** Set or clear the error bars on a series. */
export function setSeriesErrorBars(
	element: ChartPptxElement,
	seriesIndex: number,
	errBars: PptxChartErrBars | null,
): ChartPptxElement {
	return withClonedChart(element, (el) => setChartSeriesErrorBars(el, seriesIndex, errBars));
}

// ---------------------------------------------------------------------------
// Per-data-point label overrides
// ---------------------------------------------------------------------------

/** Set or clear a single data point's label override. */
export function setDataPointLabel(
	element: ChartPptxElement,
	seriesIndex: number,
	pointIndex: number,
	edit: ChartDataPointLabelEdit | null,
): ChartPptxElement {
	return withClonedChart(element, (el) =>
		setChartDataPointLabel(el, seriesIndex, pointIndex, edit),
	);
}
