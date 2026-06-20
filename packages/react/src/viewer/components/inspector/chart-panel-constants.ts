import type { PptxChartType, PptxChartData } from 'pptx-viewer-core';

// ---------------------------------------------------------------------------
// Shared CSS tokens (kept in sync with InspectorPane)
// ---------------------------------------------------------------------------

export const HEADING = 'text-[11px] uppercase tracking-wide text-muted-foreground';
export const CARD = 'rounded border border-border bg-card p-2 space-y-2';
export const INPUT = 'flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full';
export const BTN = 'rounded bg-muted hover:bg-accent px-2 py-1 text-[11px] transition-colors';
export const CELL_INPUT =
	'bg-muted border border-border rounded px-1 py-0.5 text-[11px] w-full text-center';

// ---------------------------------------------------------------------------
// Chart type options
// ---------------------------------------------------------------------------

export const CHART_TYPE_OPTIONS: ReadonlyArray<{
	value: PptxChartType;
	labelKey: string;
}> = [
	{ value: 'bar', labelKey: 'pptx.chart.typeBar' },
	{ value: 'line', labelKey: 'pptx.chart.typeLine' },
	{ value: 'pie', labelKey: 'pptx.chart.typePie' },
	{ value: 'doughnut', labelKey: 'pptx.chart.typeDoughnut' },
	{ value: 'area', labelKey: 'pptx.chart.typeArea' },
	{ value: 'scatter', labelKey: 'pptx.chart.typeScatter' },
	{ value: 'bubble', labelKey: 'pptx.chart.typeBubble' },
	{ value: 'radar', labelKey: 'pptx.chart.typeRadar' },
	{ value: 'stock', labelKey: 'pptx.chart.typeStock' },
	{ value: 'waterfall', labelKey: 'pptx.chart.typeWaterfall' },
	{ value: 'combo', labelKey: 'pptx.chart.typeCombo' },
];

export const GROUPING_OPTIONS: ReadonlyArray<{
	value: PptxChartData['grouping'];
	labelKey: string;
}> = [
	{ value: 'clustered', labelKey: 'pptx.chart.groupingClustered' },
	{ value: 'stacked', labelKey: 'pptx.chart.groupingStacked' },
	{ value: 'percentStacked', labelKey: 'pptx.chart.groupingPercentStacked' },
];

export const LEGEND_POSITION_OPTIONS: ReadonlyArray<{
	value: string;
	labelKey: string;
}> = [
	{ value: 't', labelKey: 'pptx.chart.legendTop' },
	{ value: 'b', labelKey: 'pptx.chart.legendBottom' },
	{ value: 'l', labelKey: 'pptx.chart.legendLeft' },
	{ value: 'r', labelKey: 'pptx.chart.legendRight' },
];

export const TICK_LABEL_POSITION_OPTIONS: ReadonlyArray<{
	value: 'nextTo' | 'high' | 'low' | 'none';
	labelKey: string;
}> = [
	{ value: 'nextTo', labelKey: 'pptx.chart.tickNextTo' },
	{ value: 'high', labelKey: 'pptx.chart.tickHigh' },
	{ value: 'low', labelKey: 'pptx.chart.tickLow' },
	{ value: 'none', labelKey: 'pptx.chart.tickNone' },
];

export const DISPLAY_UNITS_OPTIONS: ReadonlyArray<{
	value:
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
	labelKey: string;
}> = [
	{ value: '', labelKey: 'pptx.chart.unitsNone' },
	{ value: 'hundreds', labelKey: 'pptx.chart.unitsHundreds' },
	{ value: 'thousands', labelKey: 'pptx.chart.unitsThousands' },
	{ value: 'tenThousands', labelKey: 'pptx.chart.unitsTenThousands' },
	{ value: 'hundredThousands', labelKey: 'pptx.chart.unitsHundredThousands' },
	{ value: 'millions', labelKey: 'pptx.chart.unitsMillions' },
	{ value: 'tenMillions', labelKey: 'pptx.chart.unitsTenMillions' },
	{ value: 'hundredMillions', labelKey: 'pptx.chart.unitsHundredMillions' },
	{ value: 'billions', labelKey: 'pptx.chart.unitsBillions' },
	{ value: 'trillions', labelKey: 'pptx.chart.unitsTrillions' },
];

/** Axis kinds the inspector exposes for editing, with a label key each. */
export const EDITABLE_AXIS_TYPES: ReadonlyArray<{
	value: 'valAx' | 'catAx';
	labelKey: string;
}> = [
	{ value: 'valAx', labelKey: 'pptx.chart.valueAxis' },
	{ value: 'catAx', labelKey: 'pptx.chart.categoryAxis' },
];

export const DATA_LABEL_CONTENT_OPTIONS: ReadonlyArray<{
	key: 'showValue' | 'showCategory' | 'showSeriesName' | 'showPercent' | 'showLegendKey';
	labelKey: string;
}> = [
	{ key: 'showValue', labelKey: 'pptx.chart.labelValue' },
	{ key: 'showCategory', labelKey: 'pptx.chart.labelCategory' },
	{ key: 'showSeriesName', labelKey: 'pptx.chart.labelSeriesName' },
	{ key: 'showPercent', labelKey: 'pptx.chart.labelPercent' },
	{ key: 'showLegendKey', labelKey: 'pptx.chart.labelLegendKey' },
];

export const DATA_LABEL_POSITION_OPTIONS: ReadonlyArray<{
	value: '' | 'ctr' | 'inEnd' | 'inBase' | 'outEnd' | 'bestFit';
	labelKey: string;
}> = [
	{ value: '', labelKey: 'pptx.chart.labelPosDefault' },
	{ value: 'ctr', labelKey: 'pptx.chart.labelPosCenter' },
	{ value: 'inEnd', labelKey: 'pptx.chart.labelPosInsideEnd' },
	{ value: 'inBase', labelKey: 'pptx.chart.labelPosInsideBase' },
	{ value: 'outEnd', labelKey: 'pptx.chart.labelPosOutsideEnd' },
	{ value: 'bestFit', labelKey: 'pptx.chart.labelPosBestFit' },
];

export const TRENDLINE_TYPE_OPTIONS: ReadonlyArray<{
	value: '' | 'linear' | 'exponential' | 'logarithmic' | 'polynomial' | 'power' | 'movingAvg';
	labelKey: string;
}> = [
	{ value: '', labelKey: 'pptx.chart.trendlineNone' },
	{ value: 'linear', labelKey: 'pptx.chart.trendlineLinear' },
	{ value: 'exponential', labelKey: 'pptx.chart.trendlineExponential' },
	{ value: 'logarithmic', labelKey: 'pptx.chart.trendlineLogarithmic' },
	{ value: 'polynomial', labelKey: 'pptx.chart.trendlinePolynomial' },
	{ value: 'power', labelKey: 'pptx.chart.trendlinePower' },
	{ value: 'movingAvg', labelKey: 'pptx.chart.trendlineMovingAvg' },
];

/** Chart types where trendlines are meaningful. */
export const TRENDLINE_SUPPORTED_TYPES = new Set<PptxChartType>([
	'bar',
	'line',
	'area',
	'scatter',
	'bubble',
]);

export const ERROR_BAR_VALTYPE_OPTIONS: ReadonlyArray<{
	value: '' | 'fixedVal' | 'percentage' | 'stdDev' | 'stdErr';
	labelKey: string;
}> = [
	{ value: '', labelKey: 'pptx.chart.errorBarNone' },
	{ value: 'fixedVal', labelKey: 'pptx.chart.errorBarFixed' },
	{ value: 'percentage', labelKey: 'pptx.chart.errorBarPercentage' },
	{ value: 'stdDev', labelKey: 'pptx.chart.errorBarStdDev' },
	{ value: 'stdErr', labelKey: 'pptx.chart.errorBarStdErr' },
];

export const ERROR_BAR_TYPE_OPTIONS: ReadonlyArray<{
	value: 'both' | 'plus' | 'minus';
	labelKey: string;
}> = [
	{ value: 'both', labelKey: 'pptx.chart.errorBarBoth' },
	{ value: 'plus', labelKey: 'pptx.chart.errorBarPlus' },
	{ value: 'minus', labelKey: 'pptx.chart.errorBarMinus' },
];

/** Value types that take a numeric amount/multiplier (stdErr does not). */
export const ERROR_BAR_VALUE_TYPES = new Set(['fixedVal', 'percentage', 'stdDev']);

/** Chart types where error bars are meaningful. */
export const ERROR_BAR_SUPPORTED_TYPES = new Set<PptxChartType>([
	'bar',
	'line',
	'area',
	'scatter',
	'bubble',
]);

/** Chart types that support grouping modes. */
export const GROUPING_SUPPORTED_TYPES = new Set<PptxChartType>(['bar', 'line', 'area']);

// ---------------------------------------------------------------------------
// Marker options (line / scatter / bubble / radar)
// ---------------------------------------------------------------------------

export const MARKER_SYMBOL_OPTIONS: ReadonlyArray<{
	value:
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
	labelKey: string;
}> = [
	{ value: '', labelKey: 'pptx.chart.markerAuto' },
	{ value: 'none', labelKey: 'pptx.chart.markerNone' },
	{ value: 'circle', labelKey: 'pptx.chart.markerCircle' },
	{ value: 'square', labelKey: 'pptx.chart.markerSquare' },
	{ value: 'diamond', labelKey: 'pptx.chart.markerDiamond' },
	{ value: 'triangle', labelKey: 'pptx.chart.markerTriangle' },
	{ value: 'x', labelKey: 'pptx.chart.markerX' },
	{ value: 'star', labelKey: 'pptx.chart.markerStar' },
	{ value: 'plus', labelKey: 'pptx.chart.markerPlus' },
	{ value: 'dot', labelKey: 'pptx.chart.markerDot' },
	{ value: 'dash', labelKey: 'pptx.chart.markerDash' },
];

/** Chart types where series markers are meaningful. */
export const MARKER_SUPPORTED_TYPES = new Set<PptxChartType>([
	'line',
	'scatter',
	'bubble',
	'radar',
]);

// ---------------------------------------------------------------------------
// Gridline line styling
// ---------------------------------------------------------------------------

export const GRIDLINE_DASH_OPTIONS: ReadonlyArray<{
	value: '' | 'solid' | 'dash' | 'dot' | 'dashDot' | 'lgDash' | 'sysDash' | 'sysDot';
	labelKey: string;
}> = [
	{ value: '', labelKey: 'pptx.chart.dashDefault' },
	{ value: 'solid', labelKey: 'pptx.chart.dashSolid' },
	{ value: 'dash', labelKey: 'pptx.chart.dashDash' },
	{ value: 'dot', labelKey: 'pptx.chart.dashDot' },
	{ value: 'dashDot', labelKey: 'pptx.chart.dashDashDot' },
	{ value: 'lgDash', labelKey: 'pptx.chart.dashLong' },
];

// ---------------------------------------------------------------------------
// Per-series combo chart types
// ---------------------------------------------------------------------------

/** Chart types selectable per-series within a combo chart. */
export const COMBO_SERIES_TYPE_OPTIONS: ReadonlyArray<{
	value: '' | PptxChartType;
	labelKey: string;
}> = [
	{ value: '', labelKey: 'pptx.chart.comboDefault' },
	{ value: 'bar', labelKey: 'pptx.chart.typeBar' },
	{ value: 'line', labelKey: 'pptx.chart.typeLine' },
	{ value: 'area', labelKey: 'pptx.chart.typeArea' },
	{ value: 'scatter', labelKey: 'pptx.chart.typeScatter' },
];

/** Cartesian chart types where a per-series combo type makes sense. */
export const COMBO_SUPPORTED_TYPES = new Set<PptxChartType>(['bar', 'line', 'area', 'combo']);

// ---------------------------------------------------------------------------
// Per-data-point formatting
// ---------------------------------------------------------------------------

/** Chart types where per-point slice explosion (pull-out) is meaningful. */
export const EXPLOSION_SUPPORTED_TYPES = new Set<PptxChartType>([
	'pie',
	'pie3D',
	'doughnut',
	'ofPie',
]);
