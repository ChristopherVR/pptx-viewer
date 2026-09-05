import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import TextSection from './TextSection.svelte';

/**
 * Inspector text colour: `TextSection` shows the deck's real "Theme Colors"
 * grid below the native colour input, mirroring the ribbon font-colour
 * control (`FontExtrasGroup`) and React's `ShapeTextPanels`. A theme swatch
 * commits both the resolved hex and its `PptxThemeColorRef`; the native
 * colour input always clears the ref.
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
		textStyle: { color: '#111111' },
		...over,
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

type TextStyleShape = {
	textStyle?: { color?: string; colorRef?: { scheme: string } };
};

function mountSection(editor: EditorState, el: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(TextSection, { target, props: { editor, el } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('textSection theme colour', () => {
	it('clicking a theme swatch commits both the hex and the ref', () => {
		const editor = makeEditor(textEl());
		const target = mountSection(editor, currentEl(editor));

		const swatch = target.querySelector<HTMLButtonElement>('button[title="Accent 2"]');
		expect(swatch).not.toBeNull();
		swatch?.click();
		flushSync();

		const style = (currentEl(editor) as TextStyleShape).textStyle;
		expect(style?.color).toBe('#ed7d31');
		expect(style?.colorRef).toStrictEqual({ scheme: 'accent2' });
	});

	it('the native colour input clears a previously-set colorRef', () => {
		const editor = makeEditor(textEl());
		const target = mountSection(editor, currentEl(editor));

		const swatch = target.querySelector<HTMLButtonElement>('button[title="Accent 2"]');
		swatch?.click();
		flushSync();
		expect((currentEl(editor) as TextStyleShape).textStyle?.colorRef).toStrictEqual({
			scheme: 'accent2',
		});

		const colorInput = target.querySelector<HTMLInputElement>('.pptx-svelte-text-color');
		expect(colorInput).not.toBeNull();
		if (colorInput) {
			colorInput.value = '#654321';
			colorInput.dispatchEvent(new Event('change', { bubbles: true }));
		}
		flushSync();

		const style = (currentEl(editor) as TextStyleShape).textStyle;
		expect(style?.color).toBe('#654321');
		expect(style?.colorRef).toBeUndefined();
	});
});
