import { describe, it, expect } from 'vitest';

import {
	MIN_ROW_HEIGHT,
	computeColumnBoundaries,
	computeResizedColumnWidths,
	computeResizedRowHeight,
} from './table-resize';

describe('computeColumnBoundaries', () => {
	it('returns cumulative percentages for internal boundaries only', () => {
		expect(computeColumnBoundaries([0.25, 0.25, 0.5])).toStrictEqual([25, 50]);
	});

	it('returns an empty array for a single column', () => {
		expect(computeColumnBoundaries([1])).toStrictEqual([]);
	});

	it('returns an empty array for no columns', () => {
		expect(computeColumnBoundaries([])).toStrictEqual([]);
	});
});

describe('computeResizedColumnWidths', () => {
	it('shifts width from one column to its neighbour and keeps the sum at 1', () => {
		const result = computeResizedColumnWidths([0.5, 0.5], 0, 0.1);
		expect(result[0]).toBeCloseTo(0.6);
		expect(result[1]).toBeCloseTo(0.4);
		expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
	});

	it('clamps the shrinking column before renormalising to sum 1', () => {
		// A large negative delta drives column 0 to the MIN clamp pre-normalisation,
		// so after renormalisation column 1 holds the dominant share.
		const result = computeResizedColumnWidths([0.5, 0.5], 0, -0.9);
		expect(result[0]).toBeLessThan(result[1]);
		expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
	});

	it('leaves other columns untouched (proportionally)', () => {
		const result = computeResizedColumnWidths([0.25, 0.25, 0.5], 0, 0.1);
		expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
		// Third column keeps its relative weight since only 0 and 1 were adjusted.
		expect(result[2]).toBeCloseTo(0.5);
	});

	it('returns the input unchanged when the index has no right neighbour', () => {
		const input = [0.5, 0.5];
		expect(computeResizedColumnWidths(input, 1, 0.1)).toBe(input);
	});

	it('returns the input unchanged for a negative index', () => {
		const input = [0.5, 0.5];
		expect(computeResizedColumnWidths(input, -1, 0.1)).toBe(input);
	});
});

describe('computeResizedRowHeight', () => {
	it('adds the delta and rounds', () => {
		expect(computeResizedRowHeight(32, 8.4)).toBe(40);
	});

	it('clamps to the minimum row height', () => {
		expect(computeResizedRowHeight(20, -100)).toBe(MIN_ROW_HEIGHT);
	});
});
