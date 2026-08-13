import type { PptxElement, PptxTableData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildEditorContextMenuEntries, runContextMenuCommand } from './context-menu-dispatch';
import { EditorState } from './editor-state.svelte';
import { applyTableCellPointer } from './table-cell-pointer';

/**
 * Regression suite for "block cell merge can never appear".
 *
 * `context-menu-dispatch` passed `hasMultiCellSelection: false` as a LITERAL,
 * so the shared menu never offered `table-merge-selected` and PowerPoint's
 * "Merge Cells" was unreachable in this binding, whatever the user selected.
 * There was no cell-range model at all to feed it.
 */

function tableData(rows = 3, cols = 3): PptxTableData {
	return {
		rows: Array.from({ length: rows }, (_row, r) => ({
			cells: Array.from({ length: cols }, (_cell, c) => ({ text: `r${r}c${c}` })),
		})),
		columnWidths: Array.from({ length: cols }, () => 1 / cols),
	};
}

function tableElement(data: PptxTableData = tableData()): PptxElement {
	return {
		type: 'table',
		id: 'tbl',
		x: 0,
		y: 0,
		width: 400,
		height: 200,
		rotation: 0,
		tableData: data,
	} as PptxElement;
}

function makeEditor(element: PptxElement = tableElement()): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [element], notes: '' }]);
	editor.select('tbl');
	return editor;
}

/** A `<td>` carrying the model coordinates `TableView` stamps on every cell. */
function cellNode(row: number, col: number): HTMLElement {
	const td = document.createElement('td');
	td.setAttribute('data-cell-row', String(row));
	td.setAttribute('data-cell-col', String(col));
	document.body.append(td);
	return td;
}

/** The current table model on the selected element. */
function modelOf(editor: EditorState): PptxTableData {
	const element = editor.selectedElement;
	expect(element?.type).toBe('table');
	return (element as { tableData: PptxTableData }).tableData;
}

describe('table cell range', () => {
	it('a plain click anchors a single cell', () => {
		const editor = makeEditor();
		applyTableCellPointer(editor, 'tbl', cellNode(1, 1), false);
		expect(editor.tableCells.cellsFor('tbl')).toStrictEqual([{ row: 1, col: 1 }]);
		expect(editor.tableCells.hasBlock).toBeFalsy();
	});

	it('a shift-click stretches anchor -> cell into a rectangle', () => {
		const editor = makeEditor();
		applyTableCellPointer(editor, 'tbl', cellNode(0, 0), false);
		const consumed = applyTableCellPointer(editor, 'tbl', cellNode(1, 1), true);

		// Consumed, so the stage's Shift branch cannot toggle the table out of
		// the element selection behind the range's back.
		expect(consumed).toBeTruthy();
		expect(editor.tableCells.cellsFor('tbl')).toStrictEqual([
			{ row: 0, col: 0 },
			{ row: 0, col: 1 },
			{ row: 1, col: 0 },
			{ row: 1, col: 1 },
		]);
	});

	it('a click outside any cell abandons the range', () => {
		const editor = makeEditor();
		applyTableCellPointer(editor, 'tbl', cellNode(0, 0), false);
		applyTableCellPointer(editor, 'tbl', document.createElement('div'), false);
		expect(editor.tableCells.cellsFor('tbl')).toStrictEqual([]);
	});

	it('selecting another element clears the range', () => {
		const editor = makeEditor();
		applyTableCellPointer(editor, 'tbl', cellNode(0, 0), false);
		applyTableCellPointer(editor, 'tbl', cellNode(2, 2), true);
		expect(editor.tableCells.cellsFor('tbl').length).toBeGreaterThan(1);

		editor.select(null);
		expect(editor.tableCells.cellsFor('tbl')).toStrictEqual([]);
	});
});

describe('block merge through the context menu', () => {
	it('offers table-merge-selected only once the range covers a block', () => {
		const editor = makeEditor();
		const cell = { rowIndex: 0, columnIndex: 0 };

		applyTableCellPointer(editor, 'tbl', cellNode(0, 0), false);
		const single = buildEditorContextMenuEntries({ editor, cell }).map((entry) => entry.id);
		expect(single).not.toContain('table-merge-selected');

		applyTableCellPointer(editor, 'tbl', cellNode(1, 1), true);
		const block = buildEditorContextMenuEntries({ editor, cell }).map((entry) => entry.id);
		expect(block).toContain('table-merge-selected');
	});

	it('running it merges the block into one spanning cell', () => {
		const editor = makeEditor();
		applyTableCellPointer(editor, 'tbl', cellNode(0, 0), false);
		applyTableCellPointer(editor, 'tbl', cellNode(1, 1), true);

		runContextMenuCommand('table-merge-selected', {
			editor,
			cell: { rowIndex: 0, columnIndex: 0 },
		});

		const merged = modelOf(editor);
		expect(merged.rows[0].cells[0].gridSpan).toBe(2);
		expect(merged.rows[0].cells[0].rowSpan).toBe(2);
		expect(merged.rows[0].cells[1].hMerge).toBeTruthy();
		expect(merged.rows[1].cells[0].vMerge).toBeTruthy();
		// The untouched third column is intact.
		expect(merged.rows[0].cells[2].text).toBe('r0c2');
		// The range described a block that no longer exists.
		expect(editor.tableCells.cellsFor('tbl')).toStrictEqual([]);
	});

	it('is a no-op for a single-cell range (canMergeCells refuses it)', () => {
		const editor = makeEditor();
		applyTableCellPointer(editor, 'tbl', cellNode(0, 0), false);
		runContextMenuCommand('table-merge-selected', {
			editor,
			cell: { rowIndex: 0, columnIndex: 0 },
		});
		expect(modelOf(editor).rows[0].cells[0].gridSpan).toBeUndefined();
	});

	it('the merge is one undoable step', () => {
		const editor = makeEditor();
		applyTableCellPointer(editor, 'tbl', cellNode(0, 0), false);
		applyTableCellPointer(editor, 'tbl', cellNode(0, 1), true);
		runContextMenuCommand('table-merge-selected', {
			editor,
			cell: { rowIndex: 0, columnIndex: 0 },
		});
		expect(modelOf(editor).rows[0].cells[0].gridSpan).toBe(2);

		editor.undo();
		expect(modelOf(editor).rows[0].cells[0].gridSpan).toBeUndefined();
	});
});
