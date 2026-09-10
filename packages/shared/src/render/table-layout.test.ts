import type { PptxTableData } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	insertTableRow,
	deleteTableRow,
	insertTableColumn,
	deleteTableColumn,
} from './table-layout';

function makeTable(rows: number, cols: number): PptxTableData {
	return {
		rows: Array.from({ length: rows }, () => ({
			cells: Array.from({ length: cols }, () => ({ text: '' })),
		})),
		columnWidths: Array.from({ length: cols }, () => 1 / cols),
	} as PptxTableData;
}

describe('insertTableRow', () => {
	it('should add a row below the reference index', () => {
		const table = makeTable(2, 3);
		const result = insertTableRow(table, 0, 'below');
		expect(result.rows).toHaveLength(3);
		expect(result.rows[1].cells).toHaveLength(3);
	});

	it('should add a row above the reference index', () => {
		const table = makeTable(2, 3);
		const result = insertTableRow(table, 1, 'above');
		expect(result.rows).toHaveLength(3);
	});

	it('should not mutate the original table', () => {
		const table = makeTable(2, 2);
		insertTableRow(table, 0, 'below');
		expect(table.rows).toHaveLength(2);
	});

	it('should grow a vertical merge anchor that straddles the insertion point', () => {
		const table = makeTable(3, 1);
		table.rows[0].cells[0].rowSpan = 3;
		table.rows[1].cells[0] = { text: '', vMerge: true };
		table.rows[2].cells[0] = { text: '', vMerge: true };
		const result = insertTableRow(table, 1, 'below');
		expect(result.rows[0].cells[0].rowSpan).toBe(4);
		// The inserted row's cell is a vMerge continuation.
		expect(result.rows[2].cells[0].vMerge).toBeTruthy();
	});
});

describe('deleteTableRow', () => {
	it.each(['row', 'column'] as const)('keeps rich text with the promoted %s anchor', (axis) => {
		const table = makeTable(2, 2);
		const source = table.rows[0].cells[0];
		const target = axis === 'row' ? table.rows[1].cells[0] : table.rows[0].cells[1];
		source.text = 'Rich text';
		source.textRuns = [
			{ text: 'Rich ', bold: true },
			{ text: 'text', italic: true },
		];
		if (axis === 'row') {
			source.rowSpan = 2;
			target.vMerge = true;
		} else {
			source.gridSpan = 2;
			target.hMerge = true;
		}
		target.textRuns = [{ text: '', underline: true }];
		target.style = { fontSize: 24 };
		const result = axis === 'row' ? deleteTableRow(table, 0) : deleteTableColumn(table, 0);
		expect(result.rows[0].cells[0].text).toBe(source.text);
		expect(result.rows[0].cells[0].textRuns).toStrictEqual(source.textRuns);
		expect(result.rows[0].cells[0].style).toStrictEqual(target.style);
		expect(target.textRuns).toStrictEqual([{ text: '', underline: true }]);
	});

	it.each(['row', 'column'] as const)(
		'retains fallback rich text for an empty %s anchor',
		(axis) => {
			const table = makeTable(2, 2);
			const source = table.rows[0].cells[0];
			const target = axis === 'row' ? table.rows[1].cells[0] : table.rows[0].cells[1];
			source.textRuns = [{ text: '', bold: true }];
			target.text = 'Fallback';
			target.textRuns = [{ text: 'Fallback', italic: true }];
			if (axis === 'row') {
				source.rowSpan = 2;
				target.vMerge = true;
			} else {
				source.gridSpan = 2;
				target.hMerge = true;
			}
			const result = axis === 'row' ? deleteTableRow(table, 0) : deleteTableColumn(table, 0);
			expect(result.rows[0].cells[0].text).toBe(target.text);
			expect(result.rows[0].cells[0].textRuns).toStrictEqual(target.textRuns);
		},
	);

	it('should remove the row at the index', () => {
		const table = makeTable(3, 2);
		const result = deleteTableRow(table, 1);
		expect(result.rows).toHaveLength(2);
	});

	it('should refuse to remove the only row', () => {
		const table = makeTable(1, 2);
		expect(deleteTableRow(table, 0)).toBe(table);
	});

	it('should return original for out-of-range index', () => {
		const table = makeTable(2, 2);
		expect(deleteTableRow(table, 5)).toBe(table);
	});

	it('should decrement the anchor rowSpan when deleting a continuation row', () => {
		const table = makeTable(3, 1);
		table.rows[0].cells[0].rowSpan = 3;
		table.rows[1].cells[0] = { text: '', vMerge: true };
		table.rows[2].cells[0] = { text: '', vMerge: true };
		const result = deleteTableRow(table, 2);
		expect(result.rows[0].cells[0].rowSpan).toBe(2);
	});
});

describe('insertTableColumn', () => {
	it('should add a column to the right and renormalise widths', () => {
		const table = makeTable(2, 2);
		const result = insertTableColumn(table, 0, 'right');
		expect(result.columnWidths).toHaveLength(3);
		const sum = result.columnWidths.reduce((a, b) => a + b, 0);
		expect(sum).toBeCloseTo(1, 5);
		expect(result.rows[0].cells).toHaveLength(3);
	});

	it('should add a column to the left', () => {
		const table = makeTable(1, 2);
		const result = insertTableColumn(table, 1, 'left');
		expect(result.rows[0].cells).toHaveLength(3);
	});

	it('should grow a horizontal merge anchor that straddles the insertion point', () => {
		const table = makeTable(1, 3);
		table.rows[0].cells[0].gridSpan = 3;
		table.rows[0].cells[1] = { text: '', hMerge: true };
		table.rows[0].cells[2] = { text: '', hMerge: true };
		const result = insertTableColumn(table, 1, 'right');
		expect(result.rows[0].cells[0].gridSpan).toBe(4);
	});
});

describe('deleteTableColumn', () => {
	it('should remove the column and renormalise widths', () => {
		const table = makeTable(2, 3);
		const result = deleteTableColumn(table, 1);
		expect(result.columnWidths).toHaveLength(2);
		const sum = result.columnWidths.reduce((a, b) => a + b, 0);
		expect(sum).toBeCloseTo(1, 5);
		expect(result.rows[0].cells).toHaveLength(2);
	});

	it('should refuse to remove the only column', () => {
		const table = makeTable(2, 1);
		expect(deleteTableColumn(table, 0)).toBe(table);
	});

	it('should return original for out-of-range index', () => {
		const table = makeTable(2, 2);
		expect(deleteTableColumn(table, 9)).toBe(table);
	});

	it('should decrement the anchor gridSpan when deleting a continuation column', () => {
		const table = makeTable(1, 3);
		table.rows[0].cells[0].gridSpan = 3;
		table.rows[0].cells[1] = { text: '', hMerge: true };
		table.rows[0].cells[2] = { text: '', hMerge: true };
		const result = deleteTableColumn(table, 2);
		expect(result.rows[0].cells[0].gridSpan).toBe(2);
	});
});
