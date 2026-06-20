/**
 * insert-chart.ts - framework-agnostic factory for a sensible DEFAULT new
 * chart element, the single source of truth every binding (React, Vue,
 * Angular) calls from its "Insert > Chart" toolbar action.
 *
 * It wraps core's `createChartElement` so an inserted chart is a fully valid
 * `ChartPptxElement` carrying only `chartData` (no rawXml, no embedded Excel
 * workbook). The save pipeline serialises this self-contained chart on its own,
 * and the viewer / chart inspector already render a chartData-only element.
 *
 * @module insert-chart
 */
import { createChartElement } from 'pptx-viewer-core';
import type { ChartPptxElement, PptxChartType } from 'pptx-viewer-core';

/** Chart types surfaced in the insert toolbar dropdown, with friendly labels. */
export interface InsertChartTypeOption {
	type: PptxChartType;
	label: string;
}

/**
 * The chart types offered when inserting a new chart. Kept intentionally small
 * (the most common, well-rendered families); every binding renders the same
 * dropdown from this list so the UX matches across frameworks.
 */
export const INSERT_CHART_TYPES: readonly InsertChartTypeOption[] = [
	{ type: 'bar', label: 'Bar' },
	{ type: 'line', label: 'Line' },
	{ type: 'pie', label: 'Pie' },
	{ type: 'doughnut', label: 'Doughnut' },
	{ type: 'area', label: 'Area' },
	{ type: 'scatter', label: 'Scatter' },
];

/** Default chart type used when none is supplied. */
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
 * Build a sensible default chart element for the given chart type.
 *
 * Produces three sample categories, one "Series 1" with sample values, the
 * legend enabled, and a default position/size. The result is a self-contained
 * {@link ChartPptxElement} (chartData only) ready to push onto a slide.
 *
 * @param chartType - The chart family to create (defaults to bar).
 * @param position - Optional position/size overrides.
 * @returns A valid {@link ChartPptxElement} with a fresh id.
 */
export function createDefaultChartElement(
	chartType: PptxChartType = DEFAULT_INSERT_CHART_TYPE,
	position?: InsertChartPosition,
): ChartPptxElement {
	return createChartElement(
		chartType,
		{
			categories: [...DEFAULT_CATEGORIES],
			series: [{ name: 'Series 1', values: [...DEFAULT_SERIES_VALUES] }],
			title: 'Chart Title',
			hasLegend: true,
		},
		{
			x: position?.x ?? DEFAULT_CHART_POSITION.x,
			y: position?.y ?? DEFAULT_CHART_POSITION.y,
			width: position?.width ?? DEFAULT_CHART_POSITION.width,
			height: position?.height ?? DEFAULT_CHART_POSITION.height,
		},
	);
}
