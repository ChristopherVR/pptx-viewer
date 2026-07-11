import type { PptxElement, PptxTableData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	applyUniformCellPaddingPatch,
	tableInspectorPatch,
	tableInspectorStateOf,
} from './table-inspector';

function tableData(overrides: Partial<PptxTableData> = {}): PptxTableData {
	return {
		rows: [{ cells: [{ text: 'A' }, { text: 'B' }] }, { cells: [{ text: 'C' }, { text: 'D' }] }],
		columnWidths: [0.5, 0.5],
		...overrides,
	};
}

function table(data?: PptxTableData): PptxElement {
	return {
		type: 'table',
		id: 'tbl1',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		tableData: data,
	} as PptxElement;
}

function shape(): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		shapeType: 'rect',
	} as PptxElement;
}

describe('tableInspectorStateOf', () => {
	it('defaults flags to false and padding to 0 for a table with no data', () => {
		expect(tableInspectorStateOf(table(undefined))).toStrictEqual({
			firstRowHeader: false,
			bandedRows: false,
			bandedColumns: false,
			cellPadding: 0,
		});
	});

	it('reads the flags and the first cell padding', () => {
		const data = tableData({
			firstRowHeader: true,
			bandedRows: true,
			rows: [{ cells: [{ text: 'A', style: { marginLeft: 8 } }] }],
		});
		expect(tableInspectorStateOf(table(data))).toStrictEqual({
			firstRowHeader: true,
			bandedRows: true,
			bandedColumns: false,
			cellPadding: 8,
		});
	});

	it('defaults for non-table elements', () => {
		expect(tableInspectorStateOf(shape())).toStrictEqual({
			firstRowHeader: false,
			bandedRows: false,
			bandedColumns: false,
			cellPadding: 0,
		});
	});
});

describe('tableInspectorPatch', () => {
	it('merges flag changes into the existing tableData', () => {
		const data = tableData({ bandedRows: true });
		const patch = tableInspectorPatch(table(data), { firstRowHeader: true });
		expect(patch).toStrictEqual({ tableData: { ...data, firstRowHeader: true } });
	});

	it('is a no-op when the table has no data', () => {
		expect(tableInspectorPatch(table(undefined), { firstRowHeader: true })).toStrictEqual({});
	});

	it('is a no-op for non-table elements', () => {
		expect(tableInspectorPatch(shape(), { firstRowHeader: true })).toStrictEqual({});
	});
});

describe('applyUniformCellPaddingPatch', () => {
	it('sets the same margin on every cell of every row', () => {
		const data = tableData();
		const patch = applyUniformCellPaddingPatch(table(data), 12);
		const result = (patch.tableData as PptxTableData).rows;
		for (const row of result) {
			for (const cell of row.cells) {
				expect(cell.style).toStrictEqual({
					marginLeft: 12,
					marginRight: 12,
					marginTop: 12,
					marginBottom: 12,
				});
			}
		}
	});

	it('clamps negative padding to 0 and rounds fractional values', () => {
		const data = tableData({ rows: [{ cells: [{ text: 'A' }] }] });
		const patch = applyUniformCellPaddingPatch(table(data), -5.6);
		expect((patch.tableData as PptxTableData).rows[0]?.cells[0]?.style?.marginLeft).toBe(0);

		const patch2 = applyUniformCellPaddingPatch(table(data), 4.6);
		expect((patch2.tableData as PptxTableData).rows[0]?.cells[0]?.style?.marginLeft).toBe(5);
	});

	it('preserves other per-cell style fields', () => {
		const data = tableData({
			rows: [{ cells: [{ text: 'A', style: { bold: true, backgroundColor: '#fff' } }] }],
		});
		const patch = applyUniformCellPaddingPatch(table(data), 6);
		expect((patch.tableData as PptxTableData).rows[0]?.cells[0]?.style).toStrictEqual({
			bold: true,
			backgroundColor: '#fff',
			marginLeft: 6,
			marginRight: 6,
			marginTop: 6,
			marginBottom: 6,
		});
	});

	it('is a no-op for non-table elements', () => {
		expect(applyUniformCellPaddingPatch(shape(), 6)).toStrictEqual({});
	});
});
