import { describe, expect, it } from 'vitest';

import { buildPieChart3DHoverTooltip } from './pie-chart-3d-hit-test';

const data = {
	categoryLabels: ['Jan', 'Feb'],
	seriesName: 'Revenue',
	numberFormat: undefined,
};

describe('buildPieChart3DHoverTooltip', () => {
	it('returns undefined when there is no hit', () => {
		expect(buildPieChart3DHoverTooltip(undefined, data)).toBeUndefined();
		expect(buildPieChart3DHoverTooltip(null, data)).toBeUndefined();
	});

	it('builds "<series>, <category>: <value>" text for a hit', () => {
		const text = buildPieChart3DHoverTooltip({ pointIndex: 1, value: 42 }, data);
		expect(text).toBe('Revenue, Feb: 42');
	});

	it('formats the value through the number format when given', () => {
		const text = buildPieChart3DHoverTooltip(
			{ pointIndex: 0, value: 0.5 },
			{ ...data, numberFormat: '0%' },
		);
		expect(text).toBe('Revenue, Jan: 50%');
	});
});
