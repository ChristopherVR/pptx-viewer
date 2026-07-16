import type { PptxChartWaterfallOptions } from 'pptx-viewer-core';

import type { ValueRange } from './chart-view-model';
import { computeValueRange } from './chart-view-model';

export interface WaterfallStep {
	sourceIndex: number;
	value: number;
	startValue: number;
	endValue: number;
	isSubtotal: boolean;
}

/** Resolve ChartEx waterfall deltas and absolute subtotal bars. */
export function buildWaterfallSteps(
	values: ReadonlyArray<number>,
	options: PptxChartWaterfallOptions | undefined,
): WaterfallStep[] {
	const subtotalIndices = new Set(
		options?.subtotalIndices ?? (values.length > 0 ? [values.length - 1] : []),
	);
	const steps: WaterfallStep[] = [];
	let runningTotal = 0;
	for (let sourceIndex = 0; sourceIndex < values.length; sourceIndex++) {
		const value = values[sourceIndex] ?? 0;
		const isSubtotal = subtotalIndices.has(sourceIndex);
		const startValue = isSubtotal ? 0 : runningTotal;
		const endValue = isSubtotal ? value : runningTotal + value;
		steps.push({ sourceIndex, value, startValue, endValue, isSubtotal });
		runningTotal = endValue;
	}
	return steps;
}

/** Compute a value range containing every cumulative and absolute bar endpoint. */
export function computeWaterfallRange(steps: ReadonlyArray<WaterfallStep>): ValueRange {
	return computeValueRange([
		{
			name: 'Waterfall range',
			values: steps.flatMap((step) => [step.startValue, step.endValue]),
		},
	]);
}
