/**
 * `chart-data-grid-ops` - the edit operations behind the chart inspector's
 * spreadsheet-style data grid.
 *
 * Core already owns the immutable `PptxChartData` transforms (`chartDataAdd*`
 * / `chartDataRemove*` / `chartDataUpdatePoint`), but every binding still had
 * to repeat the same *policy* around them: auto-name the new row/column, refuse
 * to delete the last series or category (a chart with zero series is not
 * renderable and core throws on the next index), and drop non-numeric cell
 * input instead of writing `NaN` into the deck. That policy is what lives here.
 *
 * Every function returns `null` when the edit must not happen, so a caller can
 * write `const next = addChartSeries(data); if (next) commit(next);` without
 * re-implementing the guards.
 *
 * @module render/chart-data-grid-ops
 */
import type { PptxChartData } from 'pptx-viewer-core';
import {
	chartDataAddCategory,
	chartDataAddSeries,
	chartDataRemoveCategory,
	chartDataRemoveSeries,
	chartDataUpdatePoint,
} from 'pptx-viewer-core';

/** Append a zero-filled series named `Series N` (matches PowerPoint's naming). */
export function addChartSeries(data: PptxChartData): PptxChartData {
	return chartDataAddSeries(data, {
		name: `Series ${data.series.length + 1}`,
		values: data.categories.map(() => 0),
	});
}

/**
 * Remove one series, or `null` when it is the last one.
 *
 * A chart must keep at least one series: dropping the last leaves nothing to
 * plot and the grid would then have no column to add values back into.
 */
export function removeChartSeries(data: PptxChartData, seriesIndex: number): PptxChartData | null {
	if (data.series.length <= 1 || seriesIndex < 0 || seriesIndex >= data.series.length) {
		return null;
	}
	return chartDataRemoveSeries(data, seriesIndex);
}

/** Append a category named `Cat N`, padding every series with a zero. */
export function addChartCategory(data: PptxChartData): PptxChartData {
	return chartDataAddCategory(data, `Cat ${data.categories.length + 1}`);
}

/**
 * Remove one category, or `null` when it is the last one.
 *
 * `followDataPoint` mirrors File > Options > Advanced > "Properties follow
 * chart data point for current workbook" (`chartPropertiesFollowDataPoint`):
 * when `true` (the default, and PowerPoint's own default), each series'
 * per-point manual formatting re-indexes along with the removed column
 * instead of staying pinned to its old numeric position. See
 * `chartDataRemoveCategory`.
 */
export function removeChartCategory(
	data: PptxChartData,
	categoryIndex: number,
	followDataPoint = true,
): PptxChartData | null {
	if (data.categories.length <= 1 || categoryIndex < 0 || categoryIndex >= data.categories.length) {
		return null;
	}
	return chartDataRemoveCategory(data, categoryIndex, followDataPoint);
}

/** Rename one category label. */
export function setChartCategoryLabel(
	data: PptxChartData,
	categoryIndex: number,
	label: string,
): PptxChartData | null {
	if (categoryIndex < 0 || categoryIndex >= data.categories.length) {
		return null;
	}
	return {
		...data,
		categories: data.categories.map((category, index) =>
			index === categoryIndex ? label : category,
		),
	};
}

/**
 * Write one grid cell, or `null` when the raw input is not a finite number.
 *
 * Rejecting rather than coercing matters: `Number('')` is 0, so a coercing
 * implementation silently rewrites a cell to zero the moment the author clears
 * it to retype a value.
 */
export function setChartCellValue(
	data: PptxChartData,
	seriesIndex: number,
	categoryIndex: number,
	raw: string,
): PptxChartData | null {
	const value = Number.parseFloat(raw);
	if (!Number.isFinite(value)) {
		return null;
	}
	if (seriesIndex < 0 || seriesIndex >= data.series.length) {
		return null;
	}
	return chartDataUpdatePoint(data, seriesIndex, categoryIndex, value);
}
