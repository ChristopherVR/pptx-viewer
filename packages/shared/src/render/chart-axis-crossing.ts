import type { PptxChartAxisFormatting } from 'pptx-viewer-core';

import type { PlotLayout, ValueRange } from './chart-view-model';
import { valueToY } from './chart-view-model';

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/** Resolve where the horizontal category/date axis crosses its linked value axis. */
export function horizontalAxisY(
	valueAxis: PptxChartAxisFormatting | undefined,
	range: ValueRange,
	layout: PlotLayout,
	fallback: 'top' | 'bottom',
): number {
	if (valueAxis?.crosses === 'max') {
		return layout.plotTop;
	}
	if (valueAxis?.crosses === 'min') {
		return layout.plotBottom;
	}
	const crossingValue = valueAxis?.crossesAt ?? 0;
	if (valueAxis?.crossesAt !== undefined || valueAxis?.crosses === 'autoZero') {
		return valueToY(
			clamp(crossingValue, range.min, range.max),
			range,
			layout.plotTop,
			layout.plotBottom,
		);
	}
	return fallback === 'top' ? layout.plotTop : layout.plotBottom;
}

/** Resolve where a vertical value axis crosses a category axis. */
export function verticalAxisX(
	categoryAxis: PptxChartAxisFormatting | undefined,
	categoryCount: number,
	layout: PlotLayout,
	fallback: 'left' | 'right',
	dateValues?: ReadonlyArray<number>,
): number {
	if (categoryAxis?.crosses === 'max') {
		return layout.plotRight;
	}
	if (categoryAxis?.crosses === 'min') {
		return layout.plotLeft;
	}
	if (categoryAxis?.crossesAt !== undefined) {
		if (categoryAxis.axisType === 'dateAx' && dateValues?.length) {
			const min = categoryAxis.min ?? Math.min(...dateValues);
			const max = categoryAxis.max ?? Math.max(...dateValues);
			const ratio =
				max === min ? 0.5 : (clamp(categoryAxis.crossesAt, min, max) - min) / (max - min);
			return layout.plotLeft + ratio * layout.plotWidth;
		}
		const index = clamp(categoryAxis.crossesAt - 1, 0, Math.max(categoryCount - 1, 0));
		const ratio = categoryCount <= 1 ? 0.5 : index / (categoryCount - 1);
		return layout.plotLeft + ratio * layout.plotWidth;
	}
	return fallback === 'right' ? layout.plotRight : layout.plotLeft;
}
