import { describe, expect, it } from 'vitest';

import { buildWaterfallSteps, computeWaterfallRange } from './chart-waterfall-layout';

describe('chartEx waterfall layout', () => {
	it('treats only marked indexes as absolute subtotals and resets the running total', () => {
		expect(
			buildWaterfallSteps([100, 25, 125, -20, 105], {
				subtotalIndices: [0, 2, 4],
			}),
		).toStrictEqual([
			{ sourceIndex: 0, value: 100, startValue: 0, endValue: 100, isSubtotal: true },
			{ sourceIndex: 1, value: 25, startValue: 100, endValue: 125, isSubtotal: false },
			{ sourceIndex: 2, value: 125, startValue: 0, endValue: 125, isSubtotal: true },
			{ sourceIndex: 3, value: -20, startValue: 125, endValue: 105, isSubtotal: false },
			{ sourceIndex: 4, value: 105, startValue: 0, endValue: 105, isSubtotal: true },
		]);
	});

	it('uses delta semantics for every point when typed subtotals are explicitly empty', () => {
		const steps = buildWaterfallSteps([10, 20, 30], { subtotalIndices: [] });
		expect(steps.map((step) => step.endValue)).toStrictEqual([10, 30, 60]);
		expect(steps.every((step) => !step.isSubtotal)).toBeTruthy();
	});

	it('keeps the legacy last-point total fallback and ranges cumulative endpoints', () => {
		const steps = buildWaterfallSteps([100, 50, 150], undefined);
		expect(steps[2]).toMatchObject({ startValue: 0, endValue: 150, isSubtotal: true });
		const range = computeWaterfallRange(
			buildWaterfallSteps([100, 100, 50], { subtotalIndices: [] }),
		);
		expect(range.max).toBeGreaterThanOrEqual(250);
	});
});
