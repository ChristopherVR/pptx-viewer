/**
 * insert-chart.ts - framework-agnostic factory for a sensible DEFAULT new
 * chart element, the single source of truth every binding (React, Vue,
 * Angular, Vanilla, Svelte) calls from its "Insert > Chart" toolbar action.
 *
 * It wraps core's `createChartElement` so an inserted chart is a fully valid
 * `ChartPptxElement` carrying only `chartData` (no rawXml, no embedded Excel
 * workbook). The save pipeline serialises this self-contained chart on its own,
 * and the viewer / chart inspector already render a chartData-only element.
 *
 * @module insert-chart
 */
import { createChartElement } from 'pptx-viewer-core';
import type { ChartPptxElement, PptxChartBarDirection, PptxChartType } from 'pptx-viewer-core';

import { buildChartExInsertData } from './chart-ex-insert-defaults';

/**
 * Dropdown ids for the insert-chart menu. Distinct from `PptxChartType`
 * because PowerPoint offers Column (vertical) and Bar (horizontal) as two
 * entries over the same underlying `'bar'` chart type. The six ChartEx ids
 * (`histogram` through `regionMap`) map one-to-one onto their chart type.
 */
export type InsertChartKind =
	| 'column'
	| 'bar'
	| 'line'
	| 'pie'
	| 'doughnut'
	| 'area'
	| 'scatter'
	| 'histogram'
	| 'funnel'
	| 'treemap'
	| 'sunburst'
	| 'boxWhisker'
	| 'regionMap';

/** Chart types surfaced in the insert toolbar dropdown, with translatable labels. */
export interface InsertChartTypeOption {
	/** Stable dropdown value; also what `createDefaultChartElement` accepts. */
	id: InsertChartKind;
	/** The underlying chart family written into `chartData.chartType`. */
	type: PptxChartType;
	/** Bar direction for the two bar-family entries (`c:barDir`). */
	barDirection?: PptxChartBarDirection;
	/** i18n key for the dropdown label. */
	labelKey: string;
	/** English fallback label (bindings should prefer {@link labelKey}). */
	label: string;
}

/**
 * The chart types offered when inserting a new chart: the common cartesian /
 * pie families plus the six Office 2016+ ChartEx kinds that core has always
 * been able to create (histogram, funnel, treemap, sunburst, boxWhisker,
 * regionMap) but that no binding previously exposed here. Every binding
 * renders the same dropdown from this list so the UX matches across
 * frameworks. Column and Bar mirror PowerPoint's split: both are the `'bar'`
 * family, distinguished by `c:barDir` (vertical columns vs horizontal bars).
 */
export const INSERT_CHART_TYPES: readonly InsertChartTypeOption[] = [
	{
		id: 'column',
		type: 'bar',
		barDirection: 'col',
		labelKey: 'pptx.chart.typeColumn',
		label: 'Column',
	},
	{ id: 'bar', type: 'bar', barDirection: 'bar', labelKey: 'pptx.chart.typeBar', label: 'Bar' },
	{ id: 'line', type: 'line', labelKey: 'pptx.chart.typeLine', label: 'Line' },
	{ id: 'pie', type: 'pie', labelKey: 'pptx.chart.typePie', label: 'Pie' },
	{ id: 'doughnut', type: 'doughnut', labelKey: 'pptx.chart.typeDoughnut', label: 'Doughnut' },
	{ id: 'area', type: 'area', labelKey: 'pptx.chart.typeArea', label: 'Area' },
	{ id: 'scatter', type: 'scatter', labelKey: 'pptx.chart.typeScatter', label: 'Scatter' },
	{
		id: 'histogram',
		type: 'histogram',
		labelKey: 'pptx.chart.typeHistogram',
		label: 'Histogram',
	},
	{ id: 'funnel', type: 'funnel', labelKey: 'pptx.chart.typeFunnel', label: 'Funnel' },
	{ id: 'treemap', type: 'treemap', labelKey: 'pptx.chart.typeTreemap', label: 'Treemap' },
	{ id: 'sunburst', type: 'sunburst', labelKey: 'pptx.chart.typeSunburst', label: 'Sunburst' },
	{
		id: 'boxWhisker',
		type: 'boxWhisker',
		labelKey: 'pptx.chart.typeBoxWhisker',
		label: 'Box and Whisker',
	},
	{
		id: 'regionMap',
		type: 'regionMap',
		labelKey: 'pptx.chart.typeRegionMap',
		label: 'Filled Map',
	},
];

/** Default insert-chart dropdown entry used when none is supplied. */
export const DEFAULT_INSERT_CHART_KIND: InsertChartKind = 'column';

/**
 * Default chart type used when none is supplied.
 *
 * @deprecated Use {@link DEFAULT_INSERT_CHART_KIND}; kept for callers that
 * still pass a raw `PptxChartType`.
 */
export const DEFAULT_INSERT_CHART_TYPE: PptxChartType = 'bar';

/** Default placement / size (in px, the viewer's coordinate space). */
const DEFAULT_CHART_POSITION = { x: 120, y: 120, width: 480, height: 320 } as const;

/** Default sample categories for a freshly inserted chart. */
const DEFAULT_CATEGORIES = ['Category 1', 'Category 2', 'Category 3'] as const;

/** Default single series with sample values for a freshly inserted chart. */
const DEFAULT_SERIES_VALUES = [4, 3, 5] as const;

/** Optional position overrides when inserting a chart. */
export interface InsertChartPosition {
	x?: number;
	y?: number;
	width?: number;
	height?: number;
}

/**
 * Build a sensible default chart element for the given insert-dropdown entry.
 *
 * Produces three sample categories, one "Series 1" with sample values, the
 * legend enabled, and a default position/size. The result is a self-contained
 * {@link ChartPptxElement} (chartData only) ready to push onto a slide.
 *
 * @param chartKind - The dropdown entry (or a raw chart family) to create.
 *   `'column'` yields vertical columns, `'bar'` horizontal bars.
 * @param position - Optional position/size overrides.
 * @returns A valid {@link ChartPptxElement} with a fresh id.
 */
export function createDefaultChartElement(
	chartKind: InsertChartKind | PptxChartType = DEFAULT_INSERT_CHART_KIND,
	position?: InsertChartPosition,
): ChartPptxElement {
	const option = INSERT_CHART_TYPES.find((entry) => entry.id === chartKind);
	const chartType: PptxChartType = option?.type ?? (chartKind as PptxChartType);
	// ChartEx types (histogram, funnel, treemap, sunburst, boxWhisker, regionMap)
	// look wrong with the generic ascending-series default: see
	// chart-ex-insert-defaults.ts for why each needs its own data shape.
	const chartExData = buildChartExInsertData(chartType);
	return createChartElement(
		chartType,
		{
			categories: chartExData?.categories ?? [...DEFAULT_CATEGORIES],
			series: chartExData?.series ?? [{ name: 'Series 1', values: [...DEFAULT_SERIES_VALUES] }],
			...(chartExData?.categoryLevels ? { categoryLevels: chartExData.categoryLevels } : {}),
			title: 'Chart Title',
			hasLegend: true,
			...(option?.barDirection !== undefined ? { barDirection: option.barDirection } : {}),
		},
		{
			x: position?.x ?? DEFAULT_CHART_POSITION.x,
			y: position?.y ?? DEFAULT_CHART_POSITION.y,
			width: position?.width ?? DEFAULT_CHART_POSITION.width,
			height: position?.height ?? DEFAULT_CHART_POSITION.height,
		},
	);
}
