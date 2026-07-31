import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import TableDataGrid from './TableDataGrid.svelte';

/**
 * TableDataGrid tests: the inspector's per-cell text spreadsheet. Every
 * assertion goes through a real `EditorState`, so a panel that renders but
 * never commits fails here rather than shipping.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function tableEl(): PptxElement {
	return {
		type: 'table',
		id: 'tbl1',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		tableData: {
			rows: [{ cells: [{ text: 'A' }, { text: 'B' }] }, { cells: [{ text: 'C' }, { text: 'D' }] }],
			columnWidths: [0.5, 0.5],
		},
	} as PptxElement;
}

function emptyTableEl(): PptxElement {
	return {
		type: 'table',
		id: 'tbl0',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		tableData: { rows: [], columnWidths: [] },
	} as PptxElement;
}

function makeEditor(el: PptxElement): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [el] }]);
	editor.select(el.id);
	return editor;
}

function currentEl(editor: EditorState): PptxElement {
	const el = editor.slides[0]?.elements[0];
	if (!el) {
		throw new Error('element missing');
	}
	return el;
}

type TableShape = {
	tableData?: {
		columnWidths: number[];
		rows: Array<{ cells: Array<{ text?: string }> }>;
	};
};

function tableDataOf(editor: EditorState): NonNullable<TableShape['tableData']> {
	const data = (currentEl(editor) as TableShape).tableData;
	if (!data) {
		throw new Error('table data missing');
	}
	return data;
}

function mountGrid(
	editor: EditorState,
	el: PptxElement,
): { target: HTMLElement; setProps: (next: { el: PptxElement }) => void } {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const props = $state({ editor, el });
	const instance = mount(TableDataGrid, { target, props });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return {
		target,
		setProps: (next) => {
			Object.assign(props, next);
			flushSync();
		},
	};
}

function clickByTitle(target: HTMLElement, title: string): void {
	const button = target.querySelector<HTMLButtonElement>(`button[title="${title}"]`);
	if (!button) {
		throw new Error(`button not found: ${title}`);
	}
	button.click();
	flushSync();
}

describe('tableDataGrid', () => {
	it('renders one labelled input per cell', () => {
		const editor = makeEditor(tableEl());
		const { target } = mountGrid(editor, currentEl(editor));

		expect(target.querySelectorAll('input[type="text"]')).toHaveLength(4);
		const first = target.querySelector<HTMLInputElement>('[aria-label="Row 1, column 1"]');
		const last = target.querySelector<HTMLInputElement>('[aria-label="Row 2, column 2"]');
		expect(first?.value).toBe('A');
		expect(last?.value).toBe('D');
		// The e2e contract drives the in-slide cell editor with `td input`, so
		// this grid must never use real table markup.
		expect(target.querySelector('table')).toBeNull();
		expect(target.querySelector('[role="grid"]')).not.toBeNull();
	});

	it('commits a cell edit to the editor', () => {
		const editor = makeEditor(tableEl());
		const { target } = mountGrid(editor, currentEl(editor));

		const cell = target.querySelector<HTMLInputElement>('[aria-label="Row 2, column 1"]');
		if (!cell) {
			throw new Error('cell input not found');
		}
		cell.value = 'Changed';
		cell.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();

		const rows = tableDataOf(editor).rows;
		expect(rows[1]?.cells[0]?.text).toBe('Changed');
		expect(rows[0]?.cells[0]?.text).toBe('A');
	});

	it('adds and removes rows through the header buttons', () => {
		const editor = makeEditor(tableEl());
		const { target, setProps } = mountGrid(editor, currentEl(editor));

		clickByTitle(target, 'Add row below last');
		expect(tableDataOf(editor).rows).toHaveLength(3);

		setProps({ el: currentEl(editor) });
		clickByTitle(target, 'Remove last row');
		expect(tableDataOf(editor).rows).toHaveLength(2);
	});

	it('adds and removes columns through the header buttons', () => {
		const editor = makeEditor(tableEl());
		const { target, setProps } = mountGrid(editor, currentEl(editor));

		clickByTitle(target, 'Add column to the right');
		expect(tableDataOf(editor).columnWidths).toHaveLength(3);

		setProps({ el: currentEl(editor) });
		clickByTitle(target, 'Remove last column');
		expect(tableDataOf(editor).columnWidths).toHaveLength(2);
	});

	it('removes a specific row or column from its header control', () => {
		const editor = makeEditor(tableEl());
		const { target } = mountGrid(editor, currentEl(editor));

		clickByTitle(target, 'Remove column 1');
		const data = tableDataOf(editor);
		expect(data.columnWidths).toHaveLength(1);
		expect(data.rows[0]?.cells[0]?.text).toBe('B');
	});

	it('renders nothing for a table with no data', () => {
		const editor = makeEditor(emptyTableEl());
		const { target } = mountGrid(editor, currentEl(editor));

		expect(target.querySelector('section')).toBeNull();
		expect(target.querySelectorAll('input')).toHaveLength(0);
	});

	it('hides the edit controls and disables every input in a read-only viewer', () => {
		const editor = makeEditor(tableEl());
		editor.editable = false;
		const { target } = mountGrid(editor, currentEl(editor));

		expect(target.querySelectorAll('button')).toHaveLength(0);
		expect(
			Array.from(target.querySelectorAll<HTMLInputElement>('input')).every(
				(input) => input.disabled,
			),
		).toBeTruthy();
	});
});
