/**
 * table-data-helpers.test.ts — Vitest unit tests for table-data-helpers.ts.
 *
 * All tests are pure (no TestBed, no Angular imports) and run in Node.
 *
 * @module angular-viewer/table-data-helpers.test
 */

import type { TablePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	addTableColumn,
	addTableRow,
	patchTableData,
	removeTableColumn,
	removeTableRow,
	setCellText,
} from './table-data-helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal TablePptxElement for testing. */
function makeTable(rows: string[][], widths?: number[]): TablePptxElement {
	const colCount = rows[0]?.length ?? 0;
	return {
		type: 'table',
		id: 'tbl-1',
		x: 0,
		y: 0,
		width: 400,
		height: 200,
		tableData: {
			columnWidths: widths ?? Array.from({ length: colCount }, () => 1 / colCount),
			rows: rows.map((cells) => ({
				cells: cells.map((text) => ({ text })),
			})),
		},
	};
}

// ---------------------------------------------------------------------------
// setCellText
// ---------------------------------------------------------------------------

describe('setCellText', () => {
	it('updates the target cell text', () => {
		const el = makeTable([
			['A', 'B'],
			['C', 'D'],
		]);
		const result = setCellText(el, 0, 1, 'X');
		expect(result.tableData?.rows[0].cells[1].text).toBe('X');
	});

	it('does not mutate the original element', () => {
		const el = makeTable([['A', 'B']]);
		setCellText(el, 0, 0, 'CHANGED');
		expect(el.tableData?.rows[0].cells[0].text).toBe('A');
	});

	it('leaves other cells unchanged', () => {
		const el = makeTable([
			['A', 'B'],
			['C', 'D'],
		]);
		const result = setCellText(el, 1, 0, 'Z');
		expect(result.tableData?.rows[0].cells[0].text).toBe('A');
		expect(result.tableData?.rows[0].cells[1].text).toBe('B');
		expect(result.tableData?.rows[1].cells[1].text).toBe('D');
	});

	it('returns element unchanged when tableData is missing', () => {
		const el: TablePptxElement = {
			type: 'table',
			id: 't',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
		};
		expect(setCellText(el, 0, 0, 'x')).toBe(el);
	});
});

// ---------------------------------------------------------------------------
// addTableRow
// ---------------------------------------------------------------------------

describe('addTableRow', () => {
	it('appends a new row after the specified index', () => {
		const el = makeTable([
			['A', 'B'],
			['C', 'D'],
		]);
		const result = addTableRow(el, 0);
		expect(result.tableData?.rows).toHaveLength(3);
		expect(result.tableData?.rows[1].cells[0].text).toBe('');
		expect(result.tableData?.rows[1].cells[1].text).toBe('');
	});

	it('inserts at the end when afterRowIndex equals last row', () => {
		const el = makeTable([['A'], ['B']]);
		const result = addTableRow(el, 1);
		expect(result.tableData?.rows).toHaveLength(3);
		expect(result.tableData?.rows[2].cells[0].text).toBe('');
	});

	it('inserts at position 0 when afterRowIndex is -1', () => {
		const el = makeTable([['A'], ['B']]);
		const result = addTableRow(el, -1);
		expect(result.tableData?.rows).toHaveLength(3);
		expect(result.tableData?.rows[0].cells[0].text).toBe('');
	});

	it('new row has correct number of cells', () => {
		const el = makeTable([['A', 'B', 'C']]);
		const result = addTableRow(el, 0);
		expect(result.tableData?.rows[1].cells).toHaveLength(3);
	});

	it('does not mutate the original', () => {
		const el = makeTable([['A']]);
		addTableRow(el, 0);
		expect(el.tableData?.rows).toHaveLength(1);
	});

	it('clears merge state on existing cells', () => {
		const el = makeTable([['A', 'B']]);
		// Manually inject merge state
		const elWithMerge: TablePptxElement = {
			...el,
			tableData: {
				...el.tableData!,
				rows: [
					{
						cells: [
							{ text: 'A', gridSpan: 2 },
							{ text: '', hMerge: true },
						],
					},
				],
			},
		};
		const result = addTableRow(elWithMerge, 0);
		expect(result.tableData?.rows[0].cells[0].gridSpan).toBeUndefined();
		expect(result.tableData?.rows[0].cells[1].hMerge).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// removeTableRow
// ---------------------------------------------------------------------------

describe('removeTableRow', () => {
	it('removes the specified row', () => {
		const el = makeTable([
			['A', 'B'],
			['C', 'D'],
			['E', 'F'],
		]);
		const result = removeTableRow(el, 1);
		expect(result.tableData?.rows).toHaveLength(2);
		expect(result.tableData?.rows[0].cells[0].text).toBe('A');
		expect(result.tableData?.rows[1].cells[0].text).toBe('E');
	});

	it('returns element unchanged when only one row exists', () => {
		const el = makeTable([['A']]);
		const result = removeTableRow(el, 0);
		expect(result).toBe(el);
	});

	it('does not mutate the original', () => {
		const el = makeTable([['A'], ['B']]);
		removeTableRow(el, 0);
		expect(el.tableData?.rows).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// addTableColumn
// ---------------------------------------------------------------------------

describe('addTableColumn', () => {
	it('inserts a blank column after the specified index', () => {
		const el = makeTable([
			['A', 'B'],
			['C', 'D'],
		]);
		const result = addTableColumn(el, 0);
		expect(result.tableData?.rows[0].cells).toHaveLength(3);
		expect(result.tableData?.rows[0].cells[1].text).toBe('');
	});

	it('appends a column when afterColIndex equals last column', () => {
		const el = makeTable([['A', 'B']]);
		const result = addTableColumn(el, 1);
		expect(result.tableData?.rows[0].cells).toHaveLength(3);
		expect(result.tableData?.rows[0].cells[2].text).toBe('');
	});

	it('inserts before all columns when afterColIndex is -1', () => {
		const el = makeTable([['A', 'B']]);
		const result = addTableColumn(el, -1);
		expect(result.tableData?.rows[0].cells[0].text).toBe('');
		expect(result.tableData?.rows[0].cells[1].text).toBe('A');
	});

	it('renormalises column widths to sum to 1', () => {
		const el = makeTable([['A', 'B']], [0.6, 0.4]);
		const result = addTableColumn(el, 0);
		const widths = result.tableData?.columnWidths ?? [];
		const total = widths.reduce((s, w) => s + w, 0);
		expect(total).toBeCloseTo(1, 5);
		expect(widths).toHaveLength(3);
	});

	it('does not mutate the original', () => {
		const el = makeTable([['A', 'B']]);
		addTableColumn(el, 0);
		expect(el.tableData?.rows[0].cells).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// removeTableColumn
// ---------------------------------------------------------------------------

describe('removeTableColumn', () => {
	it('removes the specified column from every row', () => {
		const el = makeTable([
			['A', 'B', 'C'],
			['D', 'E', 'F'],
		]);
		const result = removeTableColumn(el, 1);
		expect(result.tableData?.rows[0].cells).toHaveLength(2);
		expect(result.tableData?.rows[0].cells[0].text).toBe('A');
		expect(result.tableData?.rows[0].cells[1].text).toBe('C');
	});

	it('returns element unchanged when only one column exists', () => {
		const el = makeTable([['A'], ['B']]);
		const result = removeTableColumn(el, 0);
		expect(result).toBe(el);
	});

	it('renormalises column widths after removal', () => {
		const el = makeTable([['A', 'B', 'C']], [0.2, 0.5, 0.3]);
		const result = removeTableColumn(el, 1);
		const widths = result.tableData?.columnWidths ?? [];
		const total = widths.reduce((s, w) => s + w, 0);
		expect(total).toBeCloseTo(1, 5);
		expect(widths).toHaveLength(2);
	});

	it('does not mutate the original', () => {
		const el = makeTable([['A', 'B']]);
		removeTableColumn(el, 0);
		expect(el.tableData?.rows[0].cells).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// patchTableData
// ---------------------------------------------------------------------------

describe('patchTableData', () => {
	it('merges the patch into tableData', () => {
		const el = makeTable([['A']]);
		const result = patchTableData(el, { bandedRows: true, firstRowHeader: true });
		expect(result.tableData?.bandedRows).toBeTruthy();
		expect(result.tableData?.firstRowHeader).toBeTruthy();
	});

	it('preserves existing tableData fields not in patch', () => {
		const el = makeTable([['A', 'B']], [0.5, 0.5]);
		const result = patchTableData(el, { bandedRows: false });
		expect(result.tableData?.columnWidths).toStrictEqual([0.5, 0.5]);
		expect(result.tableData?.rows).toHaveLength(1);
	});

	it('returns element unchanged when tableData is missing', () => {
		const el: TablePptxElement = { type: 'table', id: 't', x: 0, y: 0, width: 100, height: 50 };
		expect(patchTableData(el, { bandedRows: true })).toBe(el);
	});

	it('does not mutate the original', () => {
		const el = makeTable([['A']]);
		patchTableData(el, { bandedRows: true });
		expect(el.tableData?.bandedRows).toBeUndefined();
	});
});
