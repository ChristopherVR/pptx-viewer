import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import FontExtrasGroup from './FontExtrasGroup.svelte';

/**
 * W3-G2: the ribbon's font-colour popover shows the deck's REAL "Theme
 * Colors" grid (via `SwatchColorPicker`'s `themeColorMap`/`onselectTheme`)
 * and commits both the resolved hex and the theme ref.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function textEl(): PptxElement {
	return {
		type: 'text',
		id: 't1',
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		text: 'hi',
		textStyle: { color: '#111111' },
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

function mountGroup(editor: EditorState): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(FontExtrasGroup, { target, props: { editor } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('fontExtrasGroup theme font colour (W3-G2)', () => {
	it('clicking the font-colour trigger then a theme swatch commits both hex and ref', () => {
		const editor = makeEditor(textEl());
		const target = mountGroup(editor);

		const trigger = target.querySelector<HTMLButtonElement>(
			'.pptx-svelte-swatch-trigger[aria-label="Font Color"]',
		);
		expect(trigger).not.toBeNull();
		trigger?.click();
		flushSync();

		const swatch = target.querySelector<HTMLButtonElement>('button[title="Accent 2"]');
		expect(swatch).not.toBeNull();
		swatch?.click();
		flushSync();

		const el = currentEl(editor) as {
			textStyle?: { color?: string; colorRef?: { scheme: string } };
		};
		expect(el.textStyle?.color).toBe('#ed7d31');
		expect(el.textStyle?.colorRef).toStrictEqual({ scheme: 'accent2' });
	});
});
