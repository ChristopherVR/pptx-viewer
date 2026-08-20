/* oxlint-disable eslint/one-var -- many independent it() blocks, each with
   its own short arrange/act/assert consts. */
import type { PptxTableRow } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	MIN_ROW_HEIGHT,
	computeColumnBoundaries,
	computeResizedColumnWidths,
	computeResizedRowHeight,
	evenColumnWidths,
	evenRowHeights,
	redistributeColumnWidth,
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

describe('redistributeColumnWidth', () => {
	it('sets the target column and rescales the others to sum 1', () => {
		const result = redistributeColumnWidth([0.5, 0.5], 0, 0.7);
		expect(result[0]).toBeCloseTo(0.7);
		expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
		expect(result[0]).toBeGreaterThan(result[1]);
	});

	it('preserves the relative ratio of the untouched columns', () => {
		// Columns 1 and 2 start at a 1:2 ratio; after redistributing column 0
		// they should still be at a 1:2 ratio of each other.
		const result = redistributeColumnWidth([0.5, 1 / 6, 1 / 3], 0, 0.2);
		expect(result[2] / result[1]).toBeCloseTo(2, 5);
		expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
	});

	it('returns the array unchanged for an out-of-range index', () => {
		const widths = [0.5, 0.5];
		expect(redistributeColumnWidth(widths, 5, 0.3)).toBe(widths);
	});
});

describe('evenColumnWidths', () => {
	it('returns equal fractions summing to 1', () => {
		const result = evenColumnWidths(4);
		expect(result).toHaveLength(4);
		expect(result.every((w) => w === 0.25)).toBeTruthy();
		expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
	});

	it('returns an empty array for zero (or fewer) columns', () => {
		expect(evenColumnWidths(0)).toStrictEqual([]);
		expect(evenColumnWidths(-1)).toStrictEqual([]);
	});
});

describe('evenRowHeights', () => {
	it('applies the rounded average height to every row', () => {
		const rows: PptxTableRow[] = [
			{ height: 20, cells: [] },
			{ height: 61, cells: [] },
		];
		const result = evenRowHeights(rows);
		expect(result[0].height).toBe(41);
		expect(result[1].height).toBe(41);
	});

	it('falls back to the default row height for rows with no explicit height', () => {
		const rows: PptxTableRow[] = [{ cells: [] }, { height: 40, cells: [] }];
		const result = evenRowHeights(rows);
		expect(result[0].height).toBe(36);
	});

	it('returns the input unchanged for an empty row list', () => {
		const rows: PptxTableRow[] = [];
		expect(evenRowHeights(rows)).toBe(rows);
	});
});
