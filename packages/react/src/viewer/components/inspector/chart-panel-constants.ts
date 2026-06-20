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

/** Chart types that support grouping modes. */
export const GROUPING_SUPPORTED_TYPES = new Set<PptxChartType>(['bar', 'line', 'area']);
