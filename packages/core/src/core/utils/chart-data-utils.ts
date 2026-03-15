/**
 * Pure chart data manipulation utilities.
 *
 * These functions operate on {@link PptxChartData} directly (immutable style,
 * returning new objects) and are framework-agnostic. They complement the
 * element-level SDK operations in `chart-operations.ts` which mutate
 * {@link ChartPptxElement} in place.
 *
 * Naming convention: `chartData*` prefix to avoid collisions with the
 * element-level SDK operations (`addChartSeries`, etc.).
 *
 * @module utils/chart-data-utils
 */

import type {
  PptxChartData,
  PptxChartSeries,
  PptxChartType,
} from "../types/chart";

// ---------------------------------------------------------------------------
// Chart type compatibility mapping
// ---------------------------------------------------------------------------

/** Chart types that use X/Y numeric data (scatter, bubble). */
const XY_CHART_TYPES = new Set<PptxChartType>(["scatter", "bubble"]);

/**
 * Chart types that support grouping modes (clustered/stacked/percentStacked).
 */
const GROUPING_SUPPORTED_TYPES = new Set<PptxChartType>([
  "bar", "line", "area", "bar3D", "line3D", "area3D",
]);

// ---------------------------------------------------------------------------
// Add series
// ---------------------------------------------------------------------------

/**
 * Add a new data series to chart data, returning a new `PptxChartData`.
 *
 * If the series' `values` array length does not match the category count,
 * values are padded with `0` or truncated to match.
 *
 * @param chartData - The current chart data.
 * @param series - The new series to add.
 * @returns A new `PptxChartData` with the series appended.
 *
 * @example
 * ```ts
 * const updated = chartDataAddSeries(chartData, {
 *   name: "Revenue",
 *   values: [100, 200, 300],
 *   color: "#4472C4",
 * });
 * ```
 */
export function chartDataAddSeries(
  chartData: PptxChartData,
  series: { name: string; values: number[]; color?: string },
): PptxChartData {
  const categoryCount = chartData.categories.length;
  let values = series.values;

  // Align values to category count for category-based charts
  if (categoryCount > 0) {
    if (values.length < categoryCount) {
      values = [...values, ...Array(categoryCount - values.length).fill(0)];
    } else if (values.length > categoryCount) {
      values = values.slice(0, categoryCount);
    }
  }

  const newSeries: PptxChartSeries = {
    name: series.name,
    values,
    ...(series.color ? { color: series.color } : {}),
  };

  return {
    ...chartData,
    series: [...chartData.series, newSeries],
  };
}

// ---------------------------------------------------------------------------
// Remove series
// ---------------------------------------------------------------------------

/**
 * Remove a data series by index, returning a new `PptxChartData`.
 *
 * @param chartData - The current chart data.
 * @param seriesIndex - Zero-based index of the series to remove.
 * @returns A new `PptxChartData` without the specified series.
 * @throws {RangeError} If `seriesIndex` is out of bounds.
 *
 * @example
 * ```ts
 * const updated = chartDataRemoveSeries(chartData, 1);
 * ```
 */
export function chartDataRemoveSeries(
  chartData: PptxChartData,
  seriesIndex: number,
): PptxChartData {
  if (seriesIndex < 0 || seriesIndex >= chartData.series.length) {
    throw new RangeError(
      `Series index ${seriesIndex} is out of range. Chart has ${chartData.series.length} series (indices 0\u2013${chartData.series.length - 1}).`,
    );
  }

  return {
    ...chartData,
    series: chartData.series.filter((_, i) => i !== seriesIndex),
  };
}

// ---------------------------------------------------------------------------
// Update data point
// ---------------------------------------------------------------------------

/**
 * Update a single data point value, returning a new `PptxChartData`.
 *
 * @param chartData - The current chart data.
 * @param seriesIndex - Zero-based series index.
 * @param pointIndex - Zero-based point (category) index.
 * @param value - The new numeric value.
 * @returns A new `PptxChartData` with the updated value.
 * @throws {RangeError} If either index is out of bounds.
 *
 * @example
 * ```ts
 * const updated = chartDataUpdatePoint(chartData, 0, 2, 42);
 * ```
 */
export function chartDataUpdatePoint(
  chartData: PptxChartData,
  seriesIndex: number,
  pointIndex: number,
  value: number,
): PptxChartData {
  if (seriesIndex < 0 || seriesIndex >= chartData.series.length) {
    throw new RangeError(
      `Series index ${seriesIndex} is out of range. Chart has ${chartData.series.length} series.`,
    );
  }
  const series = chartData.series[seriesIndex];
  if (pointIndex < 0 || pointIndex >= series.values.length) {
    throw new RangeError(
      `Point index ${pointIndex} is out of range. Series "${series.name}" has ${series.values.length} data points.`,
    );
  }

  const newValues = [...series.values];
  newValues[pointIndex] = value;

  const newSeries = chartData.series.map((s, i) =>
    i === seriesIndex ? { ...s, values: newValues } : s,
  );

  return { ...chartData, series: newSeries };
}

// ---------------------------------------------------------------------------
// Change chart type
// ---------------------------------------------------------------------------

/**
 * Change the chart type, adapting grouping and data format as needed.
 *
 * - When switching to a type that does not support grouping, the grouping
 *   field is cleared.
 * - When switching between category-based and XY types, data is preserved
 *   as-is (categories become X labels or vice versa).
 *
 * @param chartData - The current chart data.
 * @param newType - The target chart type.
 * @returns A new `PptxChartData` with the updated type and adapted fields.
 *
 * @example
 * ```ts
 * const lineChart = chartDataChangeType(barChartData, "line");
 * ```
 */
export function chartDataChangeType(
  chartData: PptxChartData,
  newType: PptxChartType,
): PptxChartData {
  const result: PptxChartData = {
    ...chartData,
    chartType: newType,
  };

  // Clear grouping if the new type does not support it
  if (!GROUPING_SUPPORTED_TYPES.has(newType)) {
    result.grouping = undefined;
  } else if (!result.grouping) {
    // Set a default grouping for types that support it
    result.grouping = "clustered";
  }

  // When switching from a category chart to scatter/bubble and categories
  // are non-numeric labels, generate sequential numeric X values
  if (
    XY_CHART_TYPES.has(newType) &&
    !XY_CHART_TYPES.has(chartData.chartType)
  ) {
    const allCategoriesNumeric = chartData.categories.every(
      (c) => !Number.isNaN(Number(c)),
    );
    if (!allCategoriesNumeric && chartData.categories.length > 0) {
      result.categories = chartData.categories.map((_, i) => String(i + 1));
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Add category
// ---------------------------------------------------------------------------

/**
 * Add a new category (data point column) to the chart.
 *
 * A default value of `0` is appended to each series' values array so that
 * data dimensions remain consistent.
 *
 * @param chartData - The current chart data.
 * @param categoryName - The label for the new category.
 * @returns A new `PptxChartData` with the category appended.
 *
 * @example
 * ```ts
 * const updated = chartDataAddCategory(chartData, "Q4");
 * ```
 */
export function chartDataAddCategory(
  chartData: PptxChartData,
  categoryName: string,
): PptxChartData {
  return {
    ...chartData,
    categories: [...chartData.categories, categoryName],
    series: chartData.series.map((s) => ({
      ...s,
      values: [...s.values, 0],
    })),
  };
}

// ---------------------------------------------------------------------------
// Remove category
// ---------------------------------------------------------------------------

/**
 * Remove a category (data point column) by index.
 *
 * The corresponding value is also removed from each series.
 *
 * @param chartData - The current chart data.
 * @param categoryIndex - Zero-based index of the category to remove.
 * @returns A new `PptxChartData` without the specified category.
 * @throws {RangeError} If `categoryIndex` is out of bounds.
 *
 * @example
 * ```ts
 * const updated = chartDataRemoveCategory(chartData, 0);
 * ```
 */
export function chartDataRemoveCategory(
  chartData: PptxChartData,
  categoryIndex: number,
): PptxChartData {
  if (categoryIndex < 0 || categoryIndex >= chartData.categories.length) {
    throw new RangeError(
      `Category index ${categoryIndex} is out of range. Chart has ${chartData.categories.length} categories.`,
    );
  }

  return {
    ...chartData,
    categories: chartData.categories.filter((_, i) => i !== categoryIndex),
    series: chartData.series.map((s) => ({
      ...s,
      values: s.values.filter((_, i) => i !== categoryIndex),
    })),
  };
}
