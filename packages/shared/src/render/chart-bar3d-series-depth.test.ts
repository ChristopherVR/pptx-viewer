import { describe, expect, it } from 'vitest';

import {
	computeSeriesDepth,
	scaleDepthVector,
	seriesDepthFactor,
	sortSeriesBackToFront,
} from './chart-bar3d-series-depth';

describe('seriesDepthFactor', () => {
	it('returns 1 for a single-series chart, matching the previous shared-depth behaviour', () => {
		expect(seriesDepthFactor(0, 1)).toBe(1);
	});

	it('returns 1 for the last series and a fractional step for earlier ones', () => {
		expect(seriesDepthFactor(0, 4)).toBeCloseTo(0.25);
		expect(seriesDepthFactor(1, 4)).toBeCloseTo(0.5);
		expect(seriesDepthFactor(2, 4)).toBeCloseTo(0.75);
		expect(seriesDepthFactor(3, 4)).toBe(1);
	});
});

describe('scaleDepthVector', () => {
	it('scales dx, dy, and magnitude by the same factor', () => {
		expect(scaleDepthVector({ dx: 10, dy: -4, magnitude: 12 }, 0.5)).toStrictEqual({
			dx: 5,
			dy: -2,
			magnitude: 6,
		});
	});
});

describe('computeSeriesDepth', () => {
	it('gives the last series the full base depth vector', () => {
		const base = { dx: 10, dy: -4, magnitude: 12 };
		expect(computeSeriesDepth(base, 2, 3)).toStrictEqual(base);
	});

	it('gives an earlier series a proportionally smaller offset', () => {
		const base = { dx: 10, dy: -4, magnitude: 12 };
		const first = computeSeriesDepth(base, 0, 3);
		expect(first.magnitude).toBeLessThan(base.magnitude);
		expect(first.magnitude).toBeGreaterThan(0);
	});
});

describe('sortSeriesBackToFront', () => {
	it('orders series with the largest depth factor (farthest) first', () => {
		expect(sortSeriesBackToFront([0, 1, 2], 3)).toStrictEqual([2, 1, 0]);
	});

	it('is stable for a single series', () => {
		expect(sortSeriesBackToFront([0], 1)).toStrictEqual([0]);
	});
});
