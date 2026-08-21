/**
 * Pure mapping between OOXML chart-type container local names
 * (`barChart`, `lineChart`, etc.) and the modeled {@link PptxChartType}.
 *
 * Used by the load-side combo parser to tag each series with the chart type
 * of the `c:*Chart` container it came from, and shared with the detection /
 * serialization paths so the mapping stays in one place.
 *
 * @module utils/chart-container-type-map
 */

import type { PptxChartType } from '../types';

/** Map an OOXML chart-type container local name to its modeled chart type. */
const CONTAINER_LOCAL_NAME_TO_TYPE: Record<string, PptxChartType> = {
	barChart: 'bar',
	bar3DChart: 'bar3D',
	lineChart: 'line',
	line3DChart: 'line3D',
	pieChart: 'pie',
	pie3DChart: 'pie3D',
	ofPieChart: 'ofPie',
	doughnutChart: 'doughnut',
	areaChart: 'area',
	area3DChart: 'area3D',
	scatterChart: 'scatter',
	bubbleChart: 'bubble',
	radarChart: 'radar',
	stockChart: 'stock',
	surfaceChart: 'surface',
	surface3DChart: 'surface',
};

/**
 * Resolve an OOXML chart-type container local name (e.g. `"lineChart"`) to its
 * modeled {@link PptxChartType}. Returns `undefined` for names that are not a
 * recognised chart-type container.
 */
export function chartContainerLocalNameToType(localName: string): PptxChartType | undefined {
	return CONTAINER_LOCAL_NAME_TO_TYPE[localName];
}

/** Whether a local name is a recognised `c:*Chart` container. */
export function isChartTypeContainerLocalName(localName: string): boolean {
	return localName in CONTAINER_LOCAL_NAME_TO_TYPE;
}

/**
 * Chart families that are drawn as a line/marker with no fillable area, so
 * OOXML authors their series colour on the outline (`a:spPr/a:ln/a:solidFill`)
 * instead of a direct fill (`a:spPr/a:solidFill`). Area-family charts
 * (bar/area/pie/doughnut/bubble/surface/...) use the direct fill.
 */
const LINE_DRAWN_CHART_TYPES = new Set<PptxChartType>([
	'line',
	'line3D',
	'scatter',
	'radar',
	'stock',
]);

/**
 * Whether a chart type reads/writes its series colour from `a:ln/a:solidFill`
 * rather than a direct `a:solidFill`. Keeps the parse path
 * (`PptxHandlerRuntimeChartParsing.buildChartSeries`) and the save paths
 * (`PptxHandlerRuntimeSaveDataSerialization`) agreeing on the same
 * classification, and mirrors `chart-xml-generator.ts`'s `fillSpPr`.
 */
export function isLineDrawnChartType(type: PptxChartType | undefined): boolean {
	return type !== undefined && LINE_DRAWN_CHART_TYPES.has(type);
}
