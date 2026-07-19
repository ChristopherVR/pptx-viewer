/**
 * Map a modeled {@link PptxChartType} to the OOXML chart-type container tag and
 * structural family used when generating self-contained ChartML for SDK-created
 * charts. Kept separate from `chart-xml-generator.ts` so the generator stays
 * within the repo's file-size limit.
 *
 * @module utils/chart-xml-container-map
 */

import type { PptxChartType } from '../types';

/**
 * Structural family driving how a chart-type container is populated. Several
 * OOXML containers share one family (e.g. `c:barChart` and `c:bar3DChart` are
 * both `bar`; `c:pieChart`, `c:pie3DChart` are both `pie`).
 */
export type ChartFamily =
	| 'pie'
	| 'ofPie'
	| 'doughnut'
	| 'scatter'
	| 'bubble'
	| 'line'
	| 'area'
	| 'radar'
	| 'bar'
	| 'stock'
	| 'surface';

/** Resolved container tag + structural family for a chart type. */
export interface ChartContainerType {
	tag: string;
	family: ChartFamily;
}

/**
 * Model chart type -> OOXML container tag + structural family. 3-D variants keep
 * their own `c:*3DChart` container (they only collapsed to the 2-D tag before);
 * stock / surface / ofPie map to their dedicated containers. `radar3D` has no
 * OOXML container and is not a modeled `PptxChartType`, so it is not listed.
 * Anything absent (hierarchical ChartEx kinds, `unknown`) falls back to a bar.
 */
const CONTAINER_MAP: Partial<Record<PptxChartType, ChartContainerType>> = {
	pie: { tag: 'c:pieChart', family: 'pie' },
	pie3D: { tag: 'c:pie3DChart', family: 'pie' },
	ofPie: { tag: 'c:ofPieChart', family: 'ofPie' },
	doughnut: { tag: 'c:doughnutChart', family: 'doughnut' },
	scatter: { tag: 'c:scatterChart', family: 'scatter' },
	bubble: { tag: 'c:bubbleChart', family: 'bubble' },
	line: { tag: 'c:lineChart', family: 'line' },
	line3D: { tag: 'c:line3DChart', family: 'line' },
	area: { tag: 'c:areaChart', family: 'area' },
	area3D: { tag: 'c:area3DChart', family: 'area' },
	radar: { tag: 'c:radarChart', family: 'radar' },
	stock: { tag: 'c:stockChart', family: 'stock' },
	surface: { tag: 'c:surfaceChart', family: 'surface' },
	bar: { tag: 'c:barChart', family: 'bar' },
	bar3D: { tag: 'c:bar3DChart', family: 'bar' },
};

/** Map the model chart type to its OOXML container tag and structural family. */
export function resolveChartContainerType(type: PptxChartType): ChartContainerType {
	return CONTAINER_MAP[type] ?? { tag: 'c:barChart', family: 'bar' };
}
