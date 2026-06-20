import type { PptxTableData } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	computeBoundingRect,
	canMergeCells,
	canSplitCell,
	mergeCells,
	splitCell,
} from './table-merge-core';
import { rectToCells, isCellInRect } from './table-selection-utils';

// ---------------------------------------------------------------------------
// Helpers for building test table data
// ---------------------------------------------------------------------------

function makeTable(rows: number, cols: number, cellTexts?: string[][]): PptxTableData {
	return {
		rows: Array.from({ length: rows }, (_row, ri) => ({
			cells: Array.from({ length: cols }, (_col, ci) => ({
				text: cellTexts?.[ri]?.[ci] ?? '',
			})),
		})),
	} as PptxTableData;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeBoundingRect', () => {
	it('should return undefined for empty array', () => {
		expect(computeBoundingRect([])).toBeUndefined();
	});

	it('should return single-cell rect for one coordinate', () => {
		const rect = computeBoundingRect([{ row: 2, col: 3 }]);
		expect(rect).toStrictEqual({
			startRow: 2,
			startCol: 3,
			endRow: 2,
			endCol: 3,
		});
	});

	it('should compute bounding rect for multiple cells', () => {
		const rect = computeBoundingRect([
			{ row: 0, col: 0 },
			{ row: 2, col: 3 },
			{ row: 1, col: 1 },
		]);
		expect(rect).toStrictEqual({
			startRow: 0,
			startCol: 0,
			endRow: 2,
			endCol: 3,
		});
	});

	it('should handle cells in same row', () => {
		const rect = computeBoundingRect([
			{ row: 1, col: 0 },
			{ row: 1, col: 4 },
		]);
		expect(rect).toStrictEqual({
			startRow: 1,
			startCol: 0,
			endRow: 1,
			endCol: 4,
		});
	});

	it('should handle cells in same column', () => {
		const rect = computeBoundingRect([
			{ row: 0, col: 2 },
			{ row: 5, col: 2 },
		]);
		expect(rect).toStrictEqual({
			startRow: 0,
			startCol: 2,
			endRow: 5,
			endCol: 2,
		});
	});

	it('should handle non-sorted inputs correctly', () => {
		const rect = computeBoundingRect([
			{ row: 5, col: 5 },
			{ row: 1, col: 1 },
			{ row: 3, col: 3 },
		]);
		expect(rect!.startRow).toBe(1);
		expect(rect!.startCol).toBe(1);
		expect(rect!.endRow).toBe(5);
		expect(rect!.endCol).toBe(5);
	});
});

describe('canMergeCells', () => {
	it('should return false for fewer than 2 cells', () => {
		const table = makeTable(3, 3);
		expect(canMergeCells([{ row: 0, col: 0 }], table)).toBeFalsy();
		expect(canMergeCells([], table)).toBeFalsy();
	});

	it('should return true for valid rectangular selection of 2+ cells', () => {
		const table = makeTable(3, 3);
		expect(
			canMergeCells(
				[
					{ row: 0, col: 0 },
					{ row: 0, col: 1 },
				],
				table,
			),
		).toBeTruthy();
	});

	it('should return true for 2x2 block selection', () => {
		const table = makeTable(3, 3);
		expect(
			canMergeCells(
				[
					{ row: 0, col: 0 },
					{ row: 0, col: 1 },
					{ row: 1, col: 0 },
					{ row: 1, col: 1 },
				],
				table,
			),
		).toBeTruthy();
	});

	it('should return false when bounding rect is a single cell', () => {
		const table = makeTable(3, 3);
		// Two identical cells: bounding rect is 1x1
		expect(
			canMergeCells(
				[
					{ row: 1, col: 1 },
					{ row: 1, col: 1 },
				],
				table,
			),
		).toBeFalsy();
	});

	it('should handle tables where cells at the boundary exist', () => {
		const table = makeTable(2, 2);
		expect(
			canMergeCells(
				[
					{ row: 0, col: 0 },
					{ row: 1, col: 1 },
				],
				table,
			),
		).toBeTruthy();
	});
});

describe('canSplitCell', () => {
	it('should return false for a normal unmerged cell', () => {
		const table = makeTable(3, 3);
		expect(canSplitCell(0, 0, table)).toBeFalsy();
	});

	it('should return true for a cell with gridSpan > 1', () => {
		const table = makeTable(3, 3);
		table.rows[0].cells[0].gridSpan = 2;
		expect(canSplitCell(0, 0, table)).toBeTruthy();
	});

	it('should return true for a cell with rowSpan > 1', () => {
		const table = makeTable(3, 3);
		table.rows[0].cells[0].rowSpan = 3;
		expect(canSplitCell(0, 0, table)).toBeTruthy();
	});

	it('should return false for out-of-bounds cell', () => {
		const table = makeTable(3, 3);
		expect(canSplitCell(10, 10, table)).toBeFalsy();
	});

	it('should return false for cell with gridSpan and rowSpan both 1', () => {
		const table = makeTable(3, 3);
		table.rows[0].cells[0].gridSpan = 1;
		table.rows[0].cells[0].rowSpan = 1;
		expect(canSplitCell(0, 0, table)).toBeFalsy();
	});
});

describe('mergeCells', () => {
	it('should set gridSpan on anchor cell for horizontal merge', () => {
		const table = makeTable(3, 3);
		const result = mergeCells(
			[
				{ row: 0, col: 0 },
				{ row: 0, col: 1 },
				{ row: 0, col: 2 },
			],
			table,
		);
		expect(result.rows[0].cells[0].gridSpan).toBe(3);
		expect(result.rows[0].cells[1].hMerge).toBeTruthy();
		expect(result.rows[0].cells[2].hMerge).toBeTruthy();
	});

	it('should set rowSpan on anchor cell for vertical merge', () => {
		const table = makeTable(3, 3);
		const result = mergeCells(
			[
				{ row: 0, col: 0 },
				{ row: 1, col: 0 },
				{ row: 2, col: 0 },
			],
			table,
		);
		expect(result.rows[0].cells[0].rowSpan).toBe(3);
		expect(result.rows[1].cells[0].vMerge).toBeTruthy();
		expect(result.rows[2].cells[0].vMerge).toBeTruthy();
	});

	it('should combine text from merged cells', () => {
		const table = makeTable(2, 2, [
			['Hello', 'World'],
			['Foo', 'Bar'],
		]);
		const result = mergeCells(
			[
				{ row: 0, col: 0 },
				{ row: 0, col: 1 },
				{ row: 1, col: 0 },
				{ row: 1, col: 1 },
			],
			table,
		);
		expect(result.rows[0].cells[0].text).toBe('Hello World Foo Bar');
	});

	it('should clear text on non-anchor cells', () => {
		const table = makeTable(2, 2, [
			['A', 'B'],
			['C', 'D'],
		]);
		const result = mergeCells(
			[
				{ row: 0, col: 0 },
				{ row: 0, col: 1 },
			],
			table,
		);
		expect(result.rows[0].cells[1].text).toBe('');
	});

	it('should return original table when bounding rect is empty', () => {
		const table = makeTable(3, 3);
		const result = mergeCells([], table);
		expect(result).toBe(table);
	});

	it('should return original table when rect is a single cell (no merge needed)', () => {
		const table = makeTable(3, 3);
		const result = mergeCells([{ row: 0, col: 0 }], table);
		expect(result).toBe(table);
	});
});

describe('splitCell', () => {
	it('should remove gridSpan and rowSpan from anchor cell', () => {
		const table = makeTable(2, 3);
		table.rows[0].cells[0].gridSpan = 2;
		table.rows[0].cells[0].rowSpan = 2;
		table.rows[0].cells[1].hMerge = true;
		table.rows[1].cells[0].vMerge = true;
		table.rows[1].cells[1].hMerge = true;
		table.rows[1].cells[1].vMerge = true;

		const result = splitCell(0, 0, table);
		expect(result.rows[0].cells[0].gridSpan).toBeUndefined();
		expect(result.rows[0].cells[0].rowSpan).toBeUndefined();
	});

	it('should clear hMerge/vMerge on continuation cells', () => {
		const table = makeTable(2, 2);
		table.rows[0].cells[0].gridSpan = 2;
		table.rows[0].cells[1].hMerge = true;

		const result = splitCell(0, 0, table);
		expect(result.rows[0].cells[1].hMerge).toBeUndefined();
	});

	it('should return original table for non-merged cell', () => {
		const table = makeTable(3, 3);
		const result = splitCell(0, 0, table);
		expect(result).toBe(table);
	});

	it('should return original table for out-of-bounds cell', () => {
		const table = makeTable(3, 3);
		const result = splitCell(10, 10, table);
		expect(result).toBe(table);
	});

	it('should not affect cells outside the merge region', () => {
		const table = makeTable(2, 3);
		table.rows[0].cells[0].gridSpan = 2;
		table.rows[0].cells[1].hMerge = true;
		table.rows[0].cells[2].text = 'untouched';

		const result = splitCell(0, 0, table);
		expect(result.rows[0].cells[2].text).toBe('untouched');
	});
});

describe('rectToCells', () => {
	it('should enumerate all cells in a rectangle', () => {
		const cells = rectToCells({
			startRow: 0,
			startCol: 0,
			endRow: 1,
			endCol: 1,
		});
		expect(cells).toStrictEqual([
			{ row: 0, col: 0 },
			{ row: 0, col: 1 },
			{ row: 1, col: 0 },
			{ row: 1, col: 1 },
		]);
	});

	it('should return single cell for 1x1 rect', () => {
		const cells = rectToCells({
			startRow: 2,
			startCol: 3,
			endRow: 2,
			endCol: 3,
		});
		expect(cells).toStrictEqual([{ row: 2, col: 3 }]);
	});

	it('should return correct count for larger rectangle', () => {
		const cells = rectToCells({
			startRow: 0,
			startCol: 0,
			endRow: 2,
			endCol: 3,
		});
		expect(cells).toHaveLength(12); // 3 rows x 4 cols
	});
});

describe('isCellInRect', () => {
	const rect = { startRow: 1, startCol: 1, endRow: 3, endCol: 3 };

	it('should return true for cell inside the rect', () => {
		expect(isCellInRect(2, 2, rect)).toBeTruthy();
	});

	it('should return true for cell on the boundary', () => {
		expect(isCellInRect(1, 1, rect)).toBeTruthy();
		expect(isCellInRect(3, 3, rect)).toBeTruthy();
	});

	it('should return false for cell outside the rect', () => {
		expect(isCellInRect(0, 0, rect)).toBeFalsy();
		expect(isCellInRect(4, 4, rect)).toBeFalsy();
	});

	it('should return false for undefined rect', () => {
		expect(isCellInRect(0, 0, undefined)).toBeFalsy();
	});

	it('should return false when row is outside but col is inside', () => {
		expect(isCellInRect(0, 2, rect)).toBeFalsy();
	});

	it('should return false when col is outside but row is inside', () => {
		expect(isCellInRect(2, 0, rect)).toBeFalsy();
	});
});
