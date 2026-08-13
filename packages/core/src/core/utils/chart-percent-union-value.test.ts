import { describe, expect, it } from 'vitest';

import { chartPercentUnionValue } from './chart-percent-union-value';

const LABEL_OFFSET = { name: 'labelOffset', min: 0, max: 1000 } as const;

describe('chartPercentUnionValue', () => {
	it('emits the numeric union member, never the percent literal', () => {
		expect(chartPercentUnionValue(100, LABEL_OFFSET)).toBe('100');
		expect(chartPercentUnionValue(0, LABEL_OFFSET)).toBe('0');
		expect(chartPercentUnionValue(1000, LABEL_OFFSET)).toBe('1000');
		expect(chartPercentUnionValue(219, { name: 'gapWidth', min: 0, max: 500 })).not.toContain('%');
	});

	it('rounds to the integral member and rejects out-of-range values', () => {
		expect(chartPercentUnionValue(120.4, LABEL_OFFSET)).toBe('120');
		// Math.round is half-up, so -27.5 lands on -27.
		expect(chartPercentUnionValue(-27.5, { name: 'overlap', min: -100, max: 100 })).toBe('-27');
		expect(() => chartPercentUnionValue(-1, LABEL_OFFSET)).toThrow(
			new RangeError('labelOffset must be between 0 and 1000'),
		);
		expect(() => chartPercentUnionValue(1001, LABEL_OFFSET)).toThrow(RangeError);
		expect(() => chartPercentUnionValue(Number.NaN, LABEL_OFFSET)).toThrow(RangeError);
	});
});
