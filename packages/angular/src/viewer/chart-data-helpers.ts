/**
 * chart-data-helpers.ts: Pure immutable ELEMENT-level wrappers for chart data
 * editing (`ChartPptxElement` in, `ChartPptxElement` out).
 *
 * The row/column add-remove policy (auto-naming, refusing to drop the last
 * series/category, rejecting non-numeric cell input) lives once in shared's
 * `render/chart-data-grid-ops` (`addChartSeries`, `removeChartSeries`, etc.,
 * which operate on the bare `PptxChartData`); these functions just lift that
 * policy to the element level so `chart-data-editor.component.ts` can stay a
 * thin `elementChange` emitter. `setSeriesName`, `setSeriesColor`,
 * `patchChartStyle` and the advanced formatting wrappers below have no shared
 * equivalent yet and are genuinely local.
 *
 * All functions are immutable (return new objects, leave inputs unchanged)
 * and framework-agnostic.
 *
 * Ported from the React inspector:
 *   packages/react/src/viewer/components/inspector/ChartDataPanel.tsx
 *
 * @module angular-viewer/chart-data-helpers
 */

import {
	chartDataChangeType,
	chartDataUpdatePoint,
	setChartAxisGridlineStyle,
	setChartAxisLogScale,
	setChartAxisTitleStyle,
	setChartDataPointExplosion,
	setChartDataPointFill,
	setChartDataPointMarker,
	setChartSeriesChartType,
	setChartSeriesMarker,
} from 'pptx-viewer-core';
import type {
	ChartAxisTitleStyleEdit,
	ChartGridlineStyleEdit,
	ChartPptxElement,
	PptxChartAxisType,
	PptxChartData,
	PptxChartMarkerSymbol,
	PptxChartSeries,
	PptxChartStyle,
	PptxChartType,
} from 'pptx-viewer-core';

import {
	addChartCategory,
	addChartSeries,
	patchChartData as sharedPatchChartData,
	removeChartCategory,
	removeChartSeries,
	setChartCategoryLabel,
	setChartCellValue,
} from '../internal/shared';

// Re-export core primitives so callers can import everything from one place.
export { chartDataChangeType, chartDataUpdatePoint };

// ---------------------------------------------------------------------------
// Advanced formatting wrappers (log scale, title/gridline style, markers,
// combo per-series type, per-point fill/explosion).
//
// Each clones the element, runs the in-place core op, and returns a new
// `ChartPptxElement` so the Angular editor's immutable contract is preserved.
// These make the new chart-editing ops consumable from the Angular binding even
// though the dedicated inspector controls for them are not yet ported.
// ---------------------------------------------------------------------------

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

/** Enable/disable logarithmic scaling on an axis. */
export function setAxisLogScale(
	element: ChartPptxElement,
	axisType: PptxChartAxisType,
	opts: { enabled: boolean; base?: number },
): ChartPptxElement {
	return withClonedChart(element, (el) => setChartAxisLogScale(el, axisType, opts));
}

/** Edit an axis title's font styling. */
export function setAxisTitleStyle(
	element: ChartPptxElement,
	axisType: PptxChartAxisType,
	edit: ChartAxisTitleStyleEdit,
): ChartPptxElement {
	return withClonedChart(element, (el) => setChartAxisTitleStyle(el, axisType, edit));
}

/** Edit major/minor gridline line styling for an axis. */
export function setGridlineStyle(
	element: ChartPptxElement,
	axisType: PptxChartAxisType,
	which: 'major' | 'minor',
	edit: ChartGridlineStyleEdit,
): ChartPptxElement {
	return withClonedChart(element, (el) => setChartAxisGridlineStyle(el, axisType, which, edit));
}

/** Set or clear a series marker. */
export function setSeriesMarker(
	element: ChartPptxElement,
	seriesIndex: number,
	marker: { symbol?: PptxChartMarkerSymbol; size?: number; fillColor?: string } | null,
): ChartPptxElement {
	return withClonedChart(element, (el) => setChartSeriesMarker(el, seriesIndex, marker));
}

/** Set or clear a per-series chart type (combo charts). */
export function setSeriesChartType(
	element: ChartPptxElement,
	seriesIndex: number,
	seriesType: PptxChartType | null,
): ChartPptxElement {
	return withClonedChart(element, (el) => setChartSeriesChartType(el, seriesIndex, seriesType));
}

/** Set or clear a per-data-point fill colour. */
export function setDataPointFill(
	element: ChartPptxElement,
	seriesIndex: number,
	pointIndex: number,
	color: string | null,
): ChartPptxElement {
	return withClonedChart(element, (el) =>
		setChartDataPointFill(el, seriesIndex, pointIndex, color),
	);
}

/**
 * Set or clear a per-data-point marker override (`c:dPt/c:marker`), which
 * replaces the series marker for that one point.
 */
export function setDataPointMarker(
	element: ChartPptxElement,
	seriesIndex: number,
	pointIndex: number,
	marker: { symbol?: PptxChartMarkerSymbol; size?: number; fillColor?: string } | null,
): ChartPptxElement {
	return withClonedChart(element, (el) =>
		setChartDataPointMarker(el, seriesIndex, pointIndex, marker),
	);
}

/** Set or clear a per-data-point pie/doughnut slice explosion. */
export function setDataPointExplosion(
	element: ChartPptxElement,
	seriesIndex: number,
	pointIndex: number,
	explosion: number | null,
): ChartPptxElement {
	return withClonedChart(element, (el) =>
		setChartDataPointExplosion(el, seriesIndex, pointIndex, explosion),
	);
}

// ---------------------------------------------------------------------------
// addSeries
// ---------------------------------------------------------------------------

/**
 * Add a new blank series to a `ChartPptxElement`, returning a new element.
 *
 * The series is seeded with zeroes matching the current category count.
 * When the chart has no `chartData`, the element is returned unchanged.
 *
 * @param element - The source chart element (not mutated).
 * @returns A new `ChartPptxElement` with the series appended.
 *
 * @example
 * ```ts
 * const updated = addSeries(el);
 * ```
 */
export function addSeries(element: ChartPptxElement): ChartPptxElement {
	const chartData = element.chartData;
	if (!chartData) {
		return element;
	}
	return { ...element, chartData: addChartSeries(chartData) };
}

// ---------------------------------------------------------------------------
// removeSeries
// ---------------------------------------------------------------------------

/**
 * Remove a series by index from a `ChartPptxElement`, returning a new
 * element.
 *
 * Guards against removing the last series (requires at least 1).  When the
 * chart has no `chartData`, the element is returned unchanged.
 *
 * @param element - The source chart element (not mutated).
 * @param seriesIndex - Zero-based index of the series to remove.
 * @returns A new `ChartPptxElement`, or the original if removal is not
 *   possible.
 *
 * @example
 * ```ts
 * const updated = removeSeries(el, 1);
 * ```
 */
export function removeSeries(element: ChartPptxElement, seriesIndex: number): ChartPptxElement {
	const chartData = element.chartData;
	const next = chartData && removeChartSeries(chartData, seriesIndex);
	return next ? { ...element, chartData: next } : element;
}

// ---------------------------------------------------------------------------
// addCategory
// ---------------------------------------------------------------------------

/**
 * Append a new category (data column) to a `ChartPptxElement`, returning a
 * new element.
 *
 * @param element - The source chart element (not mutated).
 * @returns A new `ChartPptxElement` with the category appended.
 *
 * @example
 * ```ts
 * const updated = addCategory(el);
 * ```
 */
export function addCategory(element: ChartPptxElement): ChartPptxElement {
	const chartData = element.chartData;
	if (!chartData) {
		return element;
	}
	return { ...element, chartData: addChartCategory(chartData) };
}

// ---------------------------------------------------------------------------
// removeCategory
// ---------------------------------------------------------------------------

/**
 * Remove a category by index from a `ChartPptxElement`, returning a new
 * element.
 *
 * Guards against removing the last category (requires at least 1).
 *
 * @param element - The source chart element (not mutated).
 * @param catIndex - Zero-based index of the category to remove.
 * @returns A new `ChartPptxElement`, or the original if removal is not
 *   possible.
 *
 * @example
 * ```ts
 * const updated = removeCategory(el, 2);
 * ```
 */
export function removeCategory(element: ChartPptxElement, catIndex: number): ChartPptxElement {
	const chartData = element.chartData;
	const next = chartData && removeChartCategory(chartData, catIndex);
	return next ? { ...element, chartData: next } : element;
}

// ---------------------------------------------------------------------------
// setSeriesValue
// ---------------------------------------------------------------------------

/**
 * Update a single numeric value in a chart series, returning a new
 * `ChartPptxElement`.
 *
 * Parses `rawValue` as a float.  When the parsed value is not finite, the
 * element is returned unchanged.
 *
 * @param element - The source chart element (not mutated).
 * @param seriesIndex - Zero-based series index.
 * @param catIndex - Zero-based category (point) index.
 * @param rawValue - The new value as a string (from an `<input type="number">`).
 * @returns A new `ChartPptxElement`, or the original when the value is invalid.
 *
 * @example
 * ```ts
 * const updated = setSeriesValue(el, 0, 2, "42.5");
 * ```
 */
export function setSeriesValue(
	element: ChartPptxElement,
	seriesIndex: number,
	catIndex: number,
	rawValue: string,
): ChartPptxElement {
	const chartData = element.chartData;
	const next = chartData && setChartCellValue(chartData, seriesIndex, catIndex, rawValue);
	return next ? { ...element, chartData: next } : element;
}

// ---------------------------------------------------------------------------
// setSeriesName
// ---------------------------------------------------------------------------

/**
 * Rename a series in a `ChartPptxElement`, returning a new element.
 *
 * @param element - The source chart element (not mutated).
 * @param seriesIndex - Zero-based index of the series to rename.
 * @param name - The new series name.
 * @returns A new `ChartPptxElement`.
 *
 * @example
 * ```ts
 * const updated = setSeriesName(el, 0, "Revenue");
 * ```
 */
export function setSeriesName(
	element: ChartPptxElement,
	seriesIndex: number,
	name: string,
): ChartPptxElement {
	const chartData = element.chartData;
	if (!chartData) {
		return element;
	}
	const series = chartData.series.map((s, i): PptxChartSeries =>
		i === seriesIndex ? { ...s, name } : s,
	);
	return { ...element, chartData: { ...chartData, series } };
}

// ---------------------------------------------------------------------------
// setCategoryLabel
// ---------------------------------------------------------------------------

/**
 * Rename a category label in a `ChartPptxElement`, returning a new element.
 *
 * @param element - The source chart element (not mutated).
 * @param catIndex - Zero-based index of the category to rename.
 * @param label - The new label text.
 * @returns A new `ChartPptxElement`.
 *
 * @example
 * ```ts
 * const updated = setCategoryLabel(el, 0, "Q1 2025");
 * ```
 */
export function setCategoryLabel(
	element: ChartPptxElement,
	catIndex: number,
	label: string,
): ChartPptxElement {
	const chartData = element.chartData;
	const next = chartData && setChartCategoryLabel(chartData, catIndex, label);
	return next ? { ...element, chartData: next } : element;
}

// ---------------------------------------------------------------------------
// setSeriesColor
// ---------------------------------------------------------------------------

/**
 * Set (or clear) the solid fill colour of a chart series, returning a new
 * `ChartPptxElement`. Pass a hex string (`#RRGGBB` or `RRGGBB`) to set the
 * colour, or `null` to clear it so the series falls back to its theme colour.
 *
 * Mirrors the headless `setChartSeriesColor` SDK op (which mutates in place)
 * with an immutable element-level wrapper for the inspector.
 *
 * @param element - The source chart element (not mutated).
 * @param seriesIndex - Zero-based index of the series to recolour.
 * @param color - Hex colour string, or `null` to clear.
 * @returns A new `ChartPptxElement`.
 *
 * @example
 * ```ts
 * const updated = setSeriesColor(el, 0, "#4472C4");
 * ```
 */
export function setSeriesColor(
	element: ChartPptxElement,
	seriesIndex: number,
	color: string | null,
): ChartPptxElement {
	const chartData = element.chartData;
	if (!chartData) {
		return element;
	}
	const normalized = color ? normalizeHex(color) : undefined;
	const series = chartData.series.map((s, i): PptxChartSeries =>
		i === seriesIndex ? { ...s, color: normalized } : s,
	);
	return { ...element, chartData: { ...chartData, series } };
}

/** Normalise a hex colour to a `#`-prefixed form, trimming whitespace. */
function normalizeHex(color: string): string {
	const trimmed = color.trim();
	return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

// ---------------------------------------------------------------------------
// patchChartStyle
// ---------------------------------------------------------------------------

/**
 * Merge a `Partial<PptxChartStyle>` patch into a `ChartPptxElement`,
 * returning a new element.
 *
 * @param element - The source chart element (not mutated).
 * @param patch - Style fields to merge.
 * @returns A new `ChartPptxElement`.
 */
export function patchChartStyle(
	element: ChartPptxElement,
	patch: Partial<PptxChartStyle>,
): ChartPptxElement {
	const chartData = element.chartData;
	if (!chartData) {
		return element;
	}
	return {
		...element,
		chartData: { ...chartData, style: { ...chartData.style, ...patch } },
	};
}

// ---------------------------------------------------------------------------
// patchChartData
// ---------------------------------------------------------------------------

/**
 * Merge a `Partial<PptxChartData>` patch into a `ChartPptxElement`.
 *
 * When the patch contains a `chartType` change, the smart
 * `chartDataChangeType` helper is used so grouping and category formats
 * are adapted automatically.
 *
 * @param element - The source chart element (not mutated).
 * @param patch - Chart data fields to merge.
 * @returns A new `ChartPptxElement`.
 */
export function patchChartData(
	element: ChartPptxElement,
	patch: Partial<PptxChartData>,
): ChartPptxElement {
	const chartData = element.chartData;
	if (!chartData) {
		return element;
	}
	return { ...element, chartData: sharedPatchChartData(chartData, patch) };
}
