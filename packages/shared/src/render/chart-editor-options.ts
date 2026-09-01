/**
 * Chart-inspector option catalogues: the pure, framework-agnostic value lists
 * (and supported-type Sets) that drive the advanced chart editor's selects and
 * conditional sections. Lifted out of the per-binding inspector code so React,
 * Vue, and Angular consume one source of truth instead of duplicating the
 * (long) option arrays.
 *
 * Each option carries both a plain-ASCII `label` (for non-i18n consumers) and
 * a `labelKey` (a `pptx.chart.*` dotted key resolvable via each binding's
 * translation function, defined in `pptx-viewer-shared/i18n`). The `labelKey`
 * values mirror React's local `chart-panel-constants.ts`, which keeps its own
 * copy of these tables for historical reasons but resolves to the same keys.
 */
import type { PptxChartData, PptxChartDataLabelPosition, PptxChartType } from 'pptx-viewer-core';
import { chartDataChangeType } from 'pptx-viewer-core';

import { applyParetoConversion } from './chart-pareto';

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

/**
 * Data-label position values (empty string = type default). The non-empty
 * members are exactly the nine `c:dLblPos` schema values core models as
 * {@link PptxChartDataLabelPosition}; the select used to offer five of them,
 * so a line/scatter chart's "Above" / "Left" labels could not be authored.
 */
export type ChartDataLabelPositionValue = '' | PptxChartDataLabelPosition;

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
	labelKey: string;
}

/**
 * The value a "Change Chart Type" select may carry. Widens {@link PptxChartType}
 * with `'pareto'`, a `histogram`-family entry that has no `PptxChartType` of
 * its own (see docs/guide/limitations.md's ChartEx row): selecting it converts
 * to `chartType: 'histogram'` and appends the cumulative-percentage series
 * `applyParetoConversion` builds, rather than being stored verbatim on
 * `PptxChartData.chartType`.
 */
export type ChartTypeSelectValue = PptxChartType | 'pareto';

export const CHART_TYPE_OPTIONS: ReadonlyArray<ChartOption<ChartTypeSelectValue>> = [
	{ value: 'bar', label: 'Bar', labelKey: 'pptx.chart.typeBar' },
	{ value: 'bar3D', label: 'Bar (3-D)', labelKey: 'pptx.chart.typeBar3D' },
	{ value: 'line', label: 'Line', labelKey: 'pptx.chart.typeLine' },
	{ value: 'line3D', label: 'Line (3-D)', labelKey: 'pptx.chart.typeLine3D' },
	{ value: 'pie', label: 'Pie', labelKey: 'pptx.chart.typePie' },
	{ value: 'pie3D', label: 'Pie (3-D)', labelKey: 'pptx.chart.typePie3D' },
	{ value: 'doughnut', label: 'Doughnut', labelKey: 'pptx.chart.typeDoughnut' },
	{ value: 'area', label: 'Area', labelKey: 'pptx.chart.typeArea' },
	{ value: 'area3D', label: 'Area (3-D)', labelKey: 'pptx.chart.typeArea3D' },
	{ value: 'surface', label: 'Surface', labelKey: 'pptx.chart.typeSurface' },
	{ value: 'scatter', label: 'Scatter', labelKey: 'pptx.chart.typeScatter' },
	{ value: 'bubble', label: 'Bubble', labelKey: 'pptx.chart.typeBubble' },
	{ value: 'radar', label: 'Radar', labelKey: 'pptx.chart.typeRadar' },
	{ value: 'stock', label: 'Stock', labelKey: 'pptx.chart.typeStock' },
	{ value: 'waterfall', label: 'Waterfall', labelKey: 'pptx.chart.typeWaterfall' },
	{ value: 'histogram', label: 'Histogram', labelKey: 'pptx.chart.typeHistogram' },
	{ value: 'pareto', label: 'Pareto', labelKey: 'pptx.chart.typePareto' },
	{ value: 'funnel', label: 'Funnel', labelKey: 'pptx.chart.typeFunnel' },
	{ value: 'treemap', label: 'Treemap', labelKey: 'pptx.chart.typeTreemap' },
	{ value: 'sunburst', label: 'Sunburst', labelKey: 'pptx.chart.typeSunburst' },
	{ value: 'boxWhisker', label: 'Box and Whisker', labelKey: 'pptx.chart.typeBoxWhisker' },
	{ value: 'regionMap', label: 'Filled Map', labelKey: 'pptx.chart.typeRegionMap' },
	{ value: 'combo', label: 'Combo', labelKey: 'pptx.chart.typeCombo' },
];

export const GROUPING_OPTIONS: ReadonlyArray<ChartOption<PptxChartData['grouping']>> = [
	{ value: 'clustered', label: 'Clustered', labelKey: 'pptx.chart.groupingClustered' },
	{ value: 'stacked', label: 'Stacked', labelKey: 'pptx.chart.groupingStacked' },
	{
		value: 'percentStacked',
		label: '100% Stacked',
		labelKey: 'pptx.chart.groupingPercentStacked',
	},
];

export const LEGEND_POSITION_OPTIONS: ReadonlyArray<ChartOption<string>> = [
	{ value: 't', label: 'Top', labelKey: 'pptx.chart.legendTop' },
	{ value: 'b', label: 'Bottom', labelKey: 'pptx.chart.legendBottom' },
	{ value: 'l', label: 'Left', labelKey: 'pptx.chart.legendLeft' },
	{ value: 'r', label: 'Right', labelKey: 'pptx.chart.legendRight' },
];

export const TICK_LABEL_POSITION_OPTIONS: ReadonlyArray<ChartOption<ChartTickLabelPosition>> = [
	{ value: 'nextTo', label: 'Next to axis', labelKey: 'pptx.chart.tickNextTo' },
	{ value: 'high', label: 'High', labelKey: 'pptx.chart.tickHigh' },
	{ value: 'low', label: 'Low', labelKey: 'pptx.chart.tickLow' },
	{ value: 'none', label: 'None', labelKey: 'pptx.chart.tickNone' },
];

export const DISPLAY_UNITS_OPTIONS: ReadonlyArray<ChartOption<ChartDisplayUnitsValue>> = [
	{ value: '', label: 'None', labelKey: 'pptx.chart.unitsNone' },
	{ value: 'hundreds', label: 'Hundreds', labelKey: 'pptx.chart.unitsHundreds' },
	{ value: 'thousands', label: 'Thousands', labelKey: 'pptx.chart.unitsThousands' },
	{ value: 'tenThousands', label: 'Ten Thousands', labelKey: 'pptx.chart.unitsTenThousands' },
	{
		value: 'hundredThousands',
		label: 'Hundred Thousands',
		labelKey: 'pptx.chart.unitsHundredThousands',
	},
	{ value: 'millions', label: 'Millions', labelKey: 'pptx.chart.unitsMillions' },
	{ value: 'tenMillions', label: 'Ten Millions', labelKey: 'pptx.chart.unitsTenMillions' },
	{
		value: 'hundredMillions',
		label: 'Hundred Millions',
		labelKey: 'pptx.chart.unitsHundredMillions',
	},
	{ value: 'billions', label: 'Billions', labelKey: 'pptx.chart.unitsBillions' },
	{ value: 'trillions', label: 'Trillions', labelKey: 'pptx.chart.unitsTrillions' },
];

export const DATA_LABEL_CONTENT_OPTIONS: ReadonlyArray<{
	key: ChartDataLabelContentKey;
	label: string;
	labelKey: string;
}> = [
	{ key: 'showValue', label: 'Value', labelKey: 'pptx.chart.labelValue' },
	{ key: 'showCategory', label: 'Category name', labelKey: 'pptx.chart.labelCategory' },
	{ key: 'showSeriesName', label: 'Series name', labelKey: 'pptx.chart.labelSeriesName' },
	{ key: 'showPercent', label: 'Percentage', labelKey: 'pptx.chart.labelPercent' },
	{ key: 'showLegendKey', label: 'Legend key', labelKey: 'pptx.chart.labelLegendKey' },
];

export const DATA_LABEL_POSITION_OPTIONS: ReadonlyArray<ChartOption<ChartDataLabelPositionValue>> =
	[
		{ value: '', label: 'Default', labelKey: 'pptx.chart.labelPosDefault' },
		{ value: 'ctr', label: 'Center', labelKey: 'pptx.chart.labelPosCenter' },
		{ value: 'inEnd', label: 'Inside End', labelKey: 'pptx.chart.labelPosInsideEnd' },
		{ value: 'inBase', label: 'Inside Base', labelKey: 'pptx.chart.labelPosInsideBase' },
		{ value: 'outEnd', label: 'Outside End', labelKey: 'pptx.chart.labelPosOutsideEnd' },
		{ value: 'bestFit', label: 'Best Fit', labelKey: 'pptx.chart.labelPosBestFit' },
		{ value: 't', label: 'Above', labelKey: 'pptx.chart.labelPosAbove' },
		{ value: 'b', label: 'Below', labelKey: 'pptx.chart.labelPosBelow' },
		{ value: 'l', label: 'Left', labelKey: 'pptx.chart.labelPosLeft' },
		{ value: 'r', label: 'Right', labelKey: 'pptx.chart.labelPosRight' },
	];

export const TRENDLINE_TYPE_OPTIONS: ReadonlyArray<ChartOption<ChartTrendlineValue>> = [
	{ value: '', label: 'None', labelKey: 'pptx.chart.trendlineNone' },
	{ value: 'linear', label: 'Linear', labelKey: 'pptx.chart.trendlineLinear' },
	{ value: 'exponential', label: 'Exponential', labelKey: 'pptx.chart.trendlineExponential' },
	{ value: 'logarithmic', label: 'Logarithmic', labelKey: 'pptx.chart.trendlineLogarithmic' },
	{ value: 'polynomial', label: 'Polynomial', labelKey: 'pptx.chart.trendlinePolynomial' },
	{ value: 'power', label: 'Power', labelKey: 'pptx.chart.trendlinePower' },
	{ value: 'movingAvg', label: 'Moving Average', labelKey: 'pptx.chart.trendlineMovingAvg' },
];

export const ERROR_BAR_VALTYPE_OPTIONS: ReadonlyArray<ChartOption<ChartErrorBarValType>> = [
	{ value: '', label: 'None', labelKey: 'pptx.chart.errorBarNone' },
	{ value: 'fixedVal', label: 'Fixed value', labelKey: 'pptx.chart.errorBarFixed' },
	{ value: 'percentage', label: 'Percentage', labelKey: 'pptx.chart.errorBarPercentage' },
	{ value: 'stdDev', label: 'Standard deviation', labelKey: 'pptx.chart.errorBarStdDev' },
	{ value: 'stdErr', label: 'Standard error', labelKey: 'pptx.chart.errorBarStdErr' },
];

export const ERROR_BAR_TYPE_OPTIONS: ReadonlyArray<ChartOption<ChartErrorBarType>> = [
	{ value: 'both', label: 'Both', labelKey: 'pptx.chart.errorBarBoth' },
	{ value: 'plus', label: 'Plus', labelKey: 'pptx.chart.errorBarPlus' },
	{ value: 'minus', label: 'Minus', labelKey: 'pptx.chart.errorBarMinus' },
];

export const MARKER_SYMBOL_OPTIONS: ReadonlyArray<ChartOption<ChartMarkerSymbolValue>> = [
	{ value: '', label: 'Auto', labelKey: 'pptx.chart.markerAuto' },
	{ value: 'none', label: 'None', labelKey: 'pptx.chart.markerNone' },
	{ value: 'circle', label: 'Circle', labelKey: 'pptx.chart.markerCircle' },
	{ value: 'square', label: 'Square', labelKey: 'pptx.chart.markerSquare' },
	{ value: 'diamond', label: 'Diamond', labelKey: 'pptx.chart.markerDiamond' },
	{ value: 'triangle', label: 'Triangle', labelKey: 'pptx.chart.markerTriangle' },
	{ value: 'x', label: 'X', labelKey: 'pptx.chart.markerX' },
	{ value: 'star', label: 'Star', labelKey: 'pptx.chart.markerStar' },
	{ value: 'plus', label: 'Plus', labelKey: 'pptx.chart.markerPlus' },
	{ value: 'dot', label: 'Dot', labelKey: 'pptx.chart.markerDot' },
	{ value: 'dash', label: 'Dash', labelKey: 'pptx.chart.markerDash' },
];

export const GRIDLINE_DASH_OPTIONS: ReadonlyArray<ChartOption<ChartGridlineDashValue>> = [
	{ value: '', label: 'Default', labelKey: 'pptx.chart.dashDefault' },
	{ value: 'solid', label: 'Solid', labelKey: 'pptx.chart.dashSolid' },
	{ value: 'dash', label: 'Dash', labelKey: 'pptx.chart.dashDash' },
	{ value: 'dot', label: 'Dot', labelKey: 'pptx.chart.dashDot' },
	{ value: 'dashDot', label: 'Dash Dot', labelKey: 'pptx.chart.dashDashDot' },
	{ value: 'lgDash', label: 'Long Dash', labelKey: 'pptx.chart.dashLong' },
];

export const COMBO_SERIES_TYPE_OPTIONS: ReadonlyArray<ChartOption<'' | PptxChartType>> = [
	{ value: '', label: 'Default', labelKey: 'pptx.chart.comboDefault' },
	{ value: 'bar', label: 'Bar', labelKey: 'pptx.chart.typeBar' },
	{ value: 'line', label: 'Line', labelKey: 'pptx.chart.typeLine' },
	{ value: 'area', label: 'Area', labelKey: 'pptx.chart.typeArea' },
	{ value: 'scatter', label: 'Scatter', labelKey: 'pptx.chart.typeScatter' },
];

// Axis rows and supported-type Sets live in `chart-editor-support.ts`; re-exported so every
// existing `chart-editor-options` import keeps resolving.
export * from './chart-editor-support';

/**
 * Apply an inspector patch to a chart's data, routing a `chartType` change
 * through core's {@link chartDataChangeType} (which clears grouping the new
 * type doesn't support and adapts the category/series shape) instead of a
 * plain shallow merge. A `chartType` of `'pareto'` (see
 * {@link ChartTypeSelectValue}) is routed through {@link applyParetoConversion}
 * instead, since it has no `chartDataChangeType` target of its own. Every
 * other field is a plain merge.
 *
 * Every binding's chart type/title/grouping selector needs exactly this
 * "is this patch a type change?" branch; it was independently re-implemented
 * in React and Vue with identical logic before being centralized here.
 */
export function patchChartData(
	data: PptxChartData,
	patch: Omit<Partial<PptxChartData>, 'chartType'> & { chartType?: ChartTypeSelectValue },
): PptxChartData {
	const { chartType, ...rest } = patch;
	if (chartType === 'pareto') {
		return { ...applyParetoConversion(data), ...rest };
	}
	if (chartType && chartType !== data.chartType) {
		const adapted = chartDataChangeType(data, chartType);
		return { ...adapted, ...rest };
	}
	return { ...data, ...rest, ...(chartType !== undefined ? { chartType } : {}) };
}
