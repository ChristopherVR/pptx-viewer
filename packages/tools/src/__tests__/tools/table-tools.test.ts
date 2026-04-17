import type { PptxData, TablePptxElement } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { updateTableCells, manageTableStructure } from '../../tools/table-tools.js';
import type { ToolContext } from '../../types.js';
import { makeTablePresentation } from '../helpers/create-test-pptx.js';

function ctx(pptxData?: PptxData): ToolContext {
	return { pptxData: pptxData ?? makeTablePresentation() };
}

function getTable(c: ToolContext): TablePptxElement {
	return c.pptxData.slides[0].elements.find((e) => e.id === 'tbl-0') as TablePptxElement;
}

// ── updateTableCells ────────────────────────────────────────────────────────

describe('updateTableCells', () => {
	it('updates a single cell', () => {
		const c = ctx();
		const result = updateTableCells(c, {
			slideIndex: 0,
			elementId: 'tbl-0',
			cells: [{ row: 0, col: 0, text: 'Updated Header' }],
		});
		expect(result.dirty).toBeTruthy();
		expect(result.result.updatedCount).toBe(1);
		expect(getTable(c).tableData!.rows[0].cells[0].text).toBe('Updated Header');
	});

	it('updates multiple cells at once', () => {
		const c = ctx();
		const result = updateTableCells(c, {
			slideIndex: 0,
			elementId: 'tbl-0',
			cells: [
				{ row: 0, col: 0, text: 'A1' },
				{ row: 0, col: 1, text: 'B1' },
				{ row: 1, col: 2, text: 'C2' },
			],
		});
		expect(result.result.updatedCount).toBe(3);
		expect(getTable(c).tableData!.rows[0].cells[0].text).toBe('A1');
		expect(getTable(c).tableData!.rows[0].cells[1].text).toBe('B1');
		expect(getTable(c).tableData!.rows[1].cells[2].text).toBe('C2');
	});

	it('throws on non-table element', () => {
		expect(() =>
			updateTableCells(ctx(), {
				slideIndex: 0,
				elementId: 'txt-0',
				cells: [{ row: 0, col: 0, text: 'x' }],
			}),
		).toThrow('not a table');
	});

	it('throws on nonexistent element', () => {
		expect(() =>
			updateTableCells(ctx(), {
				slideIndex: 0,
				elementId: 'nonexistent',
				cells: [{ row: 0, col: 0, text: 'x' }],
			}),
		).toThrow('not found');
	});

	it('throws on out-of-range row', () => {
		expect(() =>
			updateTableCells(ctx(), {
				slideIndex: 0,
				elementId: 'tbl-0',
				cells: [{ row: 99, col: 0, text: 'x' }],
			}),
		).toThrow('out of range');
	});

	it('throws on out-of-range column', () => {
		expect(() =>
			updateTableCells(ctx(), {
				slideIndex: 0,
				elementId: 'tbl-0',
				cells: [{ row: 0, col: 99, text: 'x' }],
			}),
		).toThrow('out of range');
	});

	it('throws on invalid slide index', () => {
		expect(() =>
			updateTableCells(ctx(), {
				slideIndex: 99,
				elementId: 'tbl-0',
				cells: [{ row: 0, col: 0, text: 'x' }],
			}),
		).toThrow('out of range');
	});
});

// ── manageTableStructure ────────────────────────────────────────────────────

describe('manageTableStructure', () => {
	describe('insertRow', () => {
		it('inserts a row at the end by default', () => {
			const c = ctx();
			const result = manageTableStructure(c, {
				slideIndex: 0,
				elementId: 'tbl-0',
				action: 'insertRow',
			});
			expect(result.dirty).toBeTruthy();
			expect(result.result.rowCount).toBe(4);
			expect(result.result.columnCount).toBe(3);
			// new row should have 3 empty cells
			const lastRow = getTable(c).tableData!.rows[3];
			expect(lastRow.cells).toHaveLength(3);
			expect(lastRow.cells[0].text).toBe('');
		});

		it('inserts a row at a specific position', () => {
			const c = ctx();
			manageTableStructure(c, {
				slideIndex: 0,
				elementId: 'tbl-0',
				action: 'insertRow',
				position: 1,
			});
			expect(getTable(c).tableData!.rows[1].cells[0].text).toBe('');
			expect(getTable(c).tableData!.rows[2].cells[0].text).toBe('R1C1');
		});

		it('inserts row with cell texts', () => {
			const c = ctx();
			manageTableStructure(c, {
				slideIndex: 0,
				elementId: 'tbl-0',
				action: 'insertRow',
				position: 0,
				cellTexts: ['X', 'Y', 'Z'],
			});
			expect(getTable(c).tableData!.rows[0].cells[0].text).toBe('X');
			expect(getTable(c).tableData!.rows[0].cells[1].text).toBe('Y');
			expect(getTable(c).tableData!.rows[0].cells[2].text).toBe('Z');
		});
	});

	describe('deleteRow', () => {
		it('deletes the last row by default', () => {
			const c = ctx();
			const result = manageTableStructure(c, {
				slideIndex: 0,
				elementId: 'tbl-0',
				action: 'deleteRow',
			});
			expect(result.dirty).toBeTruthy();
			expect(result.result.rowCount).toBe(2);
		});

		it('deletes a specific row', () => {
			const c = ctx();
			manageTableStructure(c, {
				slideIndex: 0,
				elementId: 'tbl-0',
				action: 'deleteRow',
				referenceIndex: 0,
			});
			// header row deleted, first data row is now row 0
			expect(getTable(c).tableData!.rows[0].cells[0].text).toBe('R1C1');
		});

		it('throws when deleting the last remaining row', () => {
			const c = ctx();
			// delete down to 1 row
			manageTableStructure(c, {
				slideIndex: 0,
				elementId: 'tbl-0',
				action: 'deleteRow',
			});
			manageTableStructure(c, {
				slideIndex: 0,
				elementId: 'tbl-0',
				action: 'deleteRow',
			});
			expect(() =>
				manageTableStructure(c, {
					slideIndex: 0,
					elementId: 'tbl-0',
					action: 'deleteRow',
				}),
			).toThrow('Cannot delete the last row');
		});

		it('throws on out-of-range row index', () => {
			expect(() =>
				manageTableStructure(ctx(), {
					slideIndex: 0,
					elementId: 'tbl-0',
					action: 'deleteRow',
					referenceIndex: 99,
				}),
			).toThrow('out of range');
		});
	});

	describe('insertColumn', () => {
		it('inserts a column at the end by default', () => {
			const c = ctx();
			const result = manageTableStructure(c, {
				slideIndex: 0,
				elementId: 'tbl-0',
				action: 'insertColumn',
			});
			expect(result.result.columnCount).toBe(4);
			// each row should have 4 cells
			for (const row of getTable(c).tableData!.rows) {
				expect(row.cells).toHaveLength(4);
			}
		});

		it('inserts column at a specific position', () => {
			const c = ctx();
			manageTableStructure(c, {
				slideIndex: 0,
				elementId: 'tbl-0',
				action: 'insertColumn',
				position: 1,
			});
			expect(getTable(c).tableData!.rows[0].cells[1].text).toBe('');
			expect(getTable(c).tableData!.rows[0].cells[2].text).toBe('Header B');
		});

		it('redistributes column widths after insert', () => {
			const c = ctx();
			manageTableStructure(c, {
				slideIndex: 0,
				elementId: 'tbl-0',
				action: 'insertColumn',
			});
			const widths = getTable(c).tableData!.columnWidths;
			expect(widths).toHaveLength(4);
			const totalWidth = widths.reduce((s, w) => s + w, 0);
			expect(totalWidth).toBeCloseTo(1.0, 5);
		});
	});

	describe('deleteColumn', () => {
		it('deletes the last column by default', () => {
			const c = ctx();
			const result = manageTableStructure(c, {
				slideIndex: 0,
				elementId: 'tbl-0',
				action: 'deleteColumn',
			});
			expect(result.result.columnCount).toBe(2);
			for (const row of getTable(c).tableData!.rows) {
				expect(row.cells).toHaveLength(2);
			}
		});

		it('deletes a specific column', () => {
			const c = ctx();
			manageTableStructure(c, {
				slideIndex: 0,
				elementId: 'tbl-0',
				action: 'deleteColumn',
				referenceIndex: 0,
			});
			expect(getTable(c).tableData!.rows[0].cells[0].text).toBe('Header B');
		});

		it('redistributes column widths after delete', () => {
			const c = ctx();
			manageTableStructure(c, {
				slideIndex: 0,
				elementId: 'tbl-0',
				action: 'deleteColumn',
			});
			const widths = getTable(c).tableData!.columnWidths;
			expect(widths).toHaveLength(2);
			const totalWidth = widths.reduce((s, w) => s + w, 0);
			expect(totalWidth).toBeCloseTo(1.0, 5);
		});

		it('throws when deleting the last remaining column', () => {
			const c = ctx();
			manageTableStructure(c, {
				slideIndex: 0,
				elementId: 'tbl-0',
				action: 'deleteColumn',
			});
			manageTableStructure(c, {
				slideIndex: 0,
				elementId: 'tbl-0',
				action: 'deleteColumn',
			});
			expect(() =>
				manageTableStructure(c, {
					slideIndex: 0,
					elementId: 'tbl-0',
					action: 'deleteColumn',
				}),
			).toThrow('Cannot delete the last column');
		});

		it('throws on out-of-range column index', () => {
			expect(() =>
				manageTableStructure(ctx(), {
					slideIndex: 0,
					elementId: 'tbl-0',
					action: 'deleteColumn',
					referenceIndex: 99,
				}),
			).toThrow('out of range');
		});
	});

	it('throws on non-table element', () => {
		expect(() =>
			manageTableStructure(ctx(), {
				slideIndex: 0,
				elementId: 'txt-0',
				action: 'insertRow',
			}),
		).toThrow('not a table');
	});

	it('throws on unknown action', () => {
		expect(() =>
			manageTableStructure(ctx(), {
				slideIndex: 0,
				elementId: 'tbl-0',
				action: 'unknown' as 'insertRow',
			}),
		).toThrow('Unknown action');
	});
});
