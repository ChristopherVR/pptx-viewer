import type { PptxTableData, TablePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	applyDeleteColumn,
	applyDeleteRow,
	applyInsertColumn,
	applyInsertRow,
	applyMergeDown,
	applyMergeRight,
	applyMergeSelected,
	applySplitCell,
} from './table-mutations';

function makeTableData(rows: number, cols: number): PptxTableData {
	return {
		rows: Array.from({ length: rows }, (_r, r) => ({
			cells: Array.from({ length: cols }, (_c, c) => ({ text: `r${r}c${c}` })),
		})),
		columnWidths: Array.from({ length: cols }, () => 1 / cols),
	};
}

function makeTableElement(rows: number, cols: number): TablePptxElement {
	return {
		type: 'table',
		id: 'table-1',
		x: 0,
		y: 0,
		width: 400,
		height: 200,
		tableData: makeTableData(rows, cols),
	};
}

describe('table-mutations', () => {
	it('inserts a row above the target index', () => {
		const next = applyInsertRow(makeTableElement(2, 2), 0, 'above');
		expect(next.tableData?.rows).toHaveLength(3);
		expect(next.tableData?.rows[0].cells.every((c) => c.text === '')).toBeTruthy();
	});

	it('inserts a row below the target index', () => {
		const next = applyInsertRow(makeTableElement(2, 2), 0, 'below');
		expect(next.tableData?.rows).toHaveLength(3);
		expect(next.tableData?.rows[1].cells.every((c) => c.text === '')).toBeTruthy();
	});

	it('deletes a row and returns null on a single-row no-op', () => {
		expect(applyDeleteRow(makeTableElement(2, 2), 0)?.tableData?.rows).toHaveLength(1);
		expect(applyDeleteRow(makeTableElement(1, 2), 0)).toBeNull();
	});

	it('inserts a column keeping widths normalised', () => {
		const next = applyInsertColumn(makeTableElement(2, 2), 0, 'right');
		expect(next.tableData?.columnWidths).toHaveLength(3);
		expect(next.tableData?.rows[0].cells).toHaveLength(3);
		expect(next.tableData?.columnWidths.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
	});

	it('deletes a column and returns null on a single-column no-op', () => {
		expect(applyDeleteColumn(makeTableElement(2, 2), 0)?.tableData?.columnWidths).toHaveLength(1);
		expect(applyDeleteColumn(makeTableElement(2, 1), 0)).toBeNull();
	});

	it('merges the cell to the right (gridSpan + hMerge)', () => {
		const next = applyMergeRight(makeTableData(2, 3), 0, 0);
		expect(next).not.toBeNull();
		expect(next!.rows[0].cells[0].gridSpan).toBe(2);
		expect(next!.rows[0].cells[1].hMerge).toBeTruthy();
	});

	it('merges the cell below (rowSpan + vMerge)', () => {
		const next = applyMergeDown(makeTableData(3, 2), 0, 0);
		expect(next).not.toBeNull();
		expect(next!.rows[0].cells[0].rowSpan).toBe(2);
		expect(next!.rows[1].cells[0].vMerge).toBeTruthy();
	});

	it('splits a previously merged cell', () => {
		const merged = applyMergeRight(makeTableData(2, 3), 0, 0);
		const split = applySplitCell(merged!, 0, 0);
		expect(split).not.toBeNull();
		expect(split!.rows[0].cells[0].gridSpan).toBeUndefined();
		expect(split!.rows[0].cells[1].hMerge).toBeUndefined();
	});

	it('keeps the anchor runs and clears absorbed runs through merge-down then split', () => {
		const table = makeTableData(2, 2);
		const anchorRuns = [{ text: 'r0c0', bold: true }];
		table.rows[0].cells[0].textRuns = anchorRuns;
		table.rows[1].cells[0].textRuns = [{ text: 'r1c0', italic: true }];

		const merged = applyMergeDown(table, 0, 0)!;
		expect(merged.rows[0].cells[0].textRuns).toBe(anchorRuns);
		expect(merged.rows[1].cells[0].textRuns).toBeUndefined();

		const split = applySplitCell(merged, 0, 0)!;
		expect(split.rows[0].cells[0].textRuns).toBe(anchorRuns);
		expect(split.rows[1].cells[0]).toMatchObject({ text: '' });
		expect(split.rows[1].cells[0].textRuns).toBeUndefined();
	});

	it('returns null when splitting an unmerged cell', () => {
		expect(applySplitCell(makeTableData(2, 2), 0, 0)).toBeNull();
	});

	it('merges a rectangular multi-cell selection', () => {
		const cells = [
			{ row: 0, col: 0 },
			{ row: 0, col: 1 },
			{ row: 1, col: 0 },
			{ row: 1, col: 1 },
		];
		const next = applyMergeSelected(makeTableData(2, 2), cells);
		expect(next).not.toBeNull();
		expect(next!.rows[0].cells[0].gridSpan).toBe(2);
		expect(next!.rows[0].cells[0].rowSpan).toBe(2);
	});

	it('returns null for an unmergeable selection (fewer than 2 cells)', () => {
		expect(applyMergeSelected(makeTableData(2, 2), [{ row: 0, col: 0 }])).toBeNull();
		expect(applyMergeSelected(makeTableData(2, 2), undefined)).toBeNull();
	});
});
