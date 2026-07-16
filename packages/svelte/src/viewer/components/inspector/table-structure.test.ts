import { describe, expect, it } from 'vitest';
import type { PptxTableData } from 'pptx-viewer-core';

import { deleteTableColumn, deleteTableRow, insertTableColumn, insertTableRow } from './table-structure';

const table = (): PptxTableData => ({ rows: [{ cells: [{ text: 'a' }, { text: 'b' }] }, { cells: [{ text: 'c' }, { text: 'd' }] }], columnWidths: [0.5, 0.5] });

describe('table structure editing', () => {
	it('inserts and deletes rows without mutating the source', () => {
		const source = table();
		const inserted = insertTableRow(source, 1);
		expect(inserted.rows).toHaveLength(3);
		expect(inserted.rows[1]?.cells).toHaveLength(2);
		expect(deleteTableRow(inserted, 1).rows).toStrictEqual(source.rows);
		expect(source.rows).toHaveLength(2);
	});
	it('inserts and deletes columns while normalizing widths', () => {
		const inserted = insertTableColumn(table(), 1);
		expect(inserted.rows.map((row) => row.cells.length)).toStrictEqual([3, 3]);
		expect(inserted.columnWidths.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
		const removed = deleteTableColumn(inserted, 1);
		expect(removed.rows.map((row) => row.cells.map((cell) => cell.text))).toStrictEqual([['a', 'b'], ['c', 'd']]);
	});
});
