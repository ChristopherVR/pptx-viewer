import { describe, expect, it } from 'vitest';

import { computeVirtualRange, SLIDE_VIRTUALIZATION_THRESHOLD } from './virtualized-list';

describe('computeVirtualRange', () => {
	it('returns an empty window for an empty list', () => {
		expect(computeVirtualRange(0, 100, 0, 600)).toStrictEqual({
			startIndex: 0,
			endIndex: -1,
			totalHeight: 0,
			offsetY: 0,
			visibleRange: { start: 0, end: -1 },
		});
	});

	it('adds overscan without exceeding list bounds', () => {
		const range = computeVirtualRange(100, 100, 5000, 600, 3);
		expect(range).toMatchObject({
			startIndex: 47,
			endIndex: 59,
			totalHeight: 10_000,
			offsetY: 4700,
			visibleRange: { start: 50, end: 56 },
		});
	});

	it('clamps invalid dimensions and scroll positions', () => {
		const range = computeVirtualRange(3, 0, -100, -20, -1);
		expect(range.startIndex).toBe(0);
		expect(range.endIndex).toBe(0);
		expect(range.totalHeight).toBe(3);
	});

	it('uses the same large-deck threshold as React', () => {
		expect(SLIDE_VIRTUALIZATION_THRESHOLD).toBe(50);
	});
});
