/**
 * table-data-helpers.test.ts: Vitest unit tests for table-data-helpers.ts.
 *
 * All tests are pure (no TestBed, no Angular imports) and run in Node. They
 * verify the element-level wrappers delegate to the shared merge-AWARE table
 * transforms (so existing merge spans survive structural edits) rather than the
 * old merge-destroying behaviour.
 *
 * @module angular-viewer/table-data-helpers.test
 */

import type { PptxTableCell, TablePptxElement, XmlObject } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	insertColumn,
	insertRow,
	mergeDown,
	mergeRight,
	mergeSelection,
	patchTableData,
	removeColumn,
	removeRow,
	setCellText,
	splitCursorCell,
	splitMergedCell,
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

/** Convenience: read a cell from a table element. */
function cellAt(el: TablePptxElement, r: number, c: number): PptxTableCell | undefined {
	return el.tableData?.rows[r]?.cells[c];
}

function rawRows(el: TablePptxElement): XmlObject[] {
	return el.rawXml!['a:graphic']['a:graphicData']['a:tbl']['a:tr'] as XmlObject[];
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
		expect(cellAt(result, 0, 1)?.text).toBe('X');
	});

	it('does not mutate the original element', () => {
		const el = makeTable([['A', 'B']]);
		setCellText(el, 0, 0, 'CHANGED');
		expect(cellAt(el, 0, 0)?.text).toBe('A');
	});
});

// ---------------------------------------------------------------------------
// insertRow
// ---------------------------------------------------------------------------

describe('insertRow', () => {
	it('inserts a blank row below the reference row', () => {
		const el = makeTable([
			['A', 'B'],
			['C', 'D'],
		]);
		const result = insertRow(el, 0, 'below');
		expect(result.tableData?.rows).toHaveLength(3);
		expect(cellAt(result, 1, 0)?.text).toBe('');
	});

	it('inserts above the reference row', () => {
		const el = makeTable([['A'], ['B']]);
		const result = insertRow(el, 0, 'above');
		expect(result.tableData?.rows).toHaveLength(3);
		expect(cellAt(result, 0, 0)?.text).toBe('');
		expect(cellAt(result, 1, 0)?.text).toBe('A');
	});

	it('does not mutate the original', () => {
		const el = makeTable([['A']]);
		insertRow(el, 0, 'below');
		expect(el.tableData?.rows).toHaveLength(1);
	});

	it('preserves a vertical merge spanning the insertion point (grows rowSpan)', () => {
		// A 3-row table where col 0 is a vertical merge over rows 0-1.
		const el: TablePptxElement = {
			...makeTable([
				['A', 'B'],
				['', 'D'],
				['E', 'F'],
			]),
		};
		el.tableData!.rows[0].cells[0] = { text: 'A', rowSpan: 2 };
		el.tableData!.rows[1].cells[0] = { text: '', vMerge: true };

		// Insert a row inside the merge span (below row 0).
		const result = insertRow(el, 0, 'below');
		expect(result.tableData?.rows).toHaveLength(4);
		// The anchor's rowSpan grows to 3 rather than the merge being destroyed.
		expect(cellAt(result, 0, 0)?.rowSpan).toBe(3);
		expect(cellAt(result, 1, 0)?.vMerge).toBeTruthy();
	});

	it('keeps a shifted rich raw cell aligned with its tableData row', () => {
		const el = makeTable([
			['A', 'B'],
			['Rich text', 'D'],
		]);
		el.rawXml = {
			'a:graphic': {
				'a:graphicData': {
					'a:tbl': {
						'a:tblGrid': { 'a:gridCol': [{ '@_w': '1000' }, { '@_w': '1000' }] },
						'a:tr': [
							{
								'@_h': '370840',
								'a:tc': [
									{ 'a:txBody': { 'a:p': { 'a:r': { 'a:t': 'A' } } }, 'a:tcPr': {} },
									{ 'a:txBody': { 'a:p': { 'a:r': { 'a:t': 'B' } } }, 'a:tcPr': {} },
								],
							},
							{
								'@_h': '370840',
								'a:tc': [
									{
										'a:txBody': {
											'a:p': {
												'a:r': [
													{ 'a:rPr': { '@_b': '1' }, 'a:t': 'Rich ' },
													{ 'a:rPr': { '@_i': '1' }, 'a:t': 'text' },
												],
											},
										},
										'a:tcPr': { 'x:opaque': { '@_marker': 'survivor' } },
									},
									{ 'a:txBody': { 'a:p': { 'a:r': { 'a:t': 'D' } } }, 'a:tcPr': {} },
								],
							},
						],
					},
				},
			},
		};
		const richCell = structuredClone(rawRows(el)[1]['a:tc'][0]);

		const result = insertRow(el, 0, 'below');

		expect(cellAt(result, 2, 0)?.text).toBe('Rich text');
		expect(rawRows(result)[2]['a:tc'][0]).toStrictEqual(richCell);
		expect(rawRows(el)).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// removeRow
// ---------------------------------------------------------------------------

describe('removeRow', () => {
	it('removes the specified row', () => {
		const el = makeTable([['A'], ['B'], ['C']]);
		const result = removeRow(el, 1);
		expect(result.tableData?.rows).toHaveLength(2);
		expect(cellAt(result, 1, 0)?.text).toBe('C');
	});

	it('returns element unchanged when only one row exists', () => {
		const el = makeTable([['A']]);
		expect(removeRow(el, 0)).toBe(el);
	});
});

// ---------------------------------------------------------------------------
// insertColumn / removeColumn
// ---------------------------------------------------------------------------

describe('insertColumn', () => {
	it('inserts a blank column to the right of the reference column', () => {
		const el = makeTable([['A', 'B']]);
		const result = insertColumn(el, 0, 'right');
		expect(result.tableData?.rows[0].cells).toHaveLength(3);
		expect(cellAt(result, 0, 1)?.text).toBe('');
	});

	it('keeps column widths normalised to sum to 1', () => {
		const el = makeTable([['A', 'B']], [0.6, 0.4]);
		const result = insertColumn(el, 0, 'right');
		const total = (result.tableData?.columnWidths ?? []).reduce((s, w) => s + w, 0);
		expect(total).toBeCloseTo(1, 5);
	});
});

describe('removeColumn', () => {
	it('removes the specified column from every row', () => {
		const el = makeTable([
			['A', 'B', 'C'],
			['D', 'E', 'F'],
		]);
		const result = removeColumn(el, 1);
		expect(result.tableData?.rows[0].cells).toHaveLength(2);
		expect(cellAt(result, 0, 1)?.text).toBe('C');
	});

	it('returns element unchanged when only one column exists', () => {
		const el = makeTable([['A'], ['B']]);
		expect(removeColumn(el, 0)).toBe(el);
	});
});

// ---------------------------------------------------------------------------
// merge / split
// ---------------------------------------------------------------------------

describe('mergeSelection / splitMergedCell', () => {
	it('merges a rectangular selection into the top-left anchor', () => {
		const el = makeTable([
			['A', 'B'],
			['C', 'D'],
		]);
		const merged = mergeSelection(el, [
			{ row: 0, col: 0 },
			{ row: 1, col: 1 },
		]);
		expect(cellAt(merged, 0, 0)?.gridSpan).toBe(2);
		expect(cellAt(merged, 0, 0)?.rowSpan).toBe(2);
		expect(cellAt(merged, 0, 1)?.hMerge).toBeTruthy();
	});

	it('splits a merged anchor back into individual cells', () => {
		const el = makeTable([
			['A', 'B'],
			['C', 'D'],
		]);
		const merged = mergeSelection(el, [
			{ row: 0, col: 0 },
			{ row: 1, col: 1 },
		]);
		const split = splitMergedCell(merged, 0, 0);
		expect(cellAt(split, 0, 0)?.gridSpan).toBeUndefined();
		expect(cellAt(split, 0, 0)?.rowSpan).toBeUndefined();
		expect(cellAt(split, 0, 1)?.hMerge).toBeUndefined();
	});

	it('merges the cursor cell with its right neighbour', () => {
		const el = makeTable([['A', 'B', 'C']]);
		const result = mergeRight(el, 0, 0);
		expect(cellAt(result, 0, 0)?.gridSpan).toBe(2);
		expect(cellAt(result, 0, 1)?.hMerge).toBeTruthy();
	});

	it('keeps the anchor runs and clears absorbed runs through merge-down then split', () => {
		const el = makeTable([
			['A', 'B'],
			['C', 'D'],
		]);
		const anchorRuns = [{ text: 'A', bold: true }];
		el.tableData!.rows[0].cells[0].textRuns = anchorRuns;
		el.tableData!.rows[1].cells[0].textRuns = [{ text: 'C', italic: true }];

		const merged = mergeDown(el, 0, 0);
		expect(cellAt(merged, 0, 0)?.textRuns).toBe(anchorRuns);
		expect(cellAt(merged, 1, 0)?.textRuns).toBeUndefined();

		const split = splitCursorCell(merged, 0, 0);
		expect(cellAt(split, 0, 0)?.textRuns).toBe(anchorRuns);
		expect(cellAt(split, 1, 0)).toMatchObject({ text: '' });
		expect(cellAt(split, 1, 0)?.textRuns).toBeUndefined();
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

	it('returns element unchanged when tableData is missing', () => {
		const el: TablePptxElement = { type: 'table', id: 't', x: 0, y: 0, width: 100, height: 50 };
		expect(patchTableData(el, { bandedRows: true })).toBe(el);
	});
});
