import type { PptxTableData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { computeCellSelection } from './table-selection';
import type { TableSelectionState } from './table-selection';

function makeTableData(rows: number, cols: number): PptxTableData {
	return {
		rows: Array.from({ length: rows }, () => ({
			cells: Array.from({ length: cols }, () => ({ text: '' })),
		})),
		columnWidths: Array.from({ length: cols }, () => 1 / cols),
	};
}

describe('computeCellSelection', () => {
	const td = makeTableData(3, 3);

	it('selects a single cell on a plain click', () => {
		const next = computeCellSelection(null, 'tbl', 1, 2, false, td);
		expect(next).toStrictEqual({ elementId: 'tbl', rowIndex: 1, columnIndex: 2 });
		expect(next.selectedCells).toBeUndefined();
	});

	it('extends a rectangular range on shift+click within the same table', () => {
		const prev: TableSelectionState = { elementId: 'tbl', rowIndex: 0, columnIndex: 0 };
		const next = computeCellSelection(prev, 'tbl', 1, 1, true, td);
		expect(next.rowIndex).toBe(0);
		expect(next.columnIndex).toBe(0);
		expect(next.selectedCells).toHaveLength(4);
		expect(next.selectedCells).toContainEqual({ row: 1, col: 1 });
	});

	it('ignores the anchor on shift+click when the previous selection is another table', () => {
		const prev: TableSelectionState = { elementId: 'other', rowIndex: 0, columnIndex: 0 };
		const next = computeCellSelection(prev, 'tbl', 2, 2, true, td);
		expect(next).toStrictEqual({ elementId: 'tbl', rowIndex: 2, columnIndex: 2 });
	});
});
