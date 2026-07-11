import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import TableSection from './TableSection.svelte';

/**
 * TableSection tests: header-row / banded-rows toggles and a uniform default
 * cell padding, built on the shared `table-inspector.ts`. Named
 * `*.svelte.test.ts` per the mounted-props convention (see
 * `notes-panel.svelte.test.ts`).
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
		firstRowHeader?: boolean;
		bandedRows?: boolean;
		rows: Array<{ cells: Array<{ style?: { marginLeft?: number } }> }>;
	};
};

function mountSection(
	editor: EditorState,
	el: PptxElement,
): { target: HTMLElement; setProps: (next: { el: PptxElement }) => void } {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const props = $state({ editor, el });
	const instance = mount(TableSection, { target, props });
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

describe('tableSection', () => {
	it('toggles header row and banded rows', () => {
		const editor = makeEditor(tableEl());
		const { target, setProps } = mountSection(editor, currentEl(editor));
		const [headerRow, bandedRows] = Array.from(
			target.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
		);
		headerRow?.click();
		flushSync();
		// Re-sync the `el` prop with the just-committed slides (as the live
		// `editor.selectedElement` derivation would in the real InspectorPanel
		// tree), so the second toggle's `tableInspectorPatch` merges onto the
		// post-first-commit `tableData`.
		setProps({ el: currentEl(editor) });
		bandedRows?.click();
		flushSync();

		const data = (currentEl(editor) as TableShape).tableData;
		expect(data?.firstRowHeader).toBeTruthy();
		expect(data?.bandedRows).toBeTruthy();
	});

	it('applies a uniform cell padding to every cell', () => {
		const editor = makeEditor(tableEl());
		const { target } = mountSection(editor, currentEl(editor));
		const padding = target.querySelector<HTMLInputElement>('input[type="number"]');
		if (!padding) {
			throw new Error('cell padding input not found');
		}
		padding.value = '8';
		padding.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		const rows = (currentEl(editor) as TableShape).tableData?.rows ?? [];
		for (const row of rows) {
			for (const cell of row.cells) {
				expect(cell.style?.marginLeft).toBe(8);
			}
		}
	});
});
