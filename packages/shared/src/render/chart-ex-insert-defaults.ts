/**
 * chart-ex-insert-defaults.ts: sensible default `categories` / `series` /
 * `categoryLevels` shapes for the six Office 2016+ ChartEx types that were
 * creatable at the core level (`createChartElement`, `ChartBuilder`, the MCP
 * `createChart` / `updateChart` tools) but never reachable from any binding's
 * Insert Chart or Change Chart Type UI: histogram, funnel, treemap, sunburst,
 * boxWhisker, regionMap.
 *
 * `insert-chart.ts`'s one-size-fits-all default (three generic categories,
 * one ascending series) does not look like any of these six once rendered:
 * a histogram needs raw observations rather than pre-binned categories, a
 * treemap/sunburst needs a two-level hierarchy, a box-and-whisker needs
 * several observations per category (each series contributes one sample per
 * category, per `computeBoxWhiskerGeometry` in `chart-box-whisker.ts`), and a
 * region map needs category labels that actually resolve to a region code
 * (see `REGION_ALIAS_MAP` in `chart-waterfall-map.ts`) or it renders as an
 * empty map with every row in the "unmatched" fallback table.
 *
 * Kept separate from `insert-chart.ts` so that file stays a thin dispatcher;
 * this module owns only the per-type sample data.
 *
 * @module render/chart-ex-insert-defaults
 */
import type { ChartSeriesInput, PptxChartType } from 'pptx-viewer-core';

/** The insert-time default data shape for one chart type. */
export interface ChartExInsertData {
	categories: string[];
	series: ChartSeriesInput[];
	/** ChartEx hierarchy levels in leaf-to-root order (treemap / sunburst only). */
	categoryLevels?: string[][];
}

/** Raw observations (not pre-binned) for the histogram default. */
const HISTOGRAM_VALUES: readonly number[] = [
	3, 5, 7, 8, 9, 10, 10, 11, 12, 12, 13, 14, 15, 15, 16, 17, 18, 20, 22, 25,
];

/** Two-level leaf-first hierarchy shared by the treemap and sunburst defaults. */
const HIERARCHY_LEAVES: readonly string[] = [
	'Product A',
	'Product B',
	'Product C',
	'Product D',
	'Product E',
	'Product F',
];
const HIERARCHY_PARENTS: readonly string[] = [
	'Group 1',
	'Group 1',
	'Group 1',
	'Group 2',
	'Group 2',
	'Group 2',
];
const HIERARCHY_VALUES: readonly number[] = [45, 30, 15, 25, 20, 10];

/** Categories a real box-and-whisker compares side by side. */
const BOX_WHISKER_CATEGORIES: readonly string[] = ['Group A', 'Group B', 'Group C'];

/**
 * One row per sample run: `computeBoxWhiskerGeometry` reads observation N of
 * a category as `series[N].values[categoryIndex]`, so each series here is one
 * repeated-measure sample across every category, not a named data series.
 */
const BOX_WHISKER_SAMPLES: readonly (readonly number[])[] = [
	[42, 65, 22],
	[48, 70, 28],
	[51, 74, 31],
	[53, 77, 33],
	[55, 80, 35],
	[58, 83, 38],
	[61, 87, 41],
	[70, 95, 50],
];

/** Category labels that resolve through `REGION_ALIAS_MAP` to a real region. */
const REGION_MAP_CATEGORIES: readonly string[] = [
	'United States',
	'Germany',
	'France',
	'Japan',
	'Brazil',
];
const REGION_MAP_VALUES: readonly number[] = [80, 55, 42, 63, 37];

function buildBoxWhiskerSeries(): ChartSeriesInput[] {
	return BOX_WHISKER_SAMPLES.map((values, index) => ({
		name: `Sample ${index + 1}`,
		values: [...values],
		...(index === 0
			? { boxWhiskerOptions: { quartileMethod: 'exclusive' as const, showOutlierPoints: true } }
			: {}),
	}));
}

/**
 * Build the default `categories` / `series` (and, for hierarchical types,
 * `categoryLevels`) for a ChartEx type that needs a shape other than the
 * generic ascending three-category series. Returns `undefined` for every
 * other {@link PptxChartType}, so callers fall back to the generic default.
 */
export function buildChartExInsertData(chartType: PptxChartType): ChartExInsertData | undefined {
	switch (chartType) {
		case 'histogram':
			return {
				categories: [],
				series: [
					{
						name: 'Values',
						values: [...HISTOGRAM_VALUES],
						histogramOptions: { layout: 'histogram', binCount: 6 },
					},
				],
			};
		case 'funnel':
			return {
				categories: ['Visitors', 'Leads', 'Qualified', 'Proposals', 'Customers'],
				series: [{ name: 'Funnel', values: [1000, 650, 400, 220, 120] }],
			};
		case 'treemap':
			return {
				categories: [...HIERARCHY_LEAVES],
				categoryLevels: [[...HIERARCHY_LEAVES], [...HIERARCHY_PARENTS]],
				series: [{ name: 'Sales', values: [...HIERARCHY_VALUES] }],
			};
		case 'sunburst':
			return {
				categories: [...HIERARCHY_LEAVES],
				categoryLevels: [[...HIERARCHY_LEAVES], [...HIERARCHY_PARENTS]],
				series: [{ name: 'Sunburst', values: [...HIERARCHY_VALUES] }],
			};
		case 'boxWhisker':
			return {
				categories: [...BOX_WHISKER_CATEGORIES],
				series: buildBoxWhiskerSeries(),
			};
		case 'regionMap':
			return {
				categories: [...REGION_MAP_CATEGORIES],
				series: [
					{
						name: 'Value',
						values: [...REGION_MAP_VALUES],
						regionMapOptions: { viewedRegionType: 'world' },
					},
				],
			};
		default:
			return undefined;
	}
}
