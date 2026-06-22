/**
 * Chart-inspector option catalogues: the pure, framework-agnostic value lists
 * (and supported-type Sets) that drive the advanced chart editor's selects and
 * conditional sections. Lifted out of the per-binding inspector code so React,
 * Vue, and Angular consume one source of truth instead of duplicating the
 * (long) option arrays.
 *
 * Names mirror React's local `chart-panel-constants.ts` (minus the i18n label
 * keys). Labels here are plain ASCII display strings; bindings that localise
 * (React's i18n) keep their own label-key tables, while the value lists,
 * supported-type Sets, and row metadata are what is genuinely shared.
 */
import type { PptxChartData, PptxChartType } from 'pptx-viewer-core';

/** Display units selectable for a value axis (empty string = none). */
export type ChartDisplayUnitsValue =
	| ''
	| 'hundreds'
	| 'thousands'
	| 'tenThousands'
	| 'hundredThousands'
	| 'millions'
	| 'tenMillions'
	| 'hundredMillions'
	| 'billions'
	| 'trillions';

/** Tick-label positions for an axis. */
export type ChartTickLabelPosition = 'nextTo' | 'high' | 'low' | 'none';

/** Data-label content flags (chart-level `c:show*`). */
export type ChartDataLabelContentKey =
	| 'showValue'
	| 'showCategory'
	| 'showSeriesName'
	| 'showPercent'
	| 'showLegendKey';

/** Data-label position values (empty string = type default). */
export type ChartDataLabelPositionValue = '' | 'ctr' | 'inEnd' | 'inBase' | 'outEnd' | 'bestFit';

/** Trendline regression types (empty string = none). */
export type ChartTrendlineValue =
	| ''
	| 'linear'
	| 'exponential'
	| 'logarithmic'
	| 'polynomial'
	| 'power'
	| 'movingAvg';

/** Error-bar value calculation types (empty string = none). */
export type ChartErrorBarValType = '' | 'fixedVal' | 'percentage' | 'stdDev' | 'stdErr';

/** Error-bar display directions. */
export type ChartErrorBarType = 'both' | 'plus' | 'minus';

/** Marker symbols (empty string = auto, omits the marker). */
export type ChartMarkerSymbolValue =
	| ''
	| 'none'
	| 'circle'
	| 'square'
	| 'diamond'
	| 'triangle'
	| 'x'
	| 'star'
	| 'plus'
	| 'dot'
	| 'dash';

/** Gridline dash styles (empty string = default). */
export type ChartGridlineDashValue =
	| ''
	| 'solid'
	| 'dash'
	| 'dot'
	| 'dashDot'
	| 'lgDash'
	| 'sysDash'
	| 'sysDot';

/** A simple value/label option for a `<select>`. */
export interface ChartOption<V> {
	value: V;
	label: string;
}

export const CHART_TYPE_OPTIONS: ReadonlyArray<ChartOption<PptxChartType>> = [
	{ value: 'bar', label: 'Bar' },
	{ value: 'line', label: 'Line' },
	{ value: 'pie', label: 'Pie' },
	{ value: 'doughnut', label: 'Doughnut' },
	{ value: 'area', label: 'Area' },
	{ value: 'scatter', label: 'Scatter' },
	{ value: 'bubble', label: 'Bubble' },
	{ value: 'radar', label: 'Radar' },
	{ value: 'stock', label: 'Stock' },
	{ value: 'waterfall', label: 'Waterfall' },
	{ value: 'combo', label: 'Combo' },
];

export const GROUPING_OPTIONS: ReadonlyArray<ChartOption<PptxChartData['grouping']>> = [
	{ value: 'clustered', label: 'Clustered' },
	{ value: 'stacked', label: 'Stacked' },
	{ value: 'percentStacked', label: '100% Stacked' },
];

export const LEGEND_POSITION_OPTIONS: ReadonlyArray<ChartOption<string>> = [
	{ value: 't', label: 'Top' },
	{ value: 'b', label: 'Bottom' },
	{ value: 'l', label: 'Left' },
	{ value: 'r', label: 'Right' },
];

export const TICK_LABEL_POSITION_OPTIONS: ReadonlyArray<ChartOption<ChartTickLabelPosition>> = [
	{ value: 'nextTo', label: 'Next to axis' },
	{ value: 'high', label: 'High' },
	{ value: 'low', label: 'Low' },
	{ value: 'none', label: 'None' },
];

export const DISPLAY_UNITS_OPTIONS: ReadonlyArray<ChartOption<ChartDisplayUnitsValue>> = [
	{ value: '', label: 'None' },
	{ value: 'hundreds', label: 'Hundreds' },
	{ value: 'thousands', label: 'Thousands' },
	{ value: 'tenThousands', label: 'Ten Thousands' },
	{ value: 'hundredThousands', label: 'Hundred Thousands' },
	{ value: 'millions', label: 'Millions' },
	{ value: 'tenMillions', label: 'Ten Millions' },
	{ value: 'hundredMillions', label: 'Hundred Millions' },
	{ value: 'billions', label: 'Billions' },
	{ value: 'trillions', label: 'Trillions' },
];

export const DATA_LABEL_CONTENT_OPTIONS: ReadonlyArray<{
	key: ChartDataLabelContentKey;
	label: string;
}> = [
	{ key: 'showValue', label: 'Value' },
	{ key: 'showCategory', label: 'Category name' },
	{ key: 'showSeriesName', label: 'Series name' },
	{ key: 'showPercent', label: 'Percentage' },
	{ key: 'showLegendKey', label: 'Legend key' },
];

export const DATA_LABEL_POSITION_OPTIONS: ReadonlyArray<ChartOption<ChartDataLabelPositionValue>> =
	[
		{ value: '', label: 'Default' },
		{ value: 'ctr', label: 'Center' },
		{ value: 'inEnd', label: 'Inside End' },
		{ value: 'inBase', label: 'Inside Base' },
		{ value: 'outEnd', label: 'Outside End' },
		{ value: 'bestFit', label: 'Best Fit' },
	];

export const TRENDLINE_TYPE_OPTIONS: ReadonlyArray<ChartOption<ChartTrendlineValue>> = [
	{ value: '', label: 'None' },
	{ value: 'linear', label: 'Linear' },
	{ value: 'exponential', label: 'Exponential' },
	{ value: 'logarithmic', label: 'Logarithmic' },
	{ value: 'polynomial', label: 'Polynomial' },
	{ value: 'power', label: 'Power' },
	{ value: 'movingAvg', label: 'Moving Average' },
];

export const ERROR_BAR_VALTYPE_OPTIONS: ReadonlyArray<ChartOption<ChartErrorBarValType>> = [
	{ value: '', label: 'None' },
	{ value: 'fixedVal', label: 'Fixed value' },
	{ value: 'percentage', label: 'Percentage' },
	{ value: 'stdDev', label: 'Standard deviation' },
	{ value: 'stdErr', label: 'Standard error' },
];

export const ERROR_BAR_TYPE_OPTIONS: ReadonlyArray<ChartOption<ChartErrorBarType>> = [
	{ value: 'both', label: 'Both' },
	{ value: 'plus', label: 'Plus' },
	{ value: 'minus', label: 'Minus' },
];

export const MARKER_SYMBOL_OPTIONS: ReadonlyArray<ChartOption<ChartMarkerSymbolValue>> = [
	{ value: '', label: 'Auto' },
	{ value: 'none', label: 'None' },
	{ value: 'circle', label: 'Circle' },
	{ value: 'square', label: 'Square' },
	{ value: 'diamond', label: 'Diamond' },
	{ value: 'triangle', label: 'Triangle' },
	{ value: 'x', label: 'X' },
	{ value: 'star', label: 'Star' },
	{ value: 'plus', label: 'Plus' },
	{ value: 'dot', label: 'Dot' },
	{ value: 'dash', label: 'Dash' },
];

export const GRIDLINE_DASH_OPTIONS: ReadonlyArray<ChartOption<ChartGridlineDashValue>> = [
	{ value: '', label: 'Default' },
	{ value: 'solid', label: 'Solid' },
	{ value: 'dash', label: 'Dash' },
	{ value: 'dot', label: 'Dot' },
	{ value: 'dashDot', label: 'Dash Dot' },
	{ value: 'lgDash', label: 'Long Dash' },
];

export const COMBO_SERIES_TYPE_OPTIONS: ReadonlyArray<ChartOption<'' | PptxChartType>> = [
	{ value: '', label: 'Default' },
	{ value: 'bar', label: 'Bar' },
	{ value: 'line', label: 'Line' },
	{ value: 'area', label: 'Area' },
	{ value: 'scatter', label: 'Scatter' },
];

/** Axis kinds the inspector exposes, with whether they carry a numeric scale. */
export const EDITABLE_AXIS_ROWS: ReadonlyArray<{
	type: 'valAx' | 'dateAx' | 'catAx';
	label: string;
	hasScale: boolean;
}> = [
	{ type: 'valAx', label: 'Value axis', hasScale: true },
	{ type: 'dateAx', label: 'Date axis', hasScale: true },
	{ type: 'catAx', label: 'Category axis', hasScale: false },
];

/** Chart types that support clustered/stacked grouping modes. */
export const GROUPING_SUPPORTED_TYPES: ReadonlySet<PptxChartType> = new Set<PptxChartType>([
	'bar',
	'line',
	'area',
]);

/** Chart types where trendlines are meaningful. */
export const TRENDLINE_SUPPORTED_TYPES: ReadonlySet<PptxChartType> = new Set<PptxChartType>([
	'bar',
	'line',
	'area',
	'scatter',
	'bubble',
]);

/** Chart types where error bars are meaningful. */
export const ERROR_BAR_SUPPORTED_TYPES: ReadonlySet<PptxChartType> = new Set<PptxChartType>([
	'bar',
	'line',
	'area',
	'scatter',
	'bubble',
]);

/** Value types that take a numeric amount (stdErr does not). */
export const ERROR_BAR_VALUE_TYPES: ReadonlySet<string> = new Set<string>([
	'fixedVal',
	'percentage',
	'stdDev',
]);

/** Chart types where series markers are meaningful. */
export const MARKER_SUPPORTED_TYPES: ReadonlySet<PptxChartType> = new Set<PptxChartType>([
	'line',
	'scatter',
	'bubble',
	'radar',
]);

/** Cartesian chart types where a per-series combo type makes sense. */
export const COMBO_SUPPORTED_TYPES: ReadonlySet<PptxChartType> = new Set<PptxChartType>([
	'bar',
	'line',
	'area',
	'combo',
]);

/** Chart types where per-point slice explosion (pull-out) is meaningful. */
export const EXPLOSION_SUPPORTED_TYPES: ReadonlySet<PptxChartType> = new Set<PptxChartType>([
	'pie',
	'pie3D',
	'doughnut',
	'ofPie',
]);
