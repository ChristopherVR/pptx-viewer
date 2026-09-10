/* oxlint-disable eslint/one-var -- many independent `it()` blocks, each with
   its own short arrange/act/assert consts. */
import type { PptxTableData, TablePptxElement, XmlObject } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	mergeTableCellRange,
	mutateTableStructure,
	patchTableCells,
	setTableColumnWidth,
	setTableRowHeight,
	splitTableCell,
} from './table-editor-mutations';

function table(): PptxTableData {
	return {
		columnWidths: [0.5, 0.5],
		rows: [
			{ height: 30, cells: [{ text: 'A' }, { text: 'B' }] },
			{ height: 40, cells: [{ text: 'C' }, { text: 'D' }] },
		],
	};
}

function rawTableRows(element: TablePptxElement): XmlObject[] {
	const graphic = element.rawXml!['a:graphic'] as XmlObject;
	const data = graphic['a:graphicData'] as XmlObject;
	return (data['a:tbl'] as XmlObject)['a:tr'] as XmlObject[];
}

describe('table editor mutations', () => {
	it('moves surviving raw cells with an inserted row and deleted column', () => {
		const data = table();
		const rawRows = data.rows.map((row) => ({
			'@_h': '381000',
			'a:tc': row.cells.map((cell) => ({
				'a:txBody': { 'a:p': { 'a:r': { 'a:rPr': { '@_b': '1' }, 'a:t': cell.text } } },
				'a:tcPr': {},
			})),
		}));
		const element: TablePptxElement = {
			id: 'table',
			type: 'table',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			tableData: data,
			rawXml: {
				'a:graphic': {
					'a:graphicData': {
						'a:tbl': {
							'a:tblGrid': { 'a:gridCol': [{ '@_w': '1000' }, { '@_w': '1000' }] },
							'a:tr': rawRows,
						},
					},
				},
			},
		};
		const withRow = mutateTableStructure(element, { row: 0, column: 0 }, 'insertRowBelow');
		expect(rawTableRows(withRow)[2]['a:tc']).toStrictEqual(rawRows[1]['a:tc']);
		const withColumnRemoved = mutateTableStructure(withRow, { row: 0, column: 0 }, 'deleteColumn');
		expect(withColumnRemoved.tableData!.rows[2].cells[0].text).toBe('D');
		expect(rawTableRows(withColumnRemoved)[2]['a:tc']).toStrictEqual(rawRows[1]['a:tc'][1]);
	});

	it('inserts and deletes rows and columns', () => {
		const element: TablePptxElement = {
			id: 'table',
			type: 'table',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			tableData: table(),
		};
		const withRow = mutateTableStructure(element, { row: 0, column: 0 }, 'insertRowBelow');
		expect(withRow.tableData!.rows).toHaveLength(3);
		const withColumn = mutateTableStructure(withRow, { row: 0, column: 0 }, 'insertColumnRight');
		expect(withColumn.tableData!.columnWidths).toHaveLength(3);
		expect(
			mutateTableStructure(withColumn, { row: 0, column: 1 }, 'deleteColumn').tableData!
				.columnWidths,
		).toHaveLength(2);
		expect(
			mutateTableStructure(withRow, { row: 1, column: 0 }, 'deleteRow').tableData!.rows,
		).toHaveLength(2);
	});

	it('formats a cell range without touching other cells', () => {
		const next = patchTableCells(table(), [{ row: 0, column: 1 }], {
			fillMode: 'pattern',
			patternFillPreset: 'smGrid',
			borderRightWidth: 3,
		});
		expect(next.rows[0].cells[0].style).toBeUndefined();
		expect(next.rows[0].cells[1].style).toMatchObject({
			fillMode: 'pattern',
			patternFillPreset: 'smGrid',
			borderRightWidth: 3,
		});
	});

	it('resizes a row and normalizes column widths', () => {
		const resized = setTableColumnWidth(table(), 0, 70);
		expect(resized.columnWidths[0]).toBeCloseTo(0.7);
		expect(resized.columnWidths.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
		expect(setTableRowHeight(resized, 1, 88).rows[1].height).toBe(88);
	});

	// Regression: `setTableColumnWidth` delegates to `pptx-viewer-shared`'s
	// `redistributeColumnWidth`, the same formula every other binding's
	// column-width control uses, so it proportionally rescales the OTHER
	// columns (preserving their relative ratio) rather than the target column
	// itself ending up diluted by a naive whole-array sum renormalisation.
	it('proportionally rescales the other columns and preserves their ratio', () => {
		const data: PptxTableData = {
			columnWidths: [0.2, 0.3, 0.5],
			rows: [
				{ cells: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] },
				{ cells: [{ text: 'd' }, { text: 'e' }, { text: 'f' }] },
			],
		};
		const resized = setTableColumnWidth(data, 0, 60);
		expect(resized.columnWidths[0]).toBeCloseTo(0.6, 5);
		expect(resized.columnWidths.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 5);
		expect(resized.columnWidths[2] / resized.columnWidths[1]).toBeCloseTo(0.5 / 0.3, 5);
	});

	it('merges a rectangle and splits its anchor', () => {
		const cells = [
			{ row: 0, column: 0 },
			{ row: 0, column: 1 },
			{ row: 1, column: 0 },
			{ row: 1, column: 1 },
		];
		const merged = mergeTableCellRange(table(), cells);
		expect(merged.rows[0].cells[0]).toMatchObject({ gridSpan: 2, rowSpan: 2 });
		expect(merged.rows[1].cells[1]).toMatchObject({ hMerge: true, vMerge: true });
		const split = splitTableCell(merged, { row: 0, column: 0 });
		expect(split.rows[0].cells[0].gridSpan).toBeUndefined();
		expect(split.rows[1].cells[1].hMerge).toBeUndefined();
	});

	// Regression: a selection that only partially overlaps an existing merged
	// cell must expand to fully cover that merge group before validating,
	// mirroring `pptx-viewer-shared`'s `table-merge.test.ts` ("should expand to
	// cover an overlapped merge anchor"). `mergeTableCellRange` used to compute
	// its own bounding rect from the raw selection and validate with a naive
	// `cells.length === area` check, so a selection touching only part of an
	// existing merge (here: the merge's right continuation cell plus the cell
	// below it) passed that check without ever pulling in the merge's anchor,
	// merging two cells while leaving the pre-existing gridSpan=2 anchor
	// untouched and overlapping the new merge.
	it('expands the selection over an existing merge before merging', () => {
		const data = table();
		data.rows[0].cells[0].gridSpan = 2;
		data.rows[0].cells[1].hMerge = true;

		// Selection only covers the merge's continuation cell (0,1) and the
		// plain cell below it (1,1); it never names the anchor at (0,0).
		const merged = mergeTableCellRange(data, [
			{ row: 0, column: 1 },
			{ row: 1, column: 1 },
		]);

		// The rect must expand left to (0,0) and merge the full 2x2 block.
		expect(merged.rows[0].cells[0]).toMatchObject({ gridSpan: 2, rowSpan: 2 });
		expect(merged.rows[0].cells[1]).toMatchObject({ hMerge: true });
		expect(merged.rows[1].cells[0]).toMatchObject({ vMerge: true });
		expect(merged.rows[1].cells[1]).toMatchObject({ hMerge: true, vMerge: true });
	});

	// Regression: `appendCellText` paints `cell.textRuns` in preference to
	// `cell.text`, so a merge that re-texted the cells but left their old run
	// model behind kept painting the absorbed cells' own words.
	it('drops the per-run model of every cell a merge re-texts', () => {
		const data = table();
		for (const row of data.rows) {
			for (const cell of row.cells) {
				cell.textRuns = [{ text: cell.text, bold: true }];
			}
		}
		const merged = mergeTableCellRange(data, [
			{ row: 0, column: 0 },
			{ row: 0, column: 1 },
			{ row: 1, column: 0 },
			{ row: 1, column: 1 },
		]);
		expect(merged.rows[0].cells[0].text).toBe('A B C D');
		for (const row of merged.rows) {
			for (const cell of row.cells) {
				expect(cell.textRuns).toBeUndefined();
			}
		}
	});
});
