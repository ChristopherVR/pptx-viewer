import type { PptxTableData } from 'pptx-viewer-core';
import {
	deleteTableColumn,
	deleteTableRow,
	insertTableColumn,
	insertTableRow,
} from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

// Regression: TableSection.svelte used to import its own local, non-merge-aware
// insertTableRow/deleteTableRow/insertTableColumn/deleteTableColumn (this file's
// former home) instead of the merge-aware versions in `pptx-viewer-shared`.
// Inserting or deleting a row/column through a merged cell region silently
// corrupted the merge (a dangling hMerge/vMerge continuation with no valid
// anchor, or a stale gridSpan/rowSpan). TableSection.svelte now imports the
// same shared functions the other four bindings use; these tests exercise them
// through the exact call convention TableSection.svelte uses (insert relative
// to an "active" row/column, delete by index) to guard against that import
// being swapped back out for a local reimplementation.

function table(): PptxTableData {
	return {
		rows: [
			{ cells: [{ text: 'a', rowSpan: 3 }, { text: 'b' }] },
			{ cells: [{ text: '', vMerge: true }, { text: 'd' }] },
			{ cells: [{ text: '', vMerge: true }, { text: 'f' }] },
		],
		columnWidths: [0.5, 0.5],
	};
}

function wideTable(): PptxTableData {
	return {
		rows: [{ cells: [{ text: 'a', gridSpan: 2 }, { text: '', hMerge: true }, { text: 'c' }] }],
		columnWidths: [1 / 3, 1 / 3, 1 / 3],
	};
}

describe('table structure editing (merge-aware, via pptx-viewer-shared)', () => {
	it('grows a vertical merge anchor when inserting a row through its span', () => {
		// TableSection calls insertTableRow(table, activeRow, 'below') on click.
		const result = insertTableRow(table(), 1, 'below');
		expect(result.rows).toHaveLength(4);
		expect(result.rows[0].cells[0].rowSpan).toBe(4);
		// The newly inserted row's cell in the merged column is a continuation,
		// never a dangling standalone cell.
		expect(result.rows[2].cells[0].vMerge).toBeTruthy();
	});

	it('migrates the merge anchor when deleting the anchor row', () => {
		// TableSection calls deleteTableRow(table, activeRow) on click.
		const result = deleteTableRow(table(), 0);
		expect(result.rows).toHaveLength(2);
		// The anchor's text/span move onto the next surviving row instead of
		// leaving row 0 (now the old vMerge continuation) as a broken anchor.
		expect(result.rows[0].cells[0].vMerge).toBeUndefined();
		expect(result.rows[0].cells[0].rowSpan).toBe(2);
		expect(result.rows[0].cells[0].text).toBe('a');
	});

	it('grows a horizontal merge anchor when inserting a column through its span', () => {
		// TableSection calls insertTableColumn(table, activeColumn, 'right').
		const result = insertTableColumn(wideTable(), 0, 'right');
		expect(result.rows[0].cells).toHaveLength(4);
		expect(result.rows[0].cells[0].gridSpan).toBe(3);
	});

	it('migrates the merge anchor when deleting the anchor column', () => {
		// TableSection calls deleteTableColumn(table, activeColumn).
		const result = deleteTableColumn(wideTable(), 0);
		expect(result.rows[0].cells).toHaveLength(2);
		expect(result.rows[0].cells[0].hMerge).toBeUndefined();
		expect(result.rows[0].cells[0].gridSpan).toBeUndefined();
		expect(result.rows[0].cells[0].text).toBe('a');
	});
});
