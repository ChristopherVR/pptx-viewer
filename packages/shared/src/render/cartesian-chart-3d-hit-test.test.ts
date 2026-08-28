import { describe, expect, it } from 'vitest';

import { buildCartesianChart3DHoverTooltip } from './cartesian-chart-3d-hit-test';

const DATA = {
	categoryLabels: ['A', 'B'],
	seriesNames: ['S1', 'S2'],
};

describe('buildCartesianChart3DHoverTooltip', () => {
	it('returns undefined for a null/undefined hit', () => {
		expect(buildCartesianChart3DHoverTooltip(null, DATA)).toBeUndefined();
		expect(buildCartesianChart3DHoverTooltip(undefined, DATA)).toBeUndefined();
	});

	it('builds "<series>, <category>: <value>" text for a hit', () => {
		const tooltip = buildCartesianChart3DHoverTooltip(
			{ seriesIndex: 1, categoryIndex: 0, value: 42 },
			DATA,
		);
		expect(tooltip).toBe('S2, A: 42');
	});

	it('honours a per-series number format', () => {
		const tooltip = buildCartesianChart3DHoverTooltip(
			{ seriesIndex: 0, categoryIndex: 1, value: 0.5 },
			{ ...DATA, numberFormats: ['0%'] },
		);
		expect(tooltip).toBe('S1, B: 50%');
	});
});
