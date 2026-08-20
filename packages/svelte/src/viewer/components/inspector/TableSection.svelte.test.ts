/* oxlint-disable eslint/one-var -- many independent it() blocks, each with
   its own short arrange/act/assert consts. */
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
		columnWidths: number[];
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

	it('sets a column to the exact requested width, proportionally rescaling the others', () => {
		// Regression: TableSection used to just overwrite the target column and
		// renormalise the WHOLE array by sum, which dilutes the target itself
		// (dragging the slider to 60% never actually showed 60%) instead of
		// proportionally rescaling only the other columns, as `redistributeColumnWidth`
		// (and every other binding's column-width control) does.
		const el = tableEl();
		if (el.type === 'table' && el.tableData) {
			el.tableData.columnWidths = [0.2, 0.3, 0.5];
			el.tableData.rows = [
				{ cells: [{ text: 'A' }, { text: 'B' }, { text: 'C' }] },
				{ cells: [{ text: 'D' }, { text: 'E' }, { text: 'F' }] },
			];
		}
		const editor = makeEditor(el);
		const { target } = mountSection(editor, currentEl(editor));
		const slider = target.querySelector<HTMLInputElement>('input[type="range"]');
		if (!slider) {
			throw new Error('column width slider not found');
		}
		slider.value = '60';
		slider.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		const widths = (currentEl(editor) as TableShape).tableData?.columnWidths ?? [];
		expect(widths[0]).toBeCloseTo(0.6, 5);
		expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
		// The untouched columns' 0.3:0.5 ratio to each other is preserved.
		expect(widths[2] / widths[1]).toBeCloseTo(0.5 / 0.3, 5);
	});

	it('formats an individual selected cell', () => {
		const editor = makeEditor(tableEl());
		const { target } = mountSection(editor, currentEl(editor));
		const color = target.querySelector<HTMLInputElement>('input[type="color"]');
		if (!color) {
			throw new Error('cell color input not found');
		}
		color.value = '#123456';
		color.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();
		const data = (currentEl(editor) as TableShape).tableData;
		expect(data?.rows[0]?.cells[0]?.style).toMatchObject({ color: '#123456' });
	});
});
