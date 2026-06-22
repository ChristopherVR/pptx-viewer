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
