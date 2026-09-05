import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import TableSection from './TableSection.svelte';

/**
 * Table cell text/fill colour: `TableCellSection` (mounted here via its
 * `TableSection` parent, matching `TableSection.svelte.test.ts`'s
 * convention) shows the deck's real "Theme Colors" grid for both the cell
 * text colour and the cell fill colour. A theme swatch commits both the
 * resolved hex and its `PptxThemeColorRef`; the native colour input always
 * clears the ref.
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
			rows: [{ cells: [{ text: 'A', style: { color: '#111111', backgroundColor: '#eeeeee' } }] }],
			columnWidths: [1],
		},
	} as PptxElement;
}

function makeEditor(el: PptxElement): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [el] }]);
	editor.select(el.id);
	editor.theme = {
		colorScheme: {
			dk1: '#000000',
			lt1: '#ffffff',
			dk2: '#44546a',
			lt2: '#e7e6e6',
			accent1: '#4472c4',
			accent2: '#ed7d31',
			accent3: '#a5a5a5',
			accent4: '#ffc000',
			accent5: '#5b9bd5',
			accent6: '#70ad47',
			hlink: '#0563c1',
			folHlink: '#954f72',
		},
	};
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
		rows: Array<{
			cells: Array<{
				style?: {
					color?: string;
					colorRef?: { scheme: string };
					backgroundColor?: string;
					backgroundColorRef?: { scheme: string };
					fillMode?: string;
				};
			}>;
		}>;
	};
};

function cellStyle(
	editor: EditorState,
): NonNullable<NonNullable<TableShape['tableData']>['rows'][number]['cells'][number]['style']> {
	const style = (currentEl(editor) as TableShape).tableData?.rows[0]?.cells[0]?.style;
	if (!style) {
		throw new Error('cell style missing');
	}
	return style;
}

function mountSection(editor: EditorState, el: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(TableSection, { target, props: { editor, el } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('tableCellSection theme colour', () => {
	it('clicking a theme swatch on the text colour field commits hex + ref', () => {
		const editor = makeEditor(tableEl());
		const target = mountSection(editor, currentEl(editor));

		const swatches = target.querySelectorAll<HTMLButtonElement>('button[title="Accent 2"]');
		expect(swatches.length).toBeGreaterThanOrEqual(2);
		swatches[0]?.click();
		flushSync();

		const style = cellStyle(editor);
		expect(style.color).toBe('#ed7d31');
		expect(style.colorRef).toStrictEqual({ scheme: 'accent2' });
	});

	it('clicking a theme swatch on the fill colour field commits hex + ref and forces solid fill', () => {
		const editor = makeEditor(tableEl());
		const target = mountSection(editor, currentEl(editor));

		const swatches = target.querySelectorAll<HTMLButtonElement>('button[title="Accent 2"]');
		expect(swatches.length).toBeGreaterThanOrEqual(2);
		swatches[1]?.click();
		flushSync();

		const style = cellStyle(editor);
		expect(style.backgroundColor).toBe('#ed7d31');
		expect(style.backgroundColorRef).toStrictEqual({ scheme: 'accent2' });
		expect(style.fillMode).toBe('solid');
	});

	it('the native text colour input clears a previously-set colorRef', () => {
		const el = tableEl();
		const editor = makeEditor(el);
		const target = mountSection(editor, currentEl(editor));

		const swatch = target.querySelectorAll<HTMLButtonElement>('button[title="Accent 2"]')[0];
		swatch?.click();
		flushSync();
		expect(cellStyle(editor).colorRef).toStrictEqual({ scheme: 'accent2' });

		const textColorInput = target.querySelector<HTMLInputElement>(
			'.colorField input[type="color"]',
		);
		expect(textColorInput).not.toBeNull();
		if (textColorInput) {
			textColorInput.value = '#654321';
			textColorInput.dispatchEvent(new Event('change', { bubbles: true }));
		}
		flushSync();

		const style = cellStyle(editor);
		expect(style.color).toBe('#654321');
		expect(style.colorRef).toBeUndefined();
	});
});
