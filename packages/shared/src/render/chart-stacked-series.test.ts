/**
 * Tests for chart-stacked-series.ts: the running-sum plot geometry shared by
 * stacked/percentStacked line and area charts.
 */
import { describe, expect, it } from 'vitest';

import { computeStackedSeriesPlots } from './chart-stacked-series';

describe('computeStackedSeriesPlots', () => {
	it('accumulates plain stacked values bottom-up in series order', () => {
		const plots = computeStackedSeriesPlots(
			[
				[10, 20],
				[5, 15],
			],
			2,
			false,
		);
		expect(plots[0]).toStrictEqual({ cumulative: [10, 20], base: [0, 0], own: [10, 20] });
		expect(plots[1]).toStrictEqual({ cumulative: [15, 35], base: [10, 20], own: [5, 15] });
	});

	it('normalises percentStacked shares to sum to 100 per category', () => {
		const plots = computeStackedSeriesPlots(
			[
				[30, 10],
				[70, 90],
			],
			2,
			true,
		);
		// Q1: A=30/100=30%, B=70/100=70% -> cumulative tops at 30 then 100.
		expect(plots[0].own).toStrictEqual([30, 10]);
		expect(plots[0].cumulative).toStrictEqual([30, 10]);
		expect(plots[1].own).toStrictEqual([70, 90]);
		expect(plots[1].cumulative).toStrictEqual([100, 100]);
	});

	it('keeps positive and negative running sums independent so mixed-sign values do not cancel', () => {
		const plots = computeStackedSeriesPlots(
			[
				[10, -5],
				[-3, 8],
			],
			2,
			false,
		);
		// Category 0: series 0 is +10 (positive stack 0->10); series 1 is -3
		// (negative stack 0->-3, unaffected by the positive stack).
		expect(plots[0]).toStrictEqual({ cumulative: [10, -5], base: [0, 0], own: [10, -5] });
		// Category 1: series 0 is -5 (negative stack 0->-5); series 1 is +8, which
		// starts its OWN positive stack from 0, not from series 0's negative base.
		expect(plots[1]).toStrictEqual({ cumulative: [-3, 8], base: [0, 0], own: [-3, 8] });
	});

	it('treats a zero category total as 0% rather than dividing by zero', () => {
		const plots = computeStackedSeriesPlots([[0, 0]], 2, true);
		expect(plots[0].own).toStrictEqual([0, 0]);
		expect(plots[0].cumulative).toStrictEqual([0, 0]);
	});

	it('defaults a missing category value to 0', () => {
		const plots = computeStackedSeriesPlots([[10], [5, 5]], 2, false);
		expect(plots[0].cumulative).toStrictEqual([10, 0]);
		expect(plots[1].cumulative).toStrictEqual([15, 5]);
	});
});
