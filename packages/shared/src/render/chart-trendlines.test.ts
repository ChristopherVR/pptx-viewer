import type { PptxChartTrendline } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { PlotLayout, ValueRange } from './chart-helpers';
import { computeTrendlinePoints } from './chart-trendlines';

const layout: PlotLayout = {
	plotLeft: 0,
	plotTop: 0,
	plotRight: 100,
	plotBottom: 100,
	plotWidth: 100,
	plotHeight: 100,
	svgWidth: 100,
	svgHeight: 100,
};

const range: ValueRange = { min: 0, max: 10, span: 10 };

describe('computeTrendlinePoints', () => {
	it('returns no points for fewer than two values', () => {
		const r = computeTrendlinePoints({ trendlineType: 'linear' }, [5], 1, layout, range, 'line');
		expect(r.points).toHaveLength(0);
	});

	it('fits a perfect linear series (slope 1, intercept 1)', () => {
		const r = computeTrendlinePoints(
			{ trendlineType: 'linear', displayEq: true, displayRSq: true },
			[1, 2, 3, 4],
			4,
			layout,
			range,
			'line',
		);
		expect(r.points.length).toBeGreaterThan(2);
		expect(r.equation).toContain('1.00x');
		// Perfect fit → R² of 1.
		expect(r.rSquared).toBeCloseTo(1, 5);
	});

	it('computes a moving average with the requested period', () => {
		const r = computeTrendlinePoints(
			{ trendlineType: 'movingAvg', period: 2 },
			[2, 4, 6, 8],
			4,
			layout,
			range,
			'line',
		);
		// period-2 over 4 points → 3 averaged points.
		expect(r.points).toHaveLength(3);
		expect(r.equation).toBe('2-period moving average');
	});

	it('handles an unsupported regression type as empty', () => {
		const r = computeTrendlinePoints(
			{ trendlineType: 'unknownType' as PptxChartTrendline['trendlineType'] },
			[1, 2, 3],
			3,
			layout,
			range,
			'line',
		);
		expect(r.points).toHaveLength(0);
	});

	it('fits an exponential series', () => {
		const r = computeTrendlinePoints(
			{ trendlineType: 'exponential', displayEq: true },
			[1, 2, 4, 8],
			4,
			layout,
			range,
			'line',
		);
		expect(r.points.length).toBeGreaterThan(2);
		expect(r.equation).toContain('e^');
	});
});
