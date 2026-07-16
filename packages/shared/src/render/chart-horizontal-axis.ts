import type { PptxChartAxisFormatting, PptxChartData } from 'pptx-viewer-core';

import { horizontalAxisY } from './chart-axis-crossing';
import { buildCategoryAxisPlan, categoryX, chartDataInCategoryOrder } from './chart-category-axis';
import { buildDateAxisPlan } from './chart-date-axis';
import type {
	PlotLayout,
	SupportedChartKind,
	SvgLine,
	SvgText,
	ValueRange,
} from './chart-view-model';
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
	primaryRange: ValueRange,
	secondaryRange?: ValueRange,
): CartesianHorizontalAxisPlan {
	let catAxisStyle: 'bar' | 'line' =
		kind === 'line' || kind === 'area' || kind === 'scatter' || kind === 'bubble' ? 'line' : 'bar';
	const horizontalAxes = chartData.axes?.filter(
		(axis) => axis.axisType === 'catAx' || axis.axisType === 'dateAx',
	);
	const primaryAxis = horizontalAxes?.find((axis) => axis.axPos !== 't') ?? horizontalAxes?.[0];
	const secondaryAxis = horizontalAxes?.find((axis) => axis.axPos === 't' && axis !== primaryAxis);
	const linkedValueAxis = (axis: PptxChartAxisFormatting | undefined) =>
		chartData.axes?.find(
			(candidate) => candidate.axisType === 'valAx' && candidate.axisId === axis?.crossAxisId,
		);
	const primaryValueAxis = linkedValueAxis(primaryAxis);
	if (primaryValueAxis?.crossBetween === 'between') {
		catAxisStyle = 'bar';
	} else if (primaryValueAxis?.crossBetween === 'midCat') {
		catAxisStyle = 'line';
	}
	const rangeAndY = (axis: PptxChartAxisFormatting | undefined) => {
		const valueAxis = linkedValueAxis(axis);
		const range = valueAxis?.axPos === 'r' && secondaryRange ? secondaryRange : primaryRange;
		return horizontalAxisY(valueAxis, range, layout, axis?.axPos === 't' ? 'top' : 'bottom');
	};
	const supportsDateScale =
		kind === 'line' || kind === 'area' || kind === 'combo' || kind === 'stock';
	const datePlan =
		supportsDateScale && primaryAxis?.axisType === 'dateAx'
			? buildDateAxisPlan(chartData, layout, primaryAxis, rangeAndY(primaryAxis))
			: undefined;
	const categoryPlan =
		kind === 'scatter' || kind === 'bubble' || datePlan
			? undefined
			: buildCategoryAxisPlan(
					categoryLabels,
					layout,
					catAxisStyle,
					chartData.axes,
					primaryAxis,
					rangeAndY(primaryAxis),
					chartData.categoryLevels,
				);
	const secondaryPlan = secondaryAxis
		? secondaryAxis.axisType === 'dateAx'
			? buildDateAxisPlan(chartData, layout, secondaryAxis, rangeAndY(secondaryAxis))
			: buildCategoryAxisPlan(
					categoryLabels,
					layout,
					linkedValueAxis(secondaryAxis)?.crossBetween === 'between' ? 'bar' : 'line',
					chartData.axes,
					secondaryAxis,
					rangeAndY(secondaryAxis),
					chartData.categoryLevels,
				)
		: undefined;
	const sourceIndices =
		datePlan?.sourceIndices ??
		categoryPlan?.sourceIndices ??
		categoryLabels.map((_label, index) => index);
	return {
		catAxisStyle,
		sourceIndices,
		xPositions:
			datePlan?.xPositions ??
			categoryPlan?.sourceIndices.map((_sourceIndex, displayIndex) =>
				categoryX(displayIndex, categoryPlan.sourceIndices.length, layout, catAxisStyle),
			),
		labels: [
			...(datePlan?.labels ??
				categoryPlan?.labels ??
				buildCategoryLabels(categoryLabels, layout, catAxisStyle)),
			...(secondaryPlan?.labels ?? []),
		],
		tickMarks: [
			...(datePlan?.tickMarks ?? categoryPlan?.tickMarks ?? []),
			...(secondaryPlan?.tickMarks ?? []),
		],
		displayChartData:
			datePlan || categoryPlan ? chartDataInCategoryOrder(chartData, sourceIndices) : chartData,
	};
}
