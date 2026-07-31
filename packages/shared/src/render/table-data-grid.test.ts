import type { TablePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildTableDataGrid } from './table-data-grid';
import {
	appendTableElementColumn,
	appendTableElementRow,
	setTableElementCellText,
	insertTableElementColumn,
	insertTableElementRow,
	removeLastTableElementColumn,
	removeLastTableElementRow,
	removeTableElementColumn,
	removeTableElementRow,
} from './table-data-grid-ops';

function makeTable(): TablePptxElement {
	return {
		id: 't1',
		type: 'table',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		tableData: {
			columnWidths: [0.5, 0.5],
			rows: [{ cells: [{ text: 'a' }, { text: 'b' }] }, { cells: [{ text: 'c' }, { text: 'd' }] }],
		},
	} as unknown as TablePptxElement;
}

function makeEmptyTable(): TablePptxElement {
	return {
		id: 't0',
		type: 'table',
		x: 0,
		y: 0,
		width: 1,
		height: 1,
	} as unknown as TablePptxElement;
}

describe('buildTableDataGrid', () => {
	it('reports counts, column indices and cell coordinates', () => {
		const grid = buildTableDataGrid(makeTable());
		expect(grid.rowCount).toBe(2);
		expect(grid.colCount).toBe(2);
		expect(grid.colIndices).toStrictEqual([0, 1]);
		expect(grid.rows[1].cells[0]).toStrictEqual({ rowIndex: 1, colIndex: 0, text: 'c' });
	});

	it('normalises ragged rows to the column count so no cell is dropped', () => {
		const el = makeTable();
		// A short row: 3 columns declared but only 1 cell present.
		el.tableData!.columnWidths = [0.3, 0.3, 0.4];
		el.tableData!.rows[0] = { cells: [{ text: 'only' }] } as never;

		const grid = buildTableDataGrid(el);
		expect(grid.colCount).toBe(3);
		expect(grid.rows[0].cells).toHaveLength(3);
		expect(grid.rows[0].cells.map((c) => c.text)).toStrictEqual(['only', '', '']);
	});

	it('blocks removal when only one row or column remains', () => {
		const el = makeTable();
		el.tableData!.rows = [el.tableData!.rows[0]];
		el.tableData!.columnWidths = [1];
		const grid = buildTableDataGrid(el);
		expect(grid.canRemoveRow).toBeFalsy();
		expect(grid.canRemoveColumn).toBeFalsy();
	});

	it('yields an empty model for an element with no table data', () => {
		const grid = buildTableDataGrid(makeEmptyTable());
		expect(grid).toStrictEqual({
			rowCount: 0,
			colCount: 0,
			colIndices: [],
			rows: [],
			canRemoveRow: false,
			canRemoveColumn: false,
		});
	});
});

describe('element-level row/column operations', () => {
	it('inserts a row below without mutating the source', () => {
		const el = makeTable();
		const next = insertTableElementRow(el, 0, 'below');
		expect(next.tableData?.rows).toHaveLength(3);
		expect(next.tableData?.rows[0].cells[0].text).toBe('a');
		expect(next.tableData?.rows[1].cells[0].text).toBe('');
		expect(el.tableData?.rows).toHaveLength(2);
		expect(next).not.toBe(el);
	});

	it('inserts a column to the right', () => {
		const el = makeTable();
		const next = insertTableElementColumn(el, 1, 'right');
		expect(next.tableData?.columnWidths).toHaveLength(3);
		expect(buildTableDataGrid(next).rows[0].cells.map((c) => c.text)).toStrictEqual(['a', 'b', '']);
	});

	it('removes the targeted row and column', () => {
		const el = makeTable();
		expect(removeTableElementRow(el, 0).tableData?.rows[0].cells[0].text).toBe('c');
		expect(
			buildTableDataGrid(removeTableElementColumn(el, 0)).rows[0].cells.map((c) => c.text),
		).toStrictEqual(['b']);
	});
});

describe('append / remove-last helpers', () => {
	it('appends a trailing row and column', () => {
		const el = makeTable();
		expect(appendTableElementRow(el).tableData?.rows).toHaveLength(3);
		expect(appendTableElementColumn(el).tableData?.columnWidths).toHaveLength(3);
	});

	it('removes the trailing row and column', () => {
		const el = makeTable();
		const fewerRows = removeLastTableElementRow(el);
		expect(fewerRows.tableData?.rows).toHaveLength(1);
		expect(fewerRows.tableData?.rows[0].cells[0].text).toBe('a');

		const fewerCols = removeLastTableElementColumn(el);
		expect(buildTableDataGrid(fewerCols).rows[0].cells.map((c) => c.text)).toStrictEqual(['a']);
	});

	it('refuses to empty the table', () => {
		const el = makeTable();
		el.tableData!.rows = [el.tableData!.rows[0]];
		el.tableData!.columnWidths = [1];
		expect(removeLastTableElementRow(el)).toBe(el);
		expect(removeLastTableElementColumn(el)).toBe(el);
	});

	it('is a no-op on an element with no table data', () => {
		const el = makeEmptyTable();
		expect(appendTableElementRow(el)).toBe(el);
		expect(appendTableElementColumn(el)).toBe(el);
		expect(removeLastTableElementRow(el)).toBe(el);
		expect(removeLastTableElementColumn(el)).toBe(el);
	});
});

// ---------------------------------------------------------------------------
// rawXml synchronisation
// ---------------------------------------------------------------------------

/**
 * A table as parsed from a real `.pptx`: the graphic-frame markup in `rawXml` is
 * what the renderers and the save writer actually read, with `tableData` as the
 * parallel logical model.
 */
function makeXmlTable(): TablePptxElement {
	const cell = (text: string) => ({ 'a:txBody': { 'a:p': { 'a:r': { 'a:t': text } } } });
	return {
		id: 'x1',
		type: 'table',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		tableData: {
			columnWidths: [0.5, 0.5],
			rows: [{ cells: [{ text: 'a' }, { text: 'b' }] }, { cells: [{ text: 'c' }, { text: 'd' }] }],
		},
		rawXml: {
			'a:graphic': {
				'a:graphicData': {
					'a:tbl': {
						'a:tblGrid': { 'a:gridCol': [{ '@_w': '1000' }, { '@_w': '1000' }] },
						'a:tr': [
							{ '@_h': '370840', 'a:tc': [cell('a'), cell('b')] },
							{ '@_h': '370840', 'a:tc': [cell('c'), cell('d')] },
						],
					},
				},
			},
		},
	} as unknown as TablePptxElement;
}

function xmlRows(element: TablePptxElement): unknown[] {
	const raw = element.rawXml as Record<string, never> | undefined;
	const tbl = (raw?.['a:graphic'] as never as Record<string, never>)?.['a:graphicData']?.[
		'a:tbl'
	] as Record<string, unknown>;
	const rows = tbl['a:tr'];
	return Array.isArray(rows) ? rows : [rows];
}

describe('rawXml synchronisation', () => {
	// A tableData-only patch is invisible: both the renderers and the save
	// writer read rawXml in preference, so without this the panel would appear
	// to work and silently discard every edit.
	it('rewrites the cell text inside rawXml, not just tableData', () => {
		const next = setTableElementCellText(makeXmlTable(), 0, 1, 'B!');

		expect(next.tableData?.rows[0].cells[1].text).toBe('B!');
		expect(JSON.stringify(next.rawXml)).toContain('B!');
		expect(next.rawXml).not.toBe(makeXmlTable().rawXml);
	});

	it('rebuilds rawXml rows when a row is appended or removed', () => {
		const source = makeXmlTable();
		expect(xmlRows(source)).toHaveLength(2);

		expect(xmlRows(appendTableElementRow(source))).toHaveLength(3);
		expect(xmlRows(removeLastTableElementRow(source))).toHaveLength(1);
		// The source element is never mutated.
		expect(xmlRows(source)).toHaveLength(2);
	});

	it('rebuilds the rawXml grid when a column is appended or removed', () => {
		const source = makeXmlTable();
		const widened = appendTableElementColumn(source);
		const raw = widened.rawXml as never as Record<string, Record<string, Record<string, never>>>;
		const grid = raw['a:graphic']['a:graphicData']['a:tbl'] as unknown as Record<string, never>;
		const cols = (grid['a:tblGrid'] as Record<string, unknown>)['a:gridCol'];

		expect(Array.isArray(cols) ? cols : [cols]).toHaveLength(3);
		expect(widened.tableData?.columnWidths).toHaveLength(3);
	});

	it('leaves a tableData-only table (Insert > Table) working without rawXml', () => {
		const plain = makeTable();
		const next = setTableElementCellText(plain, 0, 0, 'Z');

		expect(next.tableData?.rows[0].cells[0].text).toBe('Z');
		expect(next.rawXml).toBeUndefined();
	});
});
