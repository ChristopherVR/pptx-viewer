import type { PptxChartAxisFormatting, PptxChartData } from 'pptx-viewer-core';

import type { PlotLayout, SvgLine, SvgText } from './chart-view-model';

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

export function categoryX(
	displayIndex: number,
	count: number,
	layout: PlotLayout,
	spacing: 'bar' | 'line',
): number {
	if (spacing === 'bar') {
		return layout.plotLeft + (layout.plotWidth / Math.max(count, 1)) * (displayIndex + 0.5);
	}
	return count > 1
		? layout.plotLeft + (layout.plotWidth / (count - 1)) * displayIndex
		: layout.plotLeft + layout.plotWidth / 2;
}

function tickLine(
	x: number,
	y: number,
	placement: PptxChartAxisFormatting['majorTickMark'],
	topAxis: boolean,
	length: number,
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
		stroke: '#64748b',
		strokeWidth: 1,
	};
}

function buildTickMarks(
	axis: PptxChartAxisFormatting | undefined,
	sourceCount: number,
	layout: PlotLayout,
	spacing: 'bar' | 'line',
): SvgLine[] {
	if (!axis || axis.deleted) {
		return [];
	}
	const result: SvgLine[] = [];
	const topAxis = axis.axPos === 't';
	const y = topAxis ? layout.plotTop : layout.plotBottom;
	const majorSkip = Math.max(1, axis.tickMarkSkip ?? 1);
	for (let displayIndex = 0; displayIndex < sourceCount; displayIndex += majorSkip) {
		const x = categoryX(displayIndex, sourceCount, layout, spacing);
		const major = tickLine(x, y, axis.majorTickMark, topAxis, 4);
		if (major) {
			result.push(major);
		}
		if (axis.minorTickMark !== undefined && displayIndex + majorSkip < sourceCount) {
			const nextX = categoryX(displayIndex + majorSkip, sourceCount, layout, spacing);
			const minor = tickLine((x + nextX) / 2, y, axis.minorTickMark, topAxis, 2.5);
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
): CategoryAxisPlan {
	const axis = primaryCategoryAxis(axes);
	const sourceIndices = categoryLabels.map((_label, index) => index);
	if (axis?.orientation === 'maxMin') {
		sourceIndices.reverse();
	}
	if (axis?.deleted || axis?.tickLblPos === 'none') {
		return {
			axis,
			sourceIndices,
			labels: [],
			tickMarks: buildTickMarks(axis, sourceIndices.length, layout, spacing),
		};
	}
	const topAxis = axis?.axPos === 't';
	const high = axis?.tickLblPos === 'high';
	const low = axis?.tickLblPos === 'low';
	const labelsAbove = high || (!low && topAxis);
	const offset = 4 + 8 * ((axis?.labelOffset ?? 100) / 100);
	const labelSkip = Math.max(1, axis?.tickLabelSkip ?? 1);
	const textAnchor: SvgText['textAnchor'] =
		axis?.labelAlignment === 'l' ? 'start' : axis?.labelAlignment === 'r' ? 'end' : 'middle';
	const labels = sourceIndices.flatMap((sourceIndex, displayIndex) => {
		if (displayIndex % labelSkip !== 0) {
			return [];
		}
		return [
			{
				kind: 'text' as const,
				x: categoryX(displayIndex, sourceIndices.length, layout, spacing),
				y: labelsAbove ? layout.plotTop - offset : layout.plotBottom + offset,
				text: categoryLabels[sourceIndex] ?? '',
				fontSize: 8,
				fill: '#64748b',
				textAnchor,
			},
		];
	});
	return {
		axis,
		sourceIndices,
		labels,
		tickMarks: buildTickMarks(axis, sourceIndices.length, layout, spacing),
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
