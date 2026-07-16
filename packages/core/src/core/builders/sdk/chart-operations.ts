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
	PptxChartDataLabel,
	PptxChartDataLabelOptions,
	PptxChartDataPoint,
	PptxChartErrBars,
	PptxChartMarker,
	PptxChartMarkerSymbol,
	PptxChartShapeProps,
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

/**
 * Set (or clear) the error bars on a chart series. Edits round-trip to the
 * saved `.pptx` (`c:errBars` inside the series).
 *
 * Pass a {@link PptxChartErrBars} to add/replace the series' error bars, or
 * `null` to remove them. This manages a single error-bar definition per series
 * (the common case); charts with both X and Y error bars can be edited via the
 * `series.errBars` array directly.
 *
 * @example
 * ```ts
 * setChartSeriesErrorBars(chartEl, 0, { direction: "y", barType: "both", valType: "percentage", val: 5 });
 * setChartSeriesErrorBars(chartEl, 0, null); // remove
 * ```
 */
export function setChartSeriesErrorBars(
	element: ChartPptxElement,
	seriesIndex: number,
	errBars: PptxChartErrBars | null,
): void {
	validateSeriesIndex(element, seriesIndex);
	element.chartData!.series[seriesIndex].errBars = errBars ? [errBars] : [];
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
	orientation?: PptxChartAxisFormatting['orientation'] | null;
	numberFormat?: string;
	tickLabelPosition?: 'high' | 'low' | 'nextTo' | 'none';
	/** Axis title text. Pass `null` or `''` to remove the title. */
	title?: string | null;
	/** Toggle major gridlines. */
	majorGridlines?: boolean;
	/** Toggle minor gridlines. */
	minorGridlines?: boolean;
	/** Value-axis display units (built-in scale name or `'custom'`); `null` clears. */
	displayUnits?: PptxChartAxisFormatting['displayUnits'] | null;
	/** Custom display-unit divisor (used when `displayUnits` is `'custom'`). */
	displayUnitsValue?: number | null;
	/** Display-unit label text/layout/shape options. `null` removes the label. */
	displayUnitsLabel?: PptxChartAxisFormatting['displayUnitsLabel'];
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
	if (edit.orientation !== undefined) {
		axis.orientation = edit.orientation ?? undefined;
	}
	if (edit.numberFormat !== undefined) {
		axis.numFmt = edit.numberFormat
			? { formatCode: edit.numberFormat, sourceLinked: false }
			: undefined;
	}
	if (edit.tickLabelPosition !== undefined) {
		axis.tickLblPos = edit.tickLabelPosition;
	}
	if (edit.title !== undefined) {
		// '' (or null) is retained as a clear marker the save pipeline removes.
		axis.titleText = edit.title ?? '';
	}
	if (edit.majorGridlines !== undefined) {
		axis.majorGridlines = edit.majorGridlines;
	}
	if (edit.minorGridlines !== undefined) {
		axis.minorGridlines = edit.minorGridlines;
	}
	if (edit.displayUnits !== undefined) {
		axis.displayUnits = edit.displayUnits ?? undefined;
	}
	if (edit.displayUnitsValue !== undefined) {
		axis.displayUnitsValue = edit.displayUnitsValue ?? undefined;
	}
	if (edit.displayUnitsLabel !== undefined) {
		axis.displayUnitsLabel = edit.displayUnitsLabel;
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

/**
 * Set (or clear) the solid fill colour of a chart series. Edits round-trip to
 * the saved `.pptx` (`c:spPr > a:solidFill > a:srgbClr` inside the series).
 *
 * Pass a hex colour (`#RRGGBB` or `RRGGBB`, case-insensitive) to set the
 * series colour, or `null`/`undefined` to clear it so the series falls back to
 * its automatic theme colour.
 *
 * @param element - The chart element to modify.
 * @param seriesIndex - Zero-based index of the series to recolour.
 * @param color - Hex colour string, or `null`/`undefined` to clear.
 * @throws {RangeError} If `seriesIndex` is out of bounds.
 *
 * @example
 * ```ts
 * setChartSeriesColor(chartEl, 0, "#4472C4");
 * setChartSeriesColor(chartEl, 0, null); // clear -> back to theme colour
 * ```
 */
export function setChartSeriesColor(
	element: ChartPptxElement,
	seriesIndex: number,
	color: string | null | undefined,
): void {
	validateSeriesIndex(element, seriesIndex);
	const series = element.chartData!.series[seriesIndex];
	if (!color) {
		series.color = undefined;
		return;
	}
	const trimmed = color.trim();
	series.color = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

// ---------------------------------------------------------------------------
// Axis log scaling, title styling, gridline styling
// ---------------------------------------------------------------------------

/**
 * Find (or create) the first axis of `axisType` in `chartData.axes`.
 * Mirrors the lookup that {@link setChartAxis} performs.
 */
function ensureAxis(
	element: ChartPptxElement,
	axisType: PptxChartAxisType,
): PptxChartAxisFormatting {
	ensureChartData(element);
	const axes = (element.chartData.axes ??= []);
	let axis = axes.find((a) => a.axisType === axisType);
	if (!axis) {
		axis = { axisType };
		axes.push(axis);
	}
	return axis;
}

/**
 * Enable or disable logarithmic scaling on an axis, optionally setting the log
 * base. Round-trips to the saved `.pptx` (`c:scaling/c:logBase`).
 *
 * Pass `{ enabled: true, base: 10 }` to turn on a base-10 log scale, or
 * `{ enabled: false }` to revert to linear scaling (which removes `c:logBase`).
 *
 * @example
 * ```ts
 * setChartAxisLogScale(chartEl, "valAx", { enabled: true, base: 10 });
 * setChartAxisLogScale(chartEl, "valAx", { enabled: false });
 * ```
 */
export function setChartAxisLogScale(
	element: ChartPptxElement,
	axisType: PptxChartAxisType,
	opts: { enabled: boolean; base?: number },
): void {
	const axis = ensureAxis(element, axisType);
	axis.logScale = opts.enabled;
	if (opts.enabled) {
		// Default to base 10 (the most common log base) when none provided.
		axis.logBase = opts.base ?? axis.logBase ?? 10;
	} else {
		axis.logBase = undefined;
	}
}

/** Editable axis-title font styling. Omit a field to leave it unchanged; pass `null` to clear it. */
export interface ChartAxisTitleStyleEdit {
	fontFamily?: string | null;
	fontSize?: number | null;
	fontBold?: boolean;
	fontColor?: string | null;
}

/**
 * Edit the font styling (family, size, bold, colour) of an axis title. The
 * title TEXT itself is edited via {@link setChartAxis}'s `title` field; this
 * controls only its appearance. Round-trips to the saved `.pptx`
 * (`c:title/c:txPr` run properties).
 *
 * @example
 * ```ts
 * setChartAxisTitleStyle(chartEl, "valAx", { fontFamily: "Calibri", fontSize: 12, fontBold: true });
 * ```
 */
export function setChartAxisTitleStyle(
	element: ChartPptxElement,
	axisType: PptxChartAxisType,
	edit: ChartAxisTitleStyleEdit,
): void {
	const axis = ensureAxis(element, axisType);
	if (edit.fontFamily !== undefined) {
		axis.fontFamily = edit.fontFamily ?? undefined;
	}
	if (edit.fontSize !== undefined) {
		axis.fontSize = edit.fontSize ?? undefined;
	}
	if (edit.fontBold !== undefined) {
		axis.fontBold = edit.fontBold;
	}
	if (edit.fontColor !== undefined) {
		axis.fontColor = edit.fontColor ?? undefined;
	}
}

/** Editable gridline line styling (colour, width in points, dash style). */
export interface ChartGridlineStyleEdit {
	color?: string | null;
	width?: number | null;
	dashStyle?: string | null;
}

/**
 * Edit the line styling (colour, width, dash style) of an axis's major or minor
 * gridlines. Setting any style implicitly turns the gridlines on. Round-trips
 * to the saved `.pptx` (`c:majorGridlines/c:spPr` or `c:minorGridlines/c:spPr`).
 *
 * @example
 * ```ts
 * setChartAxisGridlineStyle(chartEl, "valAx", "major", { color: "#CCCCCC", width: 0.75, dashStyle: "dash" });
 * ```
 */
export function setChartAxisGridlineStyle(
	element: ChartPptxElement,
	axisType: PptxChartAxisType,
	which: 'major' | 'minor',
	edit: ChartGridlineStyleEdit,
): void {
	const axis = ensureAxis(element, axisType);
	const key = which === 'major' ? 'majorGridlinesSpPr' : 'minorGridlinesSpPr';
	const flagKey = which === 'major' ? 'majorGridlines' : 'minorGridlines';
	const props: PptxChartShapeProps = { ...(axis[key] ?? {}) };
	if (edit.color !== undefined) {
		props.strokeColor = edit.color ?? undefined;
	}
	if (edit.width !== undefined) {
		props.strokeWidth = edit.width ?? undefined;
	}
	if (edit.dashStyle !== undefined) {
		props.strokeDashStyle = edit.dashStyle ?? undefined;
	}
	const hasAnyProp =
		props.strokeColor !== undefined ||
		props.strokeWidth !== undefined ||
		props.strokeDashStyle !== undefined ||
		props.fillColor !== undefined;
	axis[key] = hasAnyProp ? props : undefined;
	if (hasAnyProp) {
		axis[flagKey] = true;
	}
}

// ---------------------------------------------------------------------------
// Series markers, per-series combo type
// ---------------------------------------------------------------------------

/**
 * Set (or clear) the marker on a chart series. Markers apply to line, scatter,
 * bubble, and radar charts. Round-trips to the saved `.pptx` (`c:marker` inside
 * the series).
 *
 * Pass a {@link PptxChartMarker} to set the marker, a partial marker patch to
 * merge into the existing one, or `null` to remove the marker entirely.
 *
 * @example
 * ```ts
 * setChartSeriesMarker(chartEl, 0, { symbol: "circle", size: 7, spPr: { fillColor: "#FF0000" } });
 * setChartSeriesMarker(chartEl, 1, { symbol: "none" });
 * setChartSeriesMarker(chartEl, 0, null); // remove
 * ```
 */
export function setChartSeriesMarker(
	element: ChartPptxElement,
	seriesIndex: number,
	marker:
		| PptxChartMarker
		| { symbol?: PptxChartMarkerSymbol; size?: number; fillColor?: string }
		| null,
): void {
	validateSeriesIndex(element, seriesIndex);
	const series = element.chartData!.series[seriesIndex];
	if (marker === null) {
		series.marker = undefined;
		return;
	}
	const existing = series.marker;
	if ('symbol' in marker && 'spPr' in marker) {
		series.marker = marker as PptxChartMarker;
		return;
	}
	const patch = marker as { symbol?: PptxChartMarkerSymbol; size?: number; fillColor?: string };
	const next: PptxChartMarker = {
		symbol: patch.symbol ?? existing?.symbol ?? 'circle',
		size: patch.size ?? existing?.size,
		spPr: existing?.spPr ? { ...existing.spPr } : undefined,
	};
	if (patch.fillColor !== undefined) {
		next.spPr = { ...(next.spPr ?? {}), fillColor: patch.fillColor };
	}
	series.marker = next;
}

/**
 * Set (or clear) the per-series chart type for a combo chart. When set, the
 * series is plotted with `seriesType` (e.g. a `line` series within an otherwise
 * `bar` chart). Pass `null` to clear it so the series uses the chart-level type.
 *
 * Setting a per-series type also promotes the chart to `combo` so that the save
 * pipeline emits multiple chart-type containers.
 *
 * @example
 * ```ts
 * setChartSeriesChartType(chartEl, 1, "line");
 * setChartSeriesChartType(chartEl, 1, null); // revert to chart-level type
 * ```
 */
export function setChartSeriesChartType(
	element: ChartPptxElement,
	seriesIndex: number,
	seriesType: PptxChartType | null,
): void {
	validateSeriesIndex(element, seriesIndex);
	const data = element.chartData!;
	data.series[seriesIndex].seriesChartType = seriesType ?? undefined;
	// Promote to combo when at least two distinct effective types exist.
	const effective = new Set(
		data.series.map((s) => s.seriesChartType ?? data.chartType).filter((t) => t !== 'combo'),
	);
	if (effective.size > 1) {
		data.chartType = 'combo';
	}
}

// ---------------------------------------------------------------------------
// Per-data-point formatting overrides (c:dPt)
// ---------------------------------------------------------------------------

/** Find (or create) the `c:dPt` override for `pointIndex` in a series. */
function ensureDataPoint(
	series: { dataPoints?: PptxChartDataPoint[] },
	pointIndex: number,
): PptxChartDataPoint {
	const points = (series.dataPoints ??= []);
	let dp = points.find((p) => p.idx === pointIndex);
	if (!dp) {
		dp = { idx: pointIndex };
		points.push(dp);
		points.sort((a, b) => a.idx - b.idx);
	}
	return dp;
}

/**
 * Set (or clear) the fill colour of a single data point, overriding the series
 * colour for that point only. Round-trips to the saved `.pptx`
 * (`c:dPt/c:spPr/a:solidFill` keyed by `c:idx`).
 *
 * Pass a hex colour to set the fill, or `null` to remove the per-point fill
 * (dropping the whole `c:dPt` override when nothing else is set on it).
 *
 * @example
 * ```ts
 * setChartDataPointFill(chartEl, 0, 2, "#FF0000");
 * setChartDataPointFill(chartEl, 0, 2, null); // clear
 * ```
 */
export function setChartDataPointFill(
	element: ChartPptxElement,
	seriesIndex: number,
	pointIndex: number,
	color: string | null,
): void {
	validateSeriesIndex(element, seriesIndex);
	const series = element.chartData!.series[seriesIndex];
	if (color === null) {
		const dp = series.dataPoints?.find((p) => p.idx === pointIndex);
		if (!dp) {
			return;
		}
		if (dp.spPr) {
			dp.spPr = { ...dp.spPr, fillColor: undefined };
			if (
				dp.spPr.fillColor === undefined &&
				dp.spPr.strokeColor === undefined &&
				dp.spPr.strokeWidth === undefined &&
				dp.spPr.strokeDashStyle === undefined
			) {
				dp.spPr = undefined;
			}
		}
		removeEmptyDataPoint(series, pointIndex);
		return;
	}
	const dp = ensureDataPoint(series, pointIndex);
	dp.spPr = { ...(dp.spPr ?? {}), fillColor: color };
}

/**
 * Set (or clear) the explosion (slice pull-out distance, 0-100) of a single pie
 * or doughnut data point. Round-trips to the saved `.pptx`
 * (`c:dPt/c:explosion` keyed by `c:idx`).
 *
 * Pass `null` to remove the explosion (dropping the `c:dPt` override when
 * nothing else is set on it).
 *
 * @example
 * ```ts
 * setChartDataPointExplosion(chartEl, 0, 1, 25);
 * setChartDataPointExplosion(chartEl, 0, 1, null); // clear
 * ```
 */
export function setChartDataPointExplosion(
	element: ChartPptxElement,
	seriesIndex: number,
	pointIndex: number,
	explosion: number | null,
): void {
	validateSeriesIndex(element, seriesIndex);
	const series = element.chartData!.series[seriesIndex];
	if (explosion === null) {
		const dp = series.dataPoints?.find((p) => p.idx === pointIndex);
		if (dp) {
			dp.explosion = undefined;
			removeEmptyDataPoint(series, pointIndex);
		}
		return;
	}
	const dp = ensureDataPoint(series, pointIndex);
	dp.explosion = explosion;
}

/**
 * Set (or clear) the marker override for a single data point, overriding the
 * series-level marker for that point only. Round-trips to the saved `.pptx`
 * (`c:dPt/c:marker` keyed by `c:idx`).
 *
 * Pass a marker patch to set/merge the override, or `null` to remove it
 * (dropping the whole `c:dPt` override when nothing else is set on it).
 *
 * @example
 * ```ts
 * setChartDataPointMarker(chartEl, 0, 2, { symbol: "circle", size: 7, fillColor: "#FF0000" });
 * setChartDataPointMarker(chartEl, 0, 2, null); // clear
 * ```
 */
export function setChartDataPointMarker(
	element: ChartPptxElement,
	seriesIndex: number,
	pointIndex: number,
	marker: { symbol?: PptxChartMarkerSymbol; size?: number; fillColor?: string } | null,
): void {
	validateSeriesIndex(element, seriesIndex);
	const series = element.chartData!.series[seriesIndex];
	if (marker === null) {
		const dp = series.dataPoints?.find((p) => p.idx === pointIndex);
		if (dp) {
			dp.marker = undefined;
			removeEmptyDataPoint(series, pointIndex);
		}
		return;
	}
	const dp = ensureDataPoint(series, pointIndex);
	const existing = dp.marker;
	const next: PptxChartMarker = {
		symbol: marker.symbol ?? existing?.symbol ?? 'circle',
		size: marker.size ?? existing?.size,
		spPr: existing?.spPr ? { ...existing.spPr } : undefined,
	};
	if (marker.fillColor !== undefined) {
		next.spPr = { ...(next.spPr ?? {}), fillColor: marker.fillColor };
	}
	dp.marker = next;
}

// ---------------------------------------------------------------------------
// Per-data-point label overrides (c:dLbl)
// ---------------------------------------------------------------------------

/** Editable per-data-point label fields. Omit a field to leave it unchanged. */
export interface ChartDataPointLabelEdit {
	/** Show the numeric value (`c:showVal`). */
	showValue?: boolean;
	/** Show the category name (`c:showCatName`). */
	showCategory?: boolean;
	/** Show the series name (`c:showSerName`). */
	showSeriesName?: boolean;
	/** Show the percentage (`c:showPercent`). */
	showPercent?: boolean;
	/** Show the legend key swatch (`c:showLegendKey`). */
	showLegendKey?: boolean;
	/** Label position (`c:dLblPos`). */
	position?: PptxChartDataLabel['position'];
	/** Custom label text override (`c:tx`). Pass `''` to clear it. */
	text?: string;
}

/** Map a {@link ChartDataPointLabelEdit} onto an existing/new label override. */
function applyLabelEdit(label: PptxChartDataLabel, edit: ChartDataPointLabelEdit): void {
	if (edit.showValue !== undefined) {
		label.showVal = edit.showValue;
	}
	if (edit.showCategory !== undefined) {
		label.showCatName = edit.showCategory;
	}
	if (edit.showSeriesName !== undefined) {
		label.showSerName = edit.showSeriesName;
	}
	if (edit.showPercent !== undefined) {
		label.showPercent = edit.showPercent;
	}
	if (edit.showLegendKey !== undefined) {
		label.showLegendKey = edit.showLegendKey;
	}
	if (edit.position !== undefined) {
		label.position = edit.position;
	}
	if (edit.text !== undefined) {
		label.text = edit.text === '' ? undefined : edit.text;
	}
}

/**
 * Set (or clear) the individual data-label override for a single data point of a
 * series, independent of the series-level data labels. Round-trips to the saved
 * `.pptx` (`c:dLbl` keyed by `c:idx` inside the series' `c:dLbls`).
 *
 * Pass a {@link ChartDataPointLabelEdit} to add/merge the override for that
 * point, or `null` to remove it (reverting the point to the series default).
 *
 * @param element - The chart element to modify.
 * @param seriesIndex - Zero-based index of the series.
 * @param pointIndex - Zero-based index of the data point (category).
 * @param edit - The label fields to set, or `null` to remove the override.
 * @throws {RangeError} If `seriesIndex` is out of bounds.
 *
 * @example
 * ```ts
 * setChartDataPointLabel(chartEl, 0, 2, { showValue: true, position: "outEnd" });
 * setChartDataPointLabel(chartEl, 0, 2, { text: "Peak" });
 * setChartDataPointLabel(chartEl, 0, 2, null); // remove the override
 * ```
 */
export function setChartDataPointLabel(
	element: ChartPptxElement,
	seriesIndex: number,
	pointIndex: number,
	edit: ChartDataPointLabelEdit | null,
): void {
	validateSeriesIndex(element, seriesIndex);
	const series = element.chartData!.series[seriesIndex];
	if (edit === null) {
		if (!series.dataLabels) {
			return;
		}
		series.dataLabels = series.dataLabels.filter((l) => l.idx !== pointIndex);
		if (series.dataLabels.length === 0) {
			series.dataLabels = undefined;
		}
		return;
	}
	const labels = (series.dataLabels ??= []);
	let label = labels.find((l) => l.idx === pointIndex);
	if (!label) {
		label = { idx: pointIndex };
		labels.push(label);
		labels.sort((a, b) => a.idx - b.idx);
	}
	applyLabelEdit(label, edit);
}

/** Drop a `c:dPt` override that no longer carries any formatting. */
function removeEmptyDataPoint(
	series: { dataPoints?: PptxChartDataPoint[] },
	pointIndex: number,
): void {
	if (!series.dataPoints) {
		return;
	}
	const dp = series.dataPoints.find((p) => p.idx === pointIndex);
	if (!dp) {
		return;
	}
	const empty =
		dp.spPr === undefined &&
		dp.explosion === undefined &&
		dp.invertIfNegative === undefined &&
		dp.marker === undefined;
	if (empty) {
		series.dataPoints = series.dataPoints.filter((p) => p.idx !== pointIndex);
		if (series.dataPoints.length === 0) {
			series.dataPoints = undefined;
		}
	}
}
