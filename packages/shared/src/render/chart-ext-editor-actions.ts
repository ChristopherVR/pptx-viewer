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
 * chart must keep at least one visible series.
 *
 * The new filtered entry's `idx`/`order` reuse the series' OWN `c:idx` when
 * it has one (every real OOXML `c:ser` does): this value is what
 * {@link restoreFilteredSeries} and the Chart Filters popover
 * (`chart-quick-actions.ts`'s `buildFilters`) key a series' position on, so a
 * chart with non-sequential idx values (a filtered series in the original
 * file, or one authored idx 1/2 rather than 0/1, both real-world cases)
 * keeps its true identity instead of being renumbered to "the smallest idx
 * not yet taken," which used to reorder the Chart Filters list and lose a
 * restored series' original position. Only a source series with no idx at
 * all (a synthetic/malformed chart) falls back to that smallest-free-slot
 * scheme, to guarantee every idx in the combined visible+filtered set stays
 * distinct.
 */
export function hideChartSeries(data: PptxChartData, seriesIndex: number): PptxChartData | null {
	if (data.series.length <= 1 || seriesIndex < 0 || seriesIndex >= data.series.length) {
		return null;
	}
	const series = data.series[seriesIndex]!;
	let idx = series.idx;
	if (idx === undefined) {
		const taken = new Set([
			...data.series.map((_, i) => i).filter((i) => i !== seriesIndex),
			...(data.filteredSeries ?? []).map((f) => f.idx),
		]);
		idx = 0;
		while (taken.has(idx)) {
			idx++;
		}
	}
	const filteredEntry: PptxChartFilteredSeries = {
		idx,
		order: idx,
		name: series.name,
		categories: data.categories,
		values: series.values,
		...(series.uniqueId ? { uniqueId: series.uniqueId } : {}),
		// Full snapshot so restoreFilteredSeries can bring back everything
		// (fill/line formatting, marker, data labels, ...), not just name and
		// values: this used to silently reset a series with a picture fill
		// or any other non-default formatting to plain defaults on restore.
		originalSeries: series,
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
 * back into {@link PptxChartData.series}, reinserted at the position its
 * `idx` puts it among the currently-visible series (not always appended
 * last, which used to leave a restored series permanently reordered to the
 * end of the chart, its legend, and its plot/stacking order). When the
 * filtered entry itself carries no cached name (PowerPoint auto-generated
 * one, e.g. "Series 3"), falls back to {@link PptxChartData.filteredSeriesTitle};
 * when it carries no cached categories, falls back to
 * {@link PptxChartData.filteredCategoryTitle} or the chart's current
 * categories.
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
	// A series hidden by hideChartSeries this session carries a full
	// originalSeries snapshot: use it as-is (fill/line formatting, marker,
	// data labels, everything) rather than the bare name/values reconstruction
	// below, which used to reset a series with a picture fill or any other
	// non-default formatting to plain defaults on restore. A filtered series
	// that came from parsing the file (already hidden when opened) has no
	// snapshot to draw on, since the parser only reads name/cat/val/uniqueId
	// off the real c15:ser node; that case keeps the bare reconstruction.
	const restored: PptxChartSeries = filtered.originalSeries
		? { ...filtered.originalSeries, idx: filtered.idx }
		: {
				name,
				values,
				idx: filtered.idx,
				...(filtered.uniqueId ? { uniqueId: filtered.uniqueId } : {}),
			};
	// The first currently-visible series whose own idx sorts after the
	// restored one; splicing in there reproduces its original relative
	// position. A series with no idx info at all falls back to its array
	// position, matching hideChartSeries's own fallback.
	const insertAt = data.series.findIndex((s, i) => (s.idx ?? i) > filtered.idx);
	const nextSeries = [...data.series];
	nextSeries.splice(insertAt === -1 ? nextSeries.length : insertAt, 0, restored);
	const remainingFiltered = (data.filteredSeries ?? []).filter((_, i) => i !== filteredIndex);
	return {
		...data,
		series: nextSeries,
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
