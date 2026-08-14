import type { PptxTableData } from 'pptx-viewer-core';
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

describe('table editor mutations', () => {
	it('inserts and deletes rows and columns', () => {
		const withRow = mutateTableStructure(table(), { row: 0, column: 0 }, 'insertRowBelow');
		expect(withRow.rows).toHaveLength(3);
		const withColumn = mutateTableStructure(withRow, { row: 0, column: 0 }, 'insertColumnRight');
		expect(withColumn.columnWidths).toHaveLength(3);
		expect(
			mutateTableStructure(withColumn, { row: 0, column: 1 }, 'deleteColumn').columnWidths,
		).toHaveLength(2);
		expect(mutateTableStructure(withRow, { row: 1, column: 0 }, 'deleteRow').rows).toHaveLength(2);
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
