import { describe, expect, it } from 'vitest';

import { buildBarChart3DHoverTooltip } from './bar-chart-3d-hit-test';

const data = {
	categoryLabels: ['A', 'B'],
	seriesNames: ['S1', 'S2'],
};

describe('buildBarChart3DHoverTooltip', () => {
	it('returns undefined when there is no hit', () => {
		expect(buildBarChart3DHoverTooltip(undefined, data)).toBeUndefined();
		expect(buildBarChart3DHoverTooltip(null, data)).toBeUndefined();
	});

	it('builds "<series>, <category>: <value>" text for a hit', () => {
		const text = buildBarChart3DHoverTooltip({ seriesIndex: 1, categoryIndex: 0, value: 42 }, data);
		expect(text).toBe('S2, A: 42');
	});

	it('formats the value through the per-series number format when given', () => {
		const text = buildBarChart3DHoverTooltip(
			{ seriesIndex: 0, categoryIndex: 1, value: 0.5 },
			{ ...data, numberFormats: ['0%', undefined] },
		);
		expect(text).toBe('S1, B: 50%');
	});
});
