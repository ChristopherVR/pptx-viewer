/**
 * chart-ext-editor-actions.ts: editor-facing actions for the three
 * previously passthrough-only chart15 extension families (limitations.md
 * "Office chart extensions" row):
 *
 * - {@link hideChartSeries} / {@link restoreFilteredSeries}: PowerPoint's
 *   "Chart Filters" series toggle (`c15:filteredBarSeries` et al, modelled
 *   as {@link PptxChartData.filteredSeries} in core). Restoring a series
 *   whose own cached name/categories were empty (the auto-generated-title
 *   case) falls back to `c15:filteredSeriesTitle`/`filteredCategoryTitle`
 *   (`chartData.filteredSeriesTitle`/`filteredCategoryTitle`), which exist
 *   for exactly this scenario.
 * - {@link setDataLabelsRangeCache}: edits one cached label string of a
 *   series' `c15:datalabelsRange` ("Value From Cells"), keeping the range
 *   formula itself untouched (core re-derives `c15:dlblRangeCache` on save,
 *   see `chart-data-labels-range.ts`).
 *
 * Every function is a pure decision function returning a new `PptxChartData`
 * (or `null` when the edit does not apply), so each binding's chart editor
 * only has to map user intent onto these calls.
 *
 * @module render/chart-ext-editor-actions
 */
import type { PptxChartData, PptxChartFilteredSeries, PptxChartSeries } from 'pptx-viewer-core';

/**
 * Hide a currently-visible series (PowerPoint's Chart Filters "uncheck a
 * series"): moves it out of {@link PptxChartData.series} into
 * {@link PptxChartData.filteredSeries}, keeping its data and identity. The
 * chart must keep at least one visible series. `idx`/`order` on the new
 * filtered entry take the series' position among ALL series (visible and
 * already-filtered combined), matching how PowerPoint numbers them.
 */
export function hideChartSeries(data: PptxChartData, seriesIndex: number): PptxChartData | null {
	if (data.series.length <= 1 || seriesIndex < 0 || seriesIndex >= data.series.length) {
		return null;
	}
	const series = data.series[seriesIndex]!;
	// The smallest idx not already used by another VISIBLE series or an
	// already-filtered one. With nothing else filtered this is just
	// `seriesIndex` itself (PowerPoint numbers idx/order 0..N-1 across visible
	// and filtered series together); a prior filtered series can force a
	// higher one, keeping every idx distinct.
	const takenIndices = new Set([
		...data.series.map((_, i) => i).filter((i) => i !== seriesIndex),
		...(data.filteredSeries ?? []).map((f) => f.idx),
	]);
	let idx = 0;
	while (takenIndices.has(idx)) {
		idx++;
	}
	const filteredEntry: PptxChartFilteredSeries = {
		idx,
		order: idx,
		name: series.name,
		categories: data.categories,
		values: series.values,
		...(series.uniqueId ? { uniqueId: series.uniqueId } : {}),
	};
	return {
		...data,
		series: data.series.filter((_, i) => i !== seriesIndex),
		filteredSeries: [...(data.filteredSeries ?? []), filteredEntry],
	};
}

/**
 * Restore a series PowerPoint's Chart Filters hid (the reverse of
 * {@link hideChartSeries}): moves it from {@link PptxChartData.filteredSeries}
 * back into {@link PptxChartData.series}. When the filtered entry itself
 * carries no cached name (PowerPoint auto-generated one, e.g. "Series 3"),
 * falls back to {@link PptxChartData.filteredSeriesTitle}; when it carries no
 * cached categories, falls back to {@link PptxChartData.filteredCategoryTitle}
 * or the chart's current categories.
 */
export function restoreFilteredSeries(
	data: PptxChartData,
	filteredIndex: number,
): PptxChartData | null {
	const filtered = data.filteredSeries?.[filteredIndex];
	if (!filtered) {
		return null;
	}
	const name = filtered.name ?? data.filteredSeriesTitle ?? `Series ${data.series.length + 1}`;
	const categories = data.categories;
	const values =
		filtered.values ??
		(filtered.categories ?? data.filteredCategoryTitle)?.map(() => 0) ??
		categories.map(() => 0);
	const restored: PptxChartSeries = {
		name,
		values,
		...(filtered.uniqueId ? { uniqueId: filtered.uniqueId } : {}),
	};
	const remainingFiltered = (data.filteredSeries ?? []).filter((_, i) => i !== filteredIndex);
	return {
		...data,
		series: [...data.series, restored],
		...(remainingFiltered.length > 0
			? { filteredSeries: remainingFiltered }
			: { filteredSeries: undefined }),
	};
}

/**
 * Edit one cached label string of a series' `c15:datalabelsRange` ("Value
 * From Cells"). `pointIndex` is padded with empty strings if it falls beyond
 * the current cache length. The range formula (`dataLabelsRange.formula`)
 * is left untouched: only the cache PowerPoint shows without the source
 * workbook changes. Returns the ORIGINAL series unchanged (not `null`) when
 * it has no `dataLabelsRange` to edit, so a caller can always assign the
 * result.
 */
export function setDataLabelsRangeCache(
	series: PptxChartSeries,
	pointIndex: number,
	text: string,
): PptxChartSeries {
	const range = series.dataLabelOptions?.dataLabelsRange;
	if (!range || pointIndex < 0) {
		return series;
	}
	const cache = [...range.cache];
	while (cache.length <= pointIndex) {
		cache.push('');
	}
	cache[pointIndex] = text;
	return {
		...series,
		dataLabelOptions: { ...series.dataLabelOptions, dataLabelsRange: { ...range, cache } },
	};
}
