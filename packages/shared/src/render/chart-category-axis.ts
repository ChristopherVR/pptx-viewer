import type { PptxChartAxisFormatting, PptxChartData } from 'pptx-viewer-core';

import { chartLineStyle } from './chart-axis-style';
import { buildMultiLevelCategoryLabels } from './chart-category-labels';
import { categoryX } from './chart-category-position';
import type { PlotLayout, SvgLine, SvgText } from './chart-view-model';

export { categoryX } from './chart-category-position';

export interface CategoryAxisPlan {
	axis: PptxChartAxisFormatting | undefined;
	sourceIndices: number[];
	labels: SvgText[];
	tickMarks: SvgLine[];
}

function primaryCategoryAxis(
	axes: ReadonlyArray<PptxChartAxisFormatting> | undefined,
): PptxChartAxisFormatting | undefined {
	const categoryAxes = axes?.filter(
		(axis) => axis.axisType === 'catAx' || axis.axisType === 'dateAx',
	);
	return categoryAxes?.find((axis) => axis.axPos !== 't') ?? categoryAxes?.[0];
}

function tickLine(
	x: number,
	y: number,
	placement: PptxChartAxisFormatting['majorTickMark'],
	topAxis: boolean,
	length: number,
	axis: PptxChartAxisFormatting,
): SvgLine | undefined {
	if (!placement || placement === 'none') {
		return undefined;
	}
	const inward = topAxis ? length : -length;
	const outward = -inward;
	const [start, end] =
		placement === 'cross' ? [-length, length] : placement === 'in' ? [0, inward] : [0, outward];
	return {
		kind: 'line',
		x1: x,
		y1: y + start,
		x2: x,
		y2: y + end,
		...chartLineStyle(axis.spPr),
	};
}

function buildTickMarks(
	axis: PptxChartAxisFormatting | undefined,
	sourceCount: number,
	layout: PlotLayout,
	spacing: 'bar' | 'line',
	axisY?: number,
): SvgLine[] {
	if (!axis || axis.deleted) {
		return [];
	}
	const result: SvgLine[] = [];
	const topAxis = axis.axPos === 't';
	const y = axisY ?? (topAxis ? layout.plotTop : layout.plotBottom);
	if (axis.spPr) {
		result.push({
			kind: 'line',
			x1: layout.plotLeft,
			y1: y,
			x2: layout.plotRight,
			y2: y,
			...chartLineStyle(axis.spPr),
		});
	}
	const majorSkip = Math.max(1, axis.tickMarkSkip ?? 1);
	for (let displayIndex = 0; displayIndex < sourceCount; displayIndex += majorSkip) {
		const x = categoryX(displayIndex, sourceCount, layout, spacing);
		const major = tickLine(x, y, axis.majorTickMark, topAxis, 4, axis);
		if (major) {
			result.push(major);
		}
		if (axis.minorTickMark !== undefined && displayIndex + majorSkip < sourceCount) {
			const nextX = categoryX(displayIndex + majorSkip, sourceCount, layout, spacing);
			const minor = tickLine((x + nextX) / 2, y, axis.minorTickMark, topAxis, 2.5, axis);
			if (minor) {
				result.push(minor);
			}
		}
	}
	return result;
}

/** Build category order, labels, and explicit tick marks from the primary category/date axis. */
export function buildCategoryAxisPlan(
	categoryLabels: ReadonlyArray<string>,
	layout: PlotLayout,
	spacing: 'bar' | 'line',
	axes: ReadonlyArray<PptxChartAxisFormatting> | undefined,
	selectedAxis?: PptxChartAxisFormatting,
	axisY?: number,
	categoryLevels?: ReadonlyArray<ReadonlyArray<string>>,
): CategoryAxisPlan {
	const axis = selectedAxis ?? primaryCategoryAxis(axes);
	const sourceIndices = categoryLabels.map((_label, index) => index);
	if (axis?.orientation === 'maxMin') {
		sourceIndices.reverse();
	}
	if (axis?.deleted || axis?.tickLblPos === 'none') {
		return {
			axis,
			sourceIndices,
			labels: [],
			tickMarks: buildTickMarks(axis, sourceIndices.length, layout, spacing, axisY),
		};
	}
	const topAxis = axis?.axPos === 't';
	const high = axis?.tickLblPos === 'high';
	const low = axis?.tickLblPos === 'low';
	const labelsAbove = high || (!low && topAxis);
	const offset = 4 + 8 * ((axis?.labelOffset ?? 100) / 100);
	const labelY = high
		? layout.plotTop
		: low
			? layout.plotBottom
			: (axisY ?? (topAxis ? layout.plotTop : layout.plotBottom));
	const labels = buildMultiLevelCategoryLabels(
		categoryLabels,
		categoryLevels,
		sourceIndices,
		layout,
		spacing,
		axis,
		labelY,
		labelsAbove,
		offset,
	);
	return {
		axis,
		sourceIndices,
		labels,
		tickMarks: buildTickMarks(axis, sourceIndices.length, layout, spacing, axisY),
	};
}

/** Reorder category-bound data for non-interactive overlays and data tables. */
export function chartDataInCategoryOrder(
	chartData: PptxChartData,
	sourceIndices: ReadonlyArray<number>,
): PptxChartData {
	if (sourceIndices.every((sourceIndex, displayIndex) => sourceIndex === displayIndex)) {
		return chartData;
	}
	return {
		...chartData,
		categories: sourceIndices.map((sourceIndex) => chartData.categories[sourceIndex] ?? ''),
		categoryLevels: chartData.categoryLevels?.map((level) =>
			sourceIndices.map((sourceIndex) => level[sourceIndex] ?? ''),
		),
		series: chartData.series.map((series) => ({
			...series,
			values: sourceIndices.map((sourceIndex) => series.values[sourceIndex] ?? 0),
			errBars: series.errBars?.map((errorBars) => ({
				...errorBars,
				customPlus: errorBars.customPlus
					? sourceIndices.map((sourceIndex) => errorBars.customPlus?.[sourceIndex] ?? 0)
					: undefined,
				customMinus: errorBars.customMinus
					? sourceIndices.map((sourceIndex) => errorBars.customMinus?.[sourceIndex] ?? 0)
					: undefined,
			})),
		})),
	};
}
