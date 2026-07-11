import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import TextSection from './TextSection.svelte';

/**
 * TextSection tests: vertical anchor, wrap-in-shape, and autofit mode. The
 * autofit-mode label test in particular pins down the counterintuitive
 * `TextStyle.autoFitMode` mapping: `'shrink'` renders as "Resize shape to fit
 * text" (OOXML `spAutoFit`) and `'normal'` renders as "Shrink text on
 * overflow" (OOXML `normAutofit`) - see `text-advanced.ts`'s module doc.
 * Named `*.svelte.test.ts` so `mountSection`'s props can be wrapped in
 * `$state(...)` (see `notes-panel.svelte.test.ts`).
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function textEl(over: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'text',
		id: 't1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: 'hi',
		textStyle: {},
		...over,
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

type TextStyleShape = {
	textStyle?: { vAlign?: string; textWrap?: string; autoFitMode?: string; autoFit?: boolean };
};

function mountSection(editor: EditorState, el: PptxElement): { target: HTMLElement } {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(TextSection, { target, props: { editor, el } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target };
}

describe('textSection', () => {
	it('defaults vertical align to top', () => {
		const editor = makeEditor(textEl());
		const { target } = mountSection(editor, currentEl(editor));
		const select = target.querySelectorAll<HTMLSelectElement>('select')[0];
		expect(select?.value).toBe('top');
	});

	it('sets vertical align', () => {
		const editor = makeEditor(textEl());
		const { target } = mountSection(editor, currentEl(editor));
		const select = target.querySelectorAll<HTMLSelectElement>('select')[0];
		if (!select) {
			throw new Error('vAlign select not found');
		}
		select.value = 'middle';
		select.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		expect((currentEl(editor) as TextStyleShape).textStyle?.vAlign).toBe('middle');
	});

	it('toggles wrap-in-shape', () => {
		const editor = makeEditor(textEl({ textStyle: { textWrap: 'none' } }));
		const { target } = mountSection(editor, currentEl(editor));
		const checkbox = target.querySelector<HTMLInputElement>('input[type="checkbox"]');
		if (!checkbox) {
			throw new Error('wrap checkbox not found');
		}
		expect(checkbox.checked).toBeFalsy();

		checkbox.click();
		flushSync();
		expect((currentEl(editor) as TextStyleShape).textStyle?.textWrap).toBe('square');
	});

	it('labels the autofit options by what they DO, not by the enum name', () => {
		const editor = makeEditor(textEl());
		const { target } = mountSection(editor, currentEl(editor));
		const autoFitSelect = target.querySelectorAll<HTMLSelectElement>('select')[1];
		const options = Array.from(autoFitSelect?.querySelectorAll('option') ?? []);
		const shrinkOption = options.find((o) => o.value === 'shrink');
		const normalOption = options.find((o) => o.value === 'normal');

		expect(shrinkOption?.textContent).toBe('Resize shape to fit text');
		expect(normalOption?.textContent).toBe('Shrink text on overflow');
	});

	it('sets the autofit mode', () => {
		const editor = makeEditor(textEl());
		const { target } = mountSection(editor, currentEl(editor));
		const autoFitSelect = target.querySelectorAll<HTMLSelectElement>('select')[1];
		if (!autoFitSelect) {
			throw new Error('autofit select not found');
		}
		autoFitSelect.value = 'shrink';
		autoFitSelect.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		const style = (currentEl(editor) as TextStyleShape).textStyle;
		expect(style?.autoFitMode).toBe('shrink');
		expect(style?.autoFit).toBeTruthy();
	});
});
