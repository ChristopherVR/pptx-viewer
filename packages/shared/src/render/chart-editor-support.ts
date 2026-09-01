/**
 * chart-editor-support.ts: the axis rows the advanced chart inspector exposes
 * and which chart types each of its conditional sections applies to. Split out of `chart-editor-options.ts`
 * (which re-exports everything here) to keep that catalogue under the file
 * size limit; consumers keep importing from the options module or the barrel.
 */
import type { PptxChartType } from 'pptx-viewer-core';

/** Axis kinds the inspector exposes, with whether they carry a numeric scale. */
export const EDITABLE_AXIS_ROWS: ReadonlyArray<{
	type: 'valAx' | 'dateAx' | 'catAx';
	label: string;
	labelKey: string;
	hasScale: boolean;
}> = [
	{ type: 'valAx', label: 'Value axis', labelKey: 'pptx.chart.valueAxis', hasScale: true },
	{ type: 'dateAx', label: 'Date axis', labelKey: 'pptx.chart.dateAxis', hasScale: true },
	{ type: 'catAx', label: 'Category axis', labelKey: 'pptx.chart.categoryAxis', hasScale: false },
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
