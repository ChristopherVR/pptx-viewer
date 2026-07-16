import type { PptxChartData } from 'pptx-viewer-core';

import { buildCategoryAxisPlan, chartDataInCategoryOrder } from './chart-category-axis';
import { buildDateAxisPlan } from './chart-date-axis';
import type { PlotLayout, SupportedChartKind, SvgLine, SvgText } from './chart-view-model';
import { buildCategoryLabels } from './chart-view-model';

export interface CartesianHorizontalAxisPlan {
	catAxisStyle: 'bar' | 'line';
	sourceIndices: number[];
	xPositions?: number[];
	labels: SvgText[];
	tickMarks: SvgLine[];
	displayChartData: PptxChartData;
}

export function buildCartesianHorizontalAxis(
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
	layout: PlotLayout,
	kind: SupportedChartKind,
): CartesianHorizontalAxisPlan {
	const catAxisStyle =
		kind === 'line' || kind === 'area' || kind === 'scatter' || kind === 'bubble' ? 'line' : 'bar';
	const datePlan =
		kind === 'line' || kind === 'area' ? buildDateAxisPlan(chartData, layout) : undefined;
	const categoryPlan =
		kind === 'scatter' || kind === 'bubble' || datePlan
			? undefined
			: buildCategoryAxisPlan(categoryLabels, layout, catAxisStyle, chartData.axes);
	const sourceIndices =
		datePlan?.sourceIndices ??
		categoryPlan?.sourceIndices ??
		categoryLabels.map((_label, index) => index);
	return {
		catAxisStyle,
		sourceIndices,
		xPositions: datePlan?.xPositions,
		labels:
			datePlan?.labels ??
			categoryPlan?.labels ??
			buildCategoryLabels(categoryLabels, layout, catAxisStyle),
		tickMarks: datePlan?.tickMarks ?? categoryPlan?.tickMarks ?? [],
		displayChartData:
			datePlan || categoryPlan ? chartDataInCategoryOrder(chartData, sourceIndices) : chartData,
	};
}
