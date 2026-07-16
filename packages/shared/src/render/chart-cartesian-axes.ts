import type { PptxChartData } from 'pptx-viewer-core';

import { getSecondaryValueAxis } from './chart-axis';
import { verticalAxisX } from './chart-axis-crossing';
import { buildPrimaryAxis, buildSecondaryAxis } from './chart-axis-render';
import type { PlotLayout, SvgLine, SvgText, ValueRange } from './chart-view-model';
import { buildGridlinesAndLabels } from './chart-view-model';

export interface CartesianAxesResult {
	gridlines: SvgLine[];
	axisLabels: SvgText[];
	secondaryGridlines: SvgLine[] | undefined;
	secondaryAxisLabels: SvgText[] | undefined;
}

function hasRicherAxisFeatures(chartData: PptxChartData): boolean {
	return Boolean(
		chartData.dataTable ||
		chartData.axes?.some(
			(axis) =>
				axis.crosses !== undefined ||
				axis.crossesAt !== undefined ||
				axis.crossBetween !== undefined ||
				(axis.axisType === 'valAx' &&
					Boolean(
						axis.logScale ||
						axis.displayUnits ||
						axis.axPos === 'r' ||
						axis.orientation === 'maxMin' ||
						axis.majorUnit !== undefined ||
						axis.minorUnit !== undefined ||
						axis.minorGridlines ||
						axis.majorTickMark !== undefined ||
						axis.minorTickMark !== undefined ||
						axis.tickLblPos !== undefined,
					)),
		),
	);
}

/** Build crossed primary and secondary value axes for a cartesian chart. */
export function buildCartesianAxes(
	chartData: PptxChartData,
	layout: PlotLayout,
	primaryRange: ValueRange,
	secondaryRange: ValueRange | undefined,
	categoryCount: number,
): CartesianAxesResult {
	if (!hasRicherAxisFeatures(chartData)) {
		const { gridlines, axisLabels } = buildGridlinesAndLabels(primaryRange, layout);
		return { gridlines, axisLabels, secondaryGridlines: undefined, secondaryAxisLabels: undefined };
	}
	const primaryAxis =
		chartData.axes?.find((axis) => axis.axisType === 'valAx' && axis.axPos !== 'r') ??
		chartData.axes?.find((axis) => axis.axisType === 'valAx');
	const categoryAxisFor = (axisId: number | undefined) =>
		chartData.axes?.find(
			(axis) => (axis.axisType === 'catAx' || axis.axisType === 'dateAx') && axis.axisId === axisId,
		);
	const axisX = (axisId: number | undefined, fallback: 'left' | 'right') =>
		verticalAxisX(
			categoryAxisFor(axisId),
			categoryCount,
			layout,
			fallback,
			chartData.dateCategories?.values,
		);
	const primary = buildPrimaryAxis(
		primaryRange,
		layout,
		primaryAxis,
		axisX(primaryAxis?.crossAxisId, 'left'),
	);
	if (!secondaryRange) {
		return { ...primary, secondaryGridlines: undefined, secondaryAxisLabels: undefined };
	}
	const secondaryAxis = getSecondaryValueAxis(chartData.axes);
	const secondary = buildSecondaryAxis(
		secondaryRange,
		layout,
		secondaryAxis,
		axisX(secondaryAxis?.crossAxisId, 'right'),
	);
	return {
		...primary,
		secondaryGridlines: secondary.gridlines,
		secondaryAxisLabels: secondary.axisLabels,
	};
}
