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

import type { ChartPptxElement } from "../../types/elements";
import type { PptxChartType } from "../../types/chart";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Ensure the element has initialised `chartData`. Throws if missing.
 */
function ensureChartData(
	element: ChartPptxElement,
): asserts element is ChartPptxElement & { chartData: NonNullable<ChartPptxElement["chartData"]> } {
	if (!element.chartData) {
		throw new Error("Chart element has no chartData. Cannot perform chart operations on an uninitialised chart.");
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
	grouping: "clustered" | "stacked" | "percentStacked",
): void {
	ensureChartData(element);
	element.chartData.grouping = grouping;
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
export function addChartCategory(
	element: ChartPptxElement,
	categoryName: string,
): void {
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
export function removeChartCategory(
	element: ChartPptxElement,
	categoryIndex: number,
): void {
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
