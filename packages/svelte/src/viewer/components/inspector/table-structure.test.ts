import type { PptxTableData, TablePptxElement } from 'pptx-viewer-core';
import {
	insertTableElementColumn,
	insertTableElementRow,
	removeTableElementColumn,
	removeTableElementRow,
} from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

// Regression: TableSection.svelte used to import its own local, non-merge-aware
// insertTableRow/deleteTableRow/insertTableColumn/deleteTableColumn (this file's
// former home) instead of the merge-aware versions in `pptx-viewer-shared`.
// Inserting or deleting a row/column through a merged cell region silently
// corrupted the merge (a dangling hMerge/vMerge continuation with no valid
// anchor, or a stale gridSpan/rowSpan). TableSection.svelte now imports the
// same shared element functions the other four bindings use; these tests exercise them
// through the exact call convention TableSection.svelte uses (insert relative
// to an "active" row/column, delete by index) to guard against that import
// being swapped back out for a local reimplementation.

function element(tableData: PptxTableData): TablePptxElement {
	return { type: 'table', id: 'tbl', x: 0, y: 0, width: 300, height: 200, tableData };
}

function table(): TablePptxElement {
	return element({
		rows: [
			{ cells: [{ text: 'a', rowSpan: 3 }, { text: 'b' }] },
			{ cells: [{ text: '', vMerge: true }, { text: 'd' }] },
			{ cells: [{ text: '', vMerge: true }, { text: 'f' }] },
		],
		columnWidths: [0.5, 0.5],
	});
}

function wideTable(): TablePptxElement {
	return element({
		rows: [{ cells: [{ text: 'a', gridSpan: 2 }, { text: '', hMerge: true }, { text: 'c' }] }],
		columnWidths: [1 / 3, 1 / 3, 1 / 3],
	});
}

describe('table structure editing (merge-aware, via pptx-viewer-shared)', () => {
	it('grows a vertical merge anchor when inserting a row through its span', () => {
		const result = insertTableElementRow(table(), 1, 'below').tableData!;
		expect(result.rows).toHaveLength(4);
		expect(result.rows[0].cells[0].rowSpan).toBe(4);
		// The newly inserted row's cell in the merged column is a continuation,
		// never a dangling standalone cell.
		expect(result.rows[2].cells[0].vMerge).toBeTruthy();
	});

	it('migrates the merge anchor when deleting the anchor row', () => {
		const result = removeTableElementRow(table(), 0).tableData!;
		expect(result.rows).toHaveLength(2);
		// The anchor's text/span move onto the next surviving row instead of
		// leaving row 0 (now the old vMerge continuation) as a broken anchor.
		expect(result.rows[0].cells[0].vMerge).toBeUndefined();
		expect(result.rows[0].cells[0].rowSpan).toBe(2);
		expect(result.rows[0].cells[0].text).toBe('a');
	});

	it('grows a horizontal merge anchor when inserting a column through its span', () => {
		const result = insertTableElementColumn(wideTable(), 0, 'right').tableData!;
		expect(result.rows[0].cells).toHaveLength(4);
		expect(result.rows[0].cells[0].gridSpan).toBe(3);
	});

	it('migrates the merge anchor when deleting the anchor column', () => {
		const result = removeTableElementColumn(wideTable(), 0).tableData!;
		expect(result.rows[0].cells).toHaveLength(2);
		expect(result.rows[0].cells[0].hMerge).toBeUndefined();
		expect(result.rows[0].cells[0].gridSpan).toBeUndefined();
		expect(result.rows[0].cells[0].text).toBe('a');
	});
});
