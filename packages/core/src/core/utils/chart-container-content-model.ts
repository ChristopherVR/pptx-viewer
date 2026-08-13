/**
 * ECMA-376 content models for the `c:*Chart` plot-type containers.
 *
 * Every chart-group container under `c:plotArea` (`CT_BarChart`,
 * `CT_LineChart`, `CT_PieChart`, ...) is a *sequence*: it permits a fixed set of
 * children in a fixed order. Emitting a legal element in the wrong container, or
 * a legal element in the wrong position, is equally invalid, and PowerPoint
 * rejects the whole package ("the file is corrupted and unreadable") rather than
 * degrading.
 *
 * This module is the single source of truth for those content models, so the
 * combo re-split ({@link module:utils/chart-combo-serializer}) and the
 * chart-type-change save path agree on what a container may hold.
 *
 * @module utils/chart-container-content-model
 */

import type { PptxChartType } from '../types';

/**
 * Ordered child local names for each chart-group container, straight from the
 * ECMA-376 Part 1 21.2.2 sequences. Order is significant: it is the emit order.
 */
export const CHART_CONTAINER_CHILD_ORDER: Readonly<Record<string, readonly string[]>> = {
	areaChart: ['grouping', 'varyColors', 'ser', 'dLbls', 'dropLines', 'axId', 'extLst'],
	area3DChart: [
		'grouping',
		'varyColors',
		'ser',
		'dLbls',
		'dropLines',
		'gapDepth',
		'axId',
		'extLst',
	],
	barChart: [
		'barDir',
		'grouping',
		'varyColors',
		'ser',
		'dLbls',
		'gapWidth',
		'overlap',
		'serLines',
		'axId',
		'extLst',
	],
	bar3DChart: [
		'barDir',
		'grouping',
		'varyColors',
		'ser',
		'dLbls',
		'gapWidth',
		'gapDepth',
		'shape',
		'axId',
		'extLst',
	],
	bubbleChart: [
		'varyColors',
		'ser',
		'dLbls',
		'bubble3D',
		'bubbleScale',
		'showNegBubbles',
		'sizeRepresents',
		'axId',
		'extLst',
	],
	doughnutChart: ['varyColors', 'ser', 'dLbls', 'firstSliceAng', 'holeSize', 'extLst'],
	lineChart: [
		'grouping',
		'varyColors',
		'ser',
		'dLbls',
		'dropLines',
		'hiLowLines',
		'upDownBars',
		'marker',
		'smooth',
		'axId',
		'extLst',
	],
	line3DChart: [
		'grouping',
		'varyColors',
		'ser',
		'dLbls',
		'dropLines',
		'gapDepth',
		'axId',
		'extLst',
	],
	ofPieChart: [
		'ofPieType',
		'varyColors',
		'ser',
		'dLbls',
		'gapWidth',
		'splitType',
		'splitPos',
		'custSplit',
		'secondPieSize',
		'serLines',
		'extLst',
	],
	pieChart: ['varyColors', 'ser', 'dLbls', 'firstSliceAng', 'extLst'],
	pie3DChart: ['varyColors', 'ser', 'dLbls', 'extLst'],
	radarChart: ['radarStyle', 'varyColors', 'ser', 'dLbls', 'axId', 'extLst'],
	scatterChart: ['scatterStyle', 'varyColors', 'ser', 'dLbls', 'axId', 'extLst'],
	stockChart: ['ser', 'dLbls', 'dropLines', 'hiLowLines', 'upDownBars', 'axId', 'extLst'],
	surfaceChart: ['wireframe', 'ser', 'bandFmts', 'axId', 'extLst'],
	surface3DChart: ['wireframe', 'ser', 'bandFmts', 'axId', 'extLst'],
};

/**
 * Children a container cannot omit. `CT_BarChart` without `c:barDir`, or
 * `CT_ScatterChart` without `c:scatterStyle`, fails validation outright.
 */
export const REQUIRED_LEADING_CHILD: Readonly<Record<string, { local: string; val: string }>> = {
	barChart: { local: 'barDir', val: 'col' },
	bar3DChart: { local: 'barDir', val: 'col' },
	lineChart: { local: 'grouping', val: 'standard' },
	line3DChart: { local: 'grouping', val: 'standard' },
	ofPieChart: { local: 'ofPieType', val: 'pie' },
	radarChart: { local: 'radarStyle', val: 'marker' },
	scatterChart: { local: 'scatterStyle', val: 'lineMarker' },
};

/** Complete `PptxChartType` -> classic `c:*Chart` local name map. */
const TYPE_TO_CONTAINER: Readonly<Partial<Record<PptxChartType, string>>> = {
	area: 'areaChart',
	area3D: 'area3DChart',
	bar: 'barChart',
	bar3D: 'bar3DChart',
	bubble: 'bubbleChart',
	doughnut: 'doughnutChart',
	line: 'lineChart',
	line3D: 'line3DChart',
	ofPie: 'ofPieChart',
	pie: 'pieChart',
	pie3D: 'pie3DChart',
	radar: 'radarChart',
	scatter: 'scatterChart',
	stock: 'stockChart',
	surface: 'surfaceChart',
};

/** Axis element local names that live directly under `c:plotArea`. */
export const AXIS_LOCAL_NAMES = ['catAx', 'valAx', 'dateAx', 'serAx'] as const;

/**
 * Map a model chart type to its OOXML chart-group container local name, or
 * `undefined` when the type has no classic `c:*Chart` representation (the
 * `cx:` chartex family, `combo`, `unknown`).
 */
export function chartTypeToContainerLocalName(chartType: PptxChartType): string | undefined {
	return TYPE_TO_CONTAINER[chartType];
}

/** Whether `containerLocal` is a chart-group container this module models. */
export function isKnownChartContainer(containerLocal: string): boolean {
	return containerLocal in CHART_CONTAINER_CHILD_ORDER;
}

/** Whether `containerLocal` permits `childLocal` as a direct child. */
export function chartContainerAllows(containerLocal: string, childLocal: string): boolean {
	const order = CHART_CONTAINER_CHILD_ORDER[containerLocal];
	return order !== undefined && order.includes(childLocal);
}

/** Whether `containerLocal` carries `c:axId` references (pie-family charts do not). */
export function chartContainerHasAxes(containerLocal: string): boolean {
	return chartContainerAllows(containerLocal, 'axId');
}
