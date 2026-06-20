/**
 * Headless chart mutation operations for the PPTX SDK.
 *
 * These functions perform in-place mutations on {@link ChartPptxElement}
 * chart data. They operate purely on the data model — no XML or ZIP
 * manipulation is required. The save pipeline serializes `chartData`
 * back to OpenXML automatically.
 *
 * @module sdk/chart-operations
 */

import type {
	PptxChartAxisFormatting,
	PptxChartDataLabelOptions,
	PptxChartTrendline,
	PptxChartType,
} from '../../types/chart';
import type { ChartPptxElement } from '../../types/elements';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Ensure the element has initialised `chartData`. Throws if missing.
 */
function ensureChartData(
	element: ChartPptxElement,
): asserts element is ChartPptxElement & { chartData: NonNullable<ChartPptxElement['chartData']> } {
	if (!element.chartData) {
		throw new Error(
			'Chart element has no chartData. Cannot perform chart operations on an uninitialised chart.',
		);
	}
}

/**
 * Validate that a series index is within range. Throws if out of bounds.
 */
function validateSeriesIndex(element: ChartPptxElement, seriesIndex: number): void {
	ensureChartData(element);
	if (seriesIndex < 0 || seriesIndex >= element.chartData.series.length) {
		throw new RangeError(
			`Series index ${seriesIndex} is out of range. Chart has ${element.chartData.series.length} series (indices 0–${element.chartData.series.length - 1}).`,
		);
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Change the chart type of an existing chart element.
 * Preserves series data and categories.
 *
 * @param element - The chart element to modify.
 * @param newType - The new chart type.
 *
 * @example
 * ```ts
 * setChartType(chartEl, "line");
 * ```
 */
export function setChartType(element: ChartPptxElement, newType: PptxChartType): void {
	ensureChartData(element);
	element.chartData.chartType = newType;
}

/**
 * Add a data series to an existing chart.
 *
 * @param element - The chart element to modify.
 * @param series - The series to add (name, values, optional color).
 *
 * @example
 * ```ts
 * addChartSeries(chartEl, { name: "Q2", values: [50, 60, 70], color: "#FF0000" });
 * ```
 */
export function addChartSeries(
	element: ChartPptxElement,
	series: { name: string; values: number[]; color?: string },
): void {
	ensureChartData(element);
	element.chartData.series.push({
		name: series.name,
		values: series.values,
		color: series.color,
	});
}

/**
 * Remove a data series by index.
 *
 * @param element - The chart element to modify.
 * @param seriesIndex - Zero-based index of the series to remove.
 * @throws {RangeError} If `seriesIndex` is out of bounds.
 *
 * @example
 * ```ts
 * removeChartSeries(chartEl, 0);
 * ```
 */
export function removeChartSeries(element: ChartPptxElement, seriesIndex: number): void {
	validateSeriesIndex(element, seriesIndex);
	element.chartData!.series.splice(seriesIndex, 1);
}

/**
 * Update chart categories.
 *
 * @param element - The chart element to modify.
 * @param categories - The new category labels.
 *
 * @example
 * ```ts
 * setChartCategories(chartEl, ["Jan", "Feb", "Mar"]);
 * ```
 */
export function setChartCategories(element: ChartPptxElement, categories: string[]): void {
	ensureChartData(element);
	element.chartData.categories = categories;
}

/**
 * Update series values by index.
 *
 * @param element - The chart element to modify.
 * @param seriesIndex - Zero-based index of the series to update.
 * @param values - The new data values for the series.
 * @throws {RangeError} If `seriesIndex` is out of bounds.
 *
 * @example
 * ```ts
 * updateChartSeriesValues(chartEl, 0, [100, 200, 300]);
 * ```
 */
export function updateChartSeriesValues(
	element: ChartPptxElement,
	seriesIndex: number,
	values: number[],
): void {
	validateSeriesIndex(element, seriesIndex);
	element.chartData!.series[seriesIndex].values = values;
}

/**
 * Set chart title.
 *
 * @param element - The chart element to modify.
 * @param title - The new title string.
 *
 * @example
 * ```ts
 * setChartTitle(chartEl, "Revenue by Quarter");
 * ```
 */
export function setChartTitle(element: ChartPptxElement, title: string): void {
	ensureChartData(element);
	element.chartData.title = title;
}

/**
 * Set chart grouping (clustered, stacked, percentStacked).
 *
 * @param element - The chart element to modify.
 * @param grouping - The new grouping mode.
 *
 * @example
 * ```ts
 * setChartGrouping(chartEl, "stacked");
 * ```
 */
export function setChartGrouping(
	element: ChartPptxElement,
	grouping: 'clustered' | 'stacked' | 'percentStacked',
): void {
	ensureChartData(element);
	element.chartData.grouping = grouping;
}

/**
 * Legend placement, matching OOXML `ST_LegendPos`.
 * `b` bottom, `tr` top-right, `l` left, `r` right, `t` top.
 */
export type PptxChartLegendPosition = 'b' | 'tr' | 'l' | 'r' | 't';

/**
 * Show/hide the chart legend and/or set its position. Edits round-trip to
 * the saved `.pptx` (`c:legend` / `c:legendPos`).
 *
 * @param element - The chart element to modify.
 * @param options - `show` toggles legend visibility; `position` sets placement.
 *   Setting a `position` without an explicit `show` turns the legend on.
 *
 * @example
 * ```ts
 * setChartLegend(chartEl, { show: true, position: "r" });
 * setChartLegend(chartEl, { show: false });
 * ```
 */
export function setChartLegend(
	element: ChartPptxElement,
	options: { show?: boolean; position?: PptxChartLegendPosition },
): void {
	ensureChartData(element);
	const style = (element.chartData.style ??= {});
	if (options.show !== undefined) {
		style.hasLegend = options.show;
	}
	if (options.position !== undefined) {
		style.legendPosition = options.position;
		if (style.hasLegend === undefined) {
			style.hasLegend = true;
		}
	}
}

/**
 * Show/hide chart-level data labels and/or set their content and position.
 * Edits round-trip to the saved `.pptx` (`c:dLbls` under each chart-type
 * container).
 *
 * @param element - The chart element to modify.
 * @param edit - `show` toggles all data labels; the `show*` flags pick which
 *   content appears; `position` sets placement. Setting any content flag or a
 *   position turns labels on when not already set.
 *
 * @example
 * ```ts
 * setChartDataLabels(chartEl, { show: true, showValue: true, position: "outEnd" });
 * setChartDataLabels(chartEl, { show: false });
 * ```
 */
export function setChartDataLabels(
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
): void {
	ensureChartData(element);
	const style = (element.chartData.style ??= {});
	if (edit.show !== undefined) {
		style.hasDataLabels = edit.show;
	}
	const contentKeys = [
		'showValue',
		'showCategory',
		'showSeriesName',
		'showPercent',
		'showLegendKey',
	] as const;
	const hasContentEdit =
		contentKeys.some((k) => edit[k] !== undefined) || edit.position !== undefined;
	if (hasContentEdit) {
		const opts = (style.dataLabels ??= {});
		for (const k of contentKeys) {
			if (edit[k] !== undefined) {
				opts[k] = edit[k];
			}
		}
		if (edit.position !== undefined) {
			opts.position = edit.position || undefined;
		}
		if (style.hasDataLabels === undefined) {
			style.hasDataLabels = true;
		}
	}
}

/**
 * Set (or clear) the primary trendline on a chart series. Edits round-trip to
 * the saved `.pptx` (`c:trendline` inside the series).
 *
 * Pass a {@link PptxChartTrendline} to add/replace the series' trendline, or
 * `null` to remove it. This manages a single trendline per series (the common
 * case); charts with multiple trendlines on one series can be edited via the
 * `series.trendlines` array directly.
 *
 * @example
 * ```ts
 * setChartSeriesTrendline(chartEl, 0, { trendlineType: "linear", displayEq: true });
 * setChartSeriesTrendline(chartEl, 0, null); // remove
 * ```
 */
export function setChartSeriesTrendline(
	element: ChartPptxElement,
	seriesIndex: number,
	trendline: PptxChartTrendline | null,
): void {
	validateSeriesIndex(element, seriesIndex);
	element.chartData!.series[seriesIndex].trendlines = trendline ? [trendline] : [];
}

/** Axis kinds that can be addressed by {@link setChartAxis}. */
export type PptxChartAxisType = PptxChartAxisFormatting['axisType'];

/**
 * Editable axis-formatting properties. Each field is optional:
 * - omit a field to leave it unchanged,
 * - pass a value to set it,
 * - pass `null` (for the numeric fields) or `''` (for `numberFormat`) to
 *   clear it so the axis falls back to its automatic behaviour.
 */
export interface ChartAxisEdit {
	min?: number | null;
	max?: number | null;
	majorUnit?: number | null;
	minorUnit?: number | null;
	numberFormat?: string;
	tickLabelPosition?: 'high' | 'low' | 'nextTo' | 'none';
}

/**
 * Edit value/category axis formatting that round-trips to the saved `.pptx`
 * (`c:min`/`c:max` scaling, `c:majorUnit`/`c:minorUnit`, `c:numFmt`,
 * `c:tickLblPos`).
 *
 * Finds the first axis of `axisType` in `chartData.axes`, creating an entry
 * if none exists. Note that newly created axes only serialize for charts that
 * already contain a matching axis in the source XML (the save pipeline links
 * edits by the parsed axis id), which is the normal case for loaded charts.
 *
 * @example
 * ```ts
 * setChartAxis(chartEl, "valAx", { min: 0, max: 100, majorUnit: 20 });
 * setChartAxis(chartEl, "valAx", { min: null }); // clear the override
 * ```
 */
export function setChartAxis(
	element: ChartPptxElement,
	axisType: PptxChartAxisType,
	edit: ChartAxisEdit,
): void {
	ensureChartData(element);
	const axes = (element.chartData.axes ??= []);
	let axis = axes.find((a) => a.axisType === axisType);
	if (!axis) {
		axis = { axisType };
		axes.push(axis);
	}
	if (edit.min !== undefined) {
		axis.min = edit.min ?? undefined;
	}
	if (edit.max !== undefined) {
		axis.max = edit.max ?? undefined;
	}
	if (edit.majorUnit !== undefined) {
		axis.majorUnit = edit.majorUnit ?? undefined;
	}
	if (edit.minorUnit !== undefined) {
		axis.minorUnit = edit.minorUnit ?? undefined;
	}
	if (edit.numberFormat !== undefined) {
		axis.numFmt = edit.numberFormat
			? { formatCode: edit.numberFormat, sourceLinked: false }
			: undefined;
	}
	if (edit.tickLabelPosition !== undefined) {
		axis.tickLblPos = edit.tickLabelPosition;
	}
}

/**
 * Update a single data point value in a chart series.
 *
 * @param element - The chart element to modify.
 * @param seriesIndex - Zero-based index of the series.
 * @param pointIndex - Zero-based index of the data point (category).
 * @param value - The new numeric value.
 * @throws {RangeError} If either index is out of bounds.
 *
 * @example
 * ```ts
 * updateChartDataPoint(chartEl, 0, 2, 42);
 * ```
 */
export function updateChartDataPoint(
	element: ChartPptxElement,
	seriesIndex: number,
	pointIndex: number,
	value: number,
): void {
	validateSeriesIndex(element, seriesIndex);
	const series = element.chartData!.series[seriesIndex];
	if (pointIndex < 0 || pointIndex >= series.values.length) {
		throw new RangeError(
			`Point index ${pointIndex} is out of range. Series "${series.name}" has ${series.values.length} data points (indices 0\u2013${series.values.length - 1}).`,
		);
	}
	series.values[pointIndex] = value;
}

/**
 * Add a new category to the chart, appending a default value of `0`
 * to every series so that data dimensions remain consistent.
 *
 * @param element - The chart element to modify.
 * @param categoryName - The label for the new category.
 *
 * @example
 * ```ts
 * addChartCategory(chartEl, "Q4");
 * ```
 */
export function addChartCategory(element: ChartPptxElement, categoryName: string): void {
	ensureChartData(element);
	element.chartData.categories.push(categoryName);
	for (const series of element.chartData.series) {
		series.values.push(0);
	}
}

/**
 * Remove a category by index, also removing the corresponding value
 * from every series.
 *
 * @param element - The chart element to modify.
 * @param categoryIndex - Zero-based index of the category to remove.
 * @throws {RangeError} If `categoryIndex` is out of bounds.
 *
 * @example
 * ```ts
 * removeChartCategory(chartEl, 0);
 * ```
 */
export function removeChartCategory(element: ChartPptxElement, categoryIndex: number): void {
	ensureChartData(element);
	if (categoryIndex < 0 || categoryIndex >= element.chartData.categories.length) {
		throw new RangeError(
			`Category index ${categoryIndex} is out of range. Chart has ${element.chartData.categories.length} categories (indices 0\u2013${element.chartData.categories.length - 1}).`,
		);
	}
	element.chartData.categories.splice(categoryIndex, 1);
	for (const series of element.chartData.series) {
		series.values.splice(categoryIndex, 1);
	}
}
