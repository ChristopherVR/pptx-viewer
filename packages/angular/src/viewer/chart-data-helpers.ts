/**
 * chart-data-helpers.ts: Pure immutable helpers for chart data editing.
 *
 * Thin wrappers / re-exports around the framework-agnostic core utilities in
 * `pptx-viewer-core` (`chartDataAddSeries`, `chartDataRemoveSeries`, etc.)
 * plus additional element-level helpers (`setSeriesName`, `setSeriesValue`,
 * `setCategoryLabel`) that aren't in the core package.
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
	chartDataAddCategory,
	chartDataAddSeries,
	chartDataChangeType,
	chartDataRemoveCategory,
	chartDataRemoveSeries,
	chartDataUpdatePoint,
	setChartAxisGridlineStyle,
	setChartAxisLogScale,
	setChartAxisTitleStyle,
	setChartDataPointExplosion,
	setChartDataPointFill,
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

// Re-export core primitives so callers can import everything from one place.
export {
	chartDataAddCategory,
	chartDataAddSeries,
	chartDataChangeType,
	chartDataRemoveCategory,
	chartDataRemoveSeries,
	chartDataUpdatePoint,
};

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
	const seriesCount = chartData.series.length;
	const catCount = chartData.categories.length;
	const newChartData = chartDataAddSeries(chartData, {
		name: `Series ${seriesCount + 1}`,
		values: Array.from({ length: catCount }, () => 0),
	});
	return { ...element, chartData: newChartData };
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
	if (!chartData || chartData.series.length <= 1) {
		return element;
	}
	return { ...element, chartData: chartDataRemoveSeries(chartData, seriesIndex) };
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
	const catCount = chartData.categories.length;
	return {
		...element,
		chartData: chartDataAddCategory(chartData, `Cat ${catCount + 1}`),
	};
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
	if (!chartData || chartData.categories.length <= 1) {
		return element;
	}
	return { ...element, chartData: chartDataRemoveCategory(chartData, catIndex) };
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
	if (!chartData) {
		return element;
	}
	const num = parseFloat(rawValue);
	if (!Number.isFinite(num)) {
		return element;
	}
	return { ...element, chartData: chartDataUpdatePoint(chartData, seriesIndex, catIndex, num) };
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
	const series = chartData.series.map(
		(s, i): PptxChartSeries => (i === seriesIndex ? { ...s, name } : s),
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
	if (!chartData) {
		return element;
	}
	const categories = chartData.categories.map((c, i) => (i === catIndex ? label : c));
	return { ...element, chartData: { ...chartData, categories } };
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
	const series = chartData.series.map(
		(s, i): PptxChartSeries => (i === seriesIndex ? { ...s, color: normalized } : s),
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
	if (patch.chartType && patch.chartType !== chartData.chartType) {
		const adapted = chartDataChangeType(chartData, patch.chartType as PptxChartType);
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { chartType: _ct, ...rest } = patch;
		return { ...element, chartData: { ...adapted, ...rest } };
	}
	return { ...element, chartData: { ...chartData, ...patch } };
}
