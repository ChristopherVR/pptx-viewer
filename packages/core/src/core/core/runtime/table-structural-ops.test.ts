import { describe, it, expect } from 'vitest';
import type { PptxTableData, XmlObject } from '../../types';
import {
	addTableRow,
	removeTableRow,
	addTableColumn,
	removeTableColumn,
	rebuildTableXmlFromData,
} from './table-structural-ops';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureArray(value: unknown): unknown[] {
	if (!value) return [];
	return Array.isArray(value) ? value : [value];
}

/** Create a simple 2x3 table data (2 rows, 3 columns). */
function make2x3TableData(): PptxTableData {
	return {
		rows: [
			{
				height: 40,
				cells: [
					{ text: 'A1' },
					{ text: 'B1' },
					{ text: 'C1' },
				],
			},
			{
				height: 40,
				cells: [
					{ text: 'A2' },
					{ text: 'B2' },
					{ text: 'C2' },
				],
			},
		],
		columnWidths: [1 / 3, 1 / 3, 1 / 3],
	};
}

/** Create raw XML for a 2x3 table. */
function make2x3RawXml(): XmlObject {
	return {
		'a:graphic': {
			'a:graphicData': {
				'a:tbl': {
					'a:tblPr': {},
					'a:tblGrid': {
						'a:gridCol': [
							{ '@_w': '3048000' },
							{ '@_w': '3048000' },
							{ '@_w': '3048000' },
						],
					},
					'a:tr': [
						{
							'@_h': '381000',
							'a:tc': [
								makeTc('A1'),
								makeTc('B1'),
								makeTc('C1'),
							],
						},
						{
							'@_h': '381000',
							'a:tc': [
								makeTc('A2'),
								makeTc('B2'),
								makeTc('C2'),
							],
						},
					],
				},
			},
		},
	};
}

/** Create a simple table cell XML element. */
function makeTc(text: string, attrs?: Record<string, string>): XmlObject {
	const tc: XmlObject = {
		'a:txBody': {
			'a:bodyPr': {},
			'a:lstStyle': {},
			'a:p': {
				'a:r': { 'a:t': text },
			},
		},
		'a:tcPr': {},
	};
	if (attrs) {
		for (const [k, v] of Object.entries(attrs)) {
			tc[k] = v;
		}
	}
	return tc;
}

/** Get the table node from raw XML. */
function getTbl(rawXml: XmlObject): XmlObject {
	return (rawXml['a:graphic'] as XmlObject)['a:graphicData']['a:tbl'] as XmlObject;
}

/** Get cells from a row in the table XML. */
function getXmlCells(tbl: XmlObject, rowIdx: number): XmlObject[] {
	const rows = ensureArray(tbl['a:tr']) as XmlObject[];
	return ensureArray(rows[rowIdx]?.['a:tc']) as XmlObject[];
}

/** Get grid columns from table XML. */
function getGridCols(tbl: XmlObject): XmlObject[] {
	return ensureArray(
		(tbl['a:tblGrid'] as XmlObject)?.['a:gridCol'],
	) as XmlObject[];
}

// ===========================================================================
// Add Row
// ===========================================================================

describe('addTableRow', () => {
	it('should add a row at index 0 (above first row)', () => {
		const td = make2x3TableData();
		const result = addTableRow(td, 0);
		expect(result.tableData.rows).toHaveLength(3);
		expect(result.tableData.rows[0].cells).toHaveLength(3);
		expect(result.tableData.rows[0].cells[0].text).toBe('');
		expect(result.tableData.rows[1].cells[0].text).toBe('A1');
		expect(result.tableData.rows[2].cells[0].text).toBe('A2');
	});

	it('should add a row at the end', () => {
		const td = make2x3TableData();
		const result = addTableRow(td, 2);
		expect(result.tableData.rows).toHaveLength(3);
		expect(result.tableData.rows[2].cells[0].text).toBe('');
		expect(result.tableData.rows[2].cells).toHaveLength(3);
	});

	it('should add a row in the middle', () => {
		const td = make2x3TableData();
		const result = addTableRow(td, 1);
		expect(result.tableData.rows).toHaveLength(3);
		expect(result.tableData.rows[0].cells[0].text).toBe('A1');
		expect(result.tableData.rows[1].cells[0].text).toBe('');
		expect(result.tableData.rows[2].cells[0].text).toBe('A2');
	});

	it('should update rawXml when provided', () => {
		const td = make2x3TableData();
		const rawXml = make2x3RawXml();
		const result = addTableRow(td, 1, rawXml);
		expect(result.rawXml).toBeDefined();
		const tbl = getTbl(result.rawXml!);
		const rows = ensureArray(tbl['a:tr']) as XmlObject[];
		expect(rows).toHaveLength(3);
		// New row should have 3 cells
		const newRowCells = getXmlCells(tbl, 1);
		expect(newRowCells).toHaveLength(3);
	});

	it('should handle insertion inside a vertical merge', () => {
		const td: PptxTableData = {
			rows: [
				{
					height: 40,
					cells: [
						{ text: 'Merged', rowSpan: 3 },
						{ text: 'B1' },
					],
				},
				{
					height: 40,
					cells: [{ text: '', vMerge: true }, { text: 'B2' }],
				},
				{
					height: 40,
					cells: [{ text: '', vMerge: true }, { text: 'B3' }],
				},
			],
			columnWidths: [0.5, 0.5],
		};

		// Insert between row 0 and row 1 (inside the merge)
		const result = addTableRow(td, 1);
		expect(result.tableData.rows).toHaveLength(4);
		// Anchor cell should now have rowSpan 4
		expect(result.tableData.rows[0].cells[0].rowSpan).toBe(4);
		// New row's first cell should be vMerge
		expect(result.tableData.rows[1].cells[0].vMerge).toBe(true);
		// New row's second cell should be normal
		expect(result.tableData.rows[1].cells[1].text).toBe('');
		expect(result.tableData.rows[1].cells[1].vMerge).toBeUndefined();
	});

	it('should clamp index to valid range', () => {
		const td = make2x3TableData();
		const result = addTableRow(td, 100);
		expect(result.tableData.rows).toHaveLength(3);
		expect(result.tableData.rows[2].cells[0].text).toBe('');
	});
});

// ===========================================================================
// Remove Row
// ===========================================================================

describe('removeTableRow', () => {
	it('should remove a row at index 0', () => {
		const td = make2x3TableData();
		const result = removeTableRow(td, 0);
		expect(result.tableData.rows).toHaveLength(1);
		expect(result.tableData.rows[0].cells[0].text).toBe('A2');
	});

	it('should remove the last row', () => {
		const td = make2x3TableData();
		const result = removeTableRow(td, 1);
		expect(result.tableData.rows).toHaveLength(1);
		expect(result.tableData.rows[0].cells[0].text).toBe('A1');
	});

	it('should not remove if only one row remains', () => {
		const td: PptxTableData = {
			rows: [{ height: 40, cells: [{ text: 'only' }] }],
			columnWidths: [1],
		};
		const result = removeTableRow(td, 0);
		expect(result.tableData.rows).toHaveLength(1);
	});

	it('should not remove if index is out of range', () => {
		const td = make2x3TableData();
		const result = removeTableRow(td, 5);
		expect(result.tableData.rows).toHaveLength(2);
	});

	it('should update rawXml when provided', () => {
		const td = make2x3TableData();
		const rawXml = make2x3RawXml();
		const result = removeTableRow(td, 0, rawXml);
		expect(result.rawXml).toBeDefined();
		const tbl = getTbl(result.rawXml!);
		const rows = ensureArray(tbl['a:tr']);
		expect(rows).toHaveLength(1);
	});

	it('should handle removing a row with vertical merge anchor', () => {
		const td: PptxTableData = {
			rows: [
				{
					height: 40,
					cells: [
						{ text: 'Anchor', rowSpan: 2 },
						{ text: 'B1' },
					],
				},
				{
					height: 40,
					cells: [{ text: '', vMerge: true }, { text: 'B2' }],
				},
				{
					height: 40,
					cells: [{ text: 'A3' }, { text: 'B3' }],
				},
			],
			columnWidths: [0.5, 0.5],
		};

		// Remove row 0 (the anchor of the vertical merge)
		const result = removeTableRow(td, 0);
		expect(result.tableData.rows).toHaveLength(2);
		// The text should have moved to the new anchor (previously row 1)
		expect(result.tableData.rows[0].cells[0].text).toBe('Anchor');
		// The vMerge should be cleared
		expect(result.tableData.rows[0].cells[0].vMerge).toBeUndefined();
		// rowSpan should be removed since it was 2-1=1
		expect(result.tableData.rows[0].cells[0].rowSpan).toBeUndefined();
	});

	it('should handle removing a row with vMerge continuation', () => {
		const td: PptxTableData = {
			rows: [
				{
					height: 40,
					cells: [
						{ text: 'Anchor', rowSpan: 3 },
						{ text: 'B1' },
					],
				},
				{
					height: 40,
					cells: [{ text: '', vMerge: true }, { text: 'B2' }],
				},
				{
					height: 40,
					cells: [{ text: '', vMerge: true }, { text: 'B3' }],
				},
			],
			columnWidths: [0.5, 0.5],
		};

		// Remove row 1 (a continuation row)
		const result = removeTableRow(td, 1);
		expect(result.tableData.rows).toHaveLength(2);
		// Anchor rowSpan should decrease from 3 to 2
		expect(result.tableData.rows[0].cells[0].rowSpan).toBe(2);
		expect(result.tableData.rows[0].cells[0].text).toBe('Anchor');
	});
});

// ===========================================================================
// Add Column
// ===========================================================================

describe('addTableColumn', () => {
	it('should add a column at index 0 (left of first column)', () => {
		const td = make2x3TableData();
		const result = addTableColumn(td, 0);
		expect(result.tableData.columnWidths).toHaveLength(4);
		expect(result.tableData.rows[0].cells).toHaveLength(4);
		expect(result.tableData.rows[0].cells[0].text).toBe('');
		expect(result.tableData.rows[0].cells[1].text).toBe('A1');
	});

	it('should add a column at the end', () => {
		const td = make2x3TableData();
		const result = addTableColumn(td, 3);
		expect(result.tableData.columnWidths).toHaveLength(4);
		expect(result.tableData.rows[0].cells).toHaveLength(4);
		expect(result.tableData.rows[0].cells[3].text).toBe('');
	});

	it('should add a column in the middle', () => {
		const td = make2x3TableData();
		const result = addTableColumn(td, 1);
		expect(result.tableData.columnWidths).toHaveLength(4);
		expect(result.tableData.rows[0].cells[0].text).toBe('A1');
		expect(result.tableData.rows[0].cells[1].text).toBe('');
		expect(result.tableData.rows[0].cells[2].text).toBe('B1');
	});

	it('should normalize column widths to sum to ~1', () => {
		const td = make2x3TableData();
		const result = addTableColumn(td, 1);
		const sum = result.tableData.columnWidths.reduce((a, b) => a + b, 0);
		expect(sum).toBeCloseTo(1, 5);
	});

	it('should update rawXml when provided', () => {
		const td = make2x3TableData();
		const rawXml = make2x3RawXml();
		const result = addTableColumn(td, 1, rawXml);
		expect(result.rawXml).toBeDefined();
		const tbl = getTbl(result.rawXml!);
		const gridCols = getGridCols(tbl);
		expect(gridCols).toHaveLength(4);
		// Each row should have 4 cells
		const rows = ensureArray(tbl['a:tr']) as XmlObject[];
		for (const row of rows) {
			const cells = ensureArray(row['a:tc']);
			expect(cells).toHaveLength(4);
		}
	});

	it('should handle insertion inside a horizontal merge', () => {
		const td: PptxTableData = {
			rows: [
				{
					height: 40,
					cells: [
						{ text: 'Merged', gridSpan: 3 },
						{ text: '', hMerge: true },
						{ text: '', hMerge: true },
					],
				},
				{
					height: 40,
					cells: [{ text: 'A2' }, { text: 'B2' }, { text: 'C2' }],
				},
			],
			columnWidths: [1 / 3, 1 / 3, 1 / 3],
		};

		// Insert column at index 1 (inside the merge of row 0)
		const result = addTableColumn(td, 1);
		expect(result.tableData.rows[0].cells).toHaveLength(4);
		// Anchor's gridSpan should increase to 4
		expect(result.tableData.rows[0].cells[0].gridSpan).toBe(4);
		// New cell should be hMerge continuation
		expect(result.tableData.rows[0].cells[1].hMerge).toBe(true);
		// Row 1 cells should be normal
		expect(result.tableData.rows[1].cells[1].text).toBe('');
		expect(result.tableData.rows[1].cells[1].hMerge).toBeUndefined();
	});

	it('should preserve gridCol widths summing to the original total in XML', () => {
		const td = make2x3TableData();
		const rawXml = make2x3RawXml();
		const result = addTableColumn(td, 1, rawXml);
		const tbl = getTbl(result.rawXml!);
		const gridCols = getGridCols(tbl);
		const totalWidth = gridCols.reduce(
			(sum, col) => sum + parseInt(String(col['@_w']), 10),
			0,
		);
		// Original total was 3 * 3048000 = 9144000
		expect(totalWidth).toBe(9144000);
	});
});

// ===========================================================================
// Remove Column
// ===========================================================================

describe('removeTableColumn', () => {
	it('should remove the first column', () => {
		const td = make2x3TableData();
		const result = removeTableColumn(td, 0);
		expect(result.tableData.columnWidths).toHaveLength(2);
		expect(result.tableData.rows[0].cells).toHaveLength(2);
		expect(result.tableData.rows[0].cells[0].text).toBe('B1');
	});

	it('should remove the last column', () => {
		const td = make2x3TableData();
		const result = removeTableColumn(td, 2);
		expect(result.tableData.columnWidths).toHaveLength(2);
		expect(result.tableData.rows[0].cells[0].text).toBe('A1');
		expect(result.tableData.rows[0].cells[1].text).toBe('B1');
	});

	it('should remove a middle column', () => {
		const td = make2x3TableData();
		const result = removeTableColumn(td, 1);
		expect(result.tableData.columnWidths).toHaveLength(2);
		expect(result.tableData.rows[0].cells[0].text).toBe('A1');
		expect(result.tableData.rows[0].cells[1].text).toBe('C1');
	});

	it('should not remove if only one column remains', () => {
		const td: PptxTableData = {
			rows: [{ height: 40, cells: [{ text: 'only' }] }],
			columnWidths: [1],
		};
		const result = removeTableColumn(td, 0);
		expect(result.tableData.columnWidths).toHaveLength(1);
	});

	it('should normalize widths to sum to ~1', () => {
		const td = make2x3TableData();
		const result = removeTableColumn(td, 1);
		const sum = result.tableData.columnWidths.reduce((a, b) => a + b, 0);
		expect(sum).toBeCloseTo(1, 5);
	});

	it('should update rawXml when provided', () => {
		const td = make2x3TableData();
		const rawXml = make2x3RawXml();
		const result = removeTableColumn(td, 1, rawXml);
		expect(result.rawXml).toBeDefined();
		const tbl = getTbl(result.rawXml!);
		const gridCols = getGridCols(tbl);
		expect(gridCols).toHaveLength(2);
		const rows = ensureArray(tbl['a:tr']) as XmlObject[];
		for (const row of rows) {
			const cells = ensureArray(row['a:tc']);
			expect(cells).toHaveLength(2);
		}
	});

	it('should handle removing the anchor of a horizontal merge', () => {
		const td: PptxTableData = {
			rows: [
				{
					height: 40,
					cells: [
						{ text: 'Anchor', gridSpan: 2 },
						{ text: '', hMerge: true },
						{ text: 'C1' },
					],
				},
				{
					height: 40,
					cells: [{ text: 'A2' }, { text: 'B2' }, { text: 'C2' }],
				},
			],
			columnWidths: [1 / 3, 1 / 3, 1 / 3],
		};

		// Remove column 0 (the anchor)
		const result = removeTableColumn(td, 0);
		expect(result.tableData.rows[0].cells).toHaveLength(2);
		// The former hMerge continuation should become a normal cell
		expect(result.tableData.rows[0].cells[0].hMerge).toBeUndefined();
		// The text should have moved from the anchor
		expect(result.tableData.rows[0].cells[0].text).toBe('Anchor');
		// gridSpan should be cleared (was 2-1=1)
		expect(result.tableData.rows[0].cells[0].gridSpan).toBeUndefined();
	});

	it('should handle removing a hMerge continuation cell', () => {
		const td: PptxTableData = {
			rows: [
				{
					height: 40,
					cells: [
						{ text: 'Anchor', gridSpan: 3 },
						{ text: '', hMerge: true },
						{ text: '', hMerge: true },
					],
				},
			],
			columnWidths: [1 / 3, 1 / 3, 1 / 3],
		};

		// Remove column 1 (a continuation)
		const result = removeTableColumn(td, 1);
		expect(result.tableData.rows[0].cells).toHaveLength(2);
		// Anchor gridSpan should decrease from 3 to 2
		expect(result.tableData.rows[0].cells[0].gridSpan).toBe(2);
	});

	it('should handle removing anchor in rawXml with gridSpan', () => {
		const rawXml: XmlObject = {
			'a:graphic': {
				'a:graphicData': {
					'a:tbl': {
						'a:tblPr': {},
						'a:tblGrid': {
							'a:gridCol': [
								{ '@_w': '3048000' },
								{ '@_w': '3048000' },
								{ '@_w': '3048000' },
							],
						},
						'a:tr': {
							'@_h': '381000',
							'a:tc': [
								{
									...makeTc('Anchor'),
									'@_gridSpan': '2',
								},
								{
									...makeTc(''),
									'@_hMerge': '1',
								},
								makeTc('C1'),
							],
						},
					},
				},
			},
		};

		const td: PptxTableData = {
			rows: [
				{
					height: 40,
					cells: [
						{ text: 'Anchor', gridSpan: 2 },
						{ text: '', hMerge: true },
						{ text: 'C1' },
					],
				},
			],
			columnWidths: [1 / 3, 1 / 3, 1 / 3],
		};

		const result = removeTableColumn(td, 0, rawXml);
		const tbl = getTbl(result.rawXml!);
		const cells = getXmlCells(tbl, 0);
		expect(cells).toHaveLength(2);
		// Former hMerge cell should no longer be hMerge
		expect(cells[0]['@_hMerge']).toBeUndefined();
		// gridSpan should be removed (was 2-1=1)
		expect(cells[0]['@_gridSpan']).toBeUndefined();
	});
});

// ===========================================================================
// rebuildTableXmlFromData
// ===========================================================================

describe('rebuildTableXmlFromData', () => {
	it('should rebuild grid columns and rows to match table data', () => {
		const tbl: XmlObject = {
			'a:tblPr': {},
			'a:tblGrid': {
				'a:gridCol': [
					{ '@_w': '4572000' },
					{ '@_w': '4572000' },
				],
			},
			'a:tr': [
				{
					'@_h': '381000',
					'a:tc': [makeTc('A1'), makeTc('B1')],
				},
			],
		};

		const tableData: PptxTableData = {
			rows: [
				{
					height: 40,
					cells: [{ text: 'A1' }, { text: 'B1' }, { text: 'C1' }],
				},
				{
					height: 40,
					cells: [{ text: 'A2' }, { text: 'B2' }, { text: 'C2' }],
				},
			],
			columnWidths: [1 / 3, 1 / 3, 1 / 3],
		};

		rebuildTableXmlFromData(tbl, tableData, 9525, ensureArray);

		const gridCols = getGridCols(tbl);
		expect(gridCols).toHaveLength(3);

		const rows = ensureArray(tbl['a:tr']) as XmlObject[];
		expect(rows).toHaveLength(2);

		// Each row should have 3 cells
		for (const row of rows) {
			const cells = ensureArray(row['a:tc']);
			expect(cells).toHaveLength(3);
		}
	});

	it('should preserve existing cell XML when possible', () => {
		const tbl: XmlObject = {
			'a:tblPr': {},
			'a:tblGrid': {
				'a:gridCol': [
					{ '@_w': '4572000' },
					{ '@_w': '4572000' },
				],
			},
			'a:tr': {
				'@_h': '381000',
				'a:tc': [
					{
						...makeTc('A1'),
						'a:tcPr': { '@_anchor': 'ctr' },
					},
					makeTc('B1'),
				],
			},
		};

		const tableData: PptxTableData = {
			rows: [
				{
					height: 40,
					cells: [
						{ text: 'A1' },
						{ text: 'B1' },
						{ text: 'C1' }, // New column
					],
				},
			],
			columnWidths: [1 / 3, 1 / 3, 1 / 3],
		};

		rebuildTableXmlFromData(tbl, tableData, 9525, ensureArray);

		const rows = ensureArray(tbl['a:tr']) as XmlObject[];
		const cells = ensureArray(rows[0]['a:tc']) as XmlObject[];

		// First cell should preserve styling from original
		expect((cells[0]['a:tcPr'] as XmlObject)?.['@_anchor']).toBe('ctr');

		// Third cell should be a new default cell
		expect(cells[2]['a:txBody']).toBeDefined();
	});

	it('should set merge attributes correctly', () => {
		const tbl: XmlObject = {
			'a:tblPr': {},
			'a:tblGrid': {
				'a:gridCol': [{ '@_w': '4572000' }, { '@_w': '4572000' }],
			},
			'a:tr': [
				{
					'@_h': '381000',
					'a:tc': [makeTc('A1'), makeTc('B1')],
				},
				{
					'@_h': '381000',
					'a:tc': [makeTc('A2'), makeTc('B2')],
				},
			],
		};

		const tableData: PptxTableData = {
			rows: [
				{
					height: 40,
					cells: [
						{ text: 'Merged', gridSpan: 2 },
						{ text: '', hMerge: true },
					],
				},
				{
					height: 40,
					cells: [{ text: 'A2' }, { text: 'B2' }],
				},
			],
			columnWidths: [0.5, 0.5],
		};

		rebuildTableXmlFromData(tbl, tableData, 9525, ensureArray);

		const rows = ensureArray(tbl['a:tr']) as XmlObject[];
		const firstRowCells = ensureArray(rows[0]['a:tc']) as XmlObject[];

		expect(firstRowCells[0]['@_gridSpan']).toBe('2');
		expect(firstRowCells[1]['@_hMerge']).toBe('1');
	});

	it('should compute correct column widths from total EMU', () => {
		const tbl: XmlObject = {
			'a:tblPr': {},
			'a:tblGrid': {
				'a:gridCol': { '@_w': '9144000' },
			},
			'a:tr': {
				'@_h': '381000',
				'a:tc': makeTc('A1'),
			},
		};

		const tableData: PptxTableData = {
			rows: [
				{
					height: 40,
					cells: [{ text: 'A1' }, { text: 'B1' }],
				},
			],
			columnWidths: [0.5, 0.5],
		};

		rebuildTableXmlFromData(tbl, tableData, 9525, ensureArray);

		const gridCols = getGridCols(tbl);
		expect(gridCols).toHaveLength(2);
		const w1 = parseInt(String(gridCols[0]['@_w']), 10);
		const w2 = parseInt(String(gridCols[1]['@_w']), 10);
		expect(w1 + w2).toBe(9144000);
		expect(w1).toBe(4572000);
		expect(w2).toBe(4572000);
	});
});

// ===========================================================================
// Combined add + remove operations
// ===========================================================================

describe('combined operations', () => {
	it('should support add row then remove row to return to original size', () => {
		const td = make2x3TableData();
		const { tableData: afterAdd } = addTableRow(td, 1);
		expect(afterAdd.rows).toHaveLength(3);
		const { tableData: afterRemove } = removeTableRow(afterAdd, 1);
		expect(afterRemove.rows).toHaveLength(2);
		expect(afterRemove.rows[0].cells[0].text).toBe('A1');
		expect(afterRemove.rows[1].cells[0].text).toBe('A2');
	});

	it('should support add column then remove column', () => {
		const td = make2x3TableData();
		const { tableData: afterAdd } = addTableColumn(td, 1);
		expect(afterAdd.columnWidths).toHaveLength(4);
		const { tableData: afterRemove } = removeTableColumn(afterAdd, 1);
		expect(afterRemove.columnWidths).toHaveLength(3);
	});
});
