import type { PptxElement, PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditorState } from './editor-state.svelte';

/**
 * Regression test for the `a:spAutoFit` ("Resize shape to fit text") editor
 * behaviour: committing an inline edit on an autofit text box must grow or
 * shrink the shape, not just rewrite its text.
 *
 * `EditorElementController#commitInlineText` looks up the still-mounted
 * editor node via `document.querySelector('[data-inline-editor]')` (see
 * `resolveInlineTextAutoFitHeight`'s doc comment for why that still resolves
 * at commit time), so this seeds a real DOM node with that attribute rather
 * than mocking the lookup away.
 *
 * `.svelte.test.ts` (not `.test.ts`): `EditorState` is a runes class and
 * needs the runes compiler, matching `editor-state.svelte.test.ts`.
 */

function shape(id: string, over: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'shape',
		id,
		x: 10,
		y: 20,
		width: 300,
		height: 40,
		rotation: 0,
		text: 'hi',
		textStyle: { autoFitMode: 'shrink' },
		...over,
	} as PptxElement;
}

function slide(id: string, elements: PptxElement[]): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements, notes: '' };
}

function make() {
	const handler = {
		save: vi.fn(async (_slides: PptxSlide[]) => new Uint8Array([1, 2, 3])),
	} as unknown as PptxHandler;
	const editor = new EditorState({
		getCurrent: () => 0,
		getHandler: () => handler,
		onChange: vi.fn(),
	});
	editor.editable = true;
	return editor;
}

let originalScrollHeightDescriptor: PropertyDescriptor | undefined;

function stubScrollHeight(value: number): void {
	originalScrollHeightDescriptor = Object.getOwnPropertyDescriptor(
		HTMLElement.prototype,
		'scrollHeight',
	);
	Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
		configurable: true,
		get: () => value,
	});
}

function mountEditorNode(): HTMLElement {
	const el = document.createElement('div');
	el.setAttribute('data-inline-editor', '');
	el.setAttribute('contenteditable', 'true');
	document.body.appendChild(el);
	return el;
}

afterEach(() => {
	if (originalScrollHeightDescriptor) {
		Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeightDescriptor);
		originalScrollHeightDescriptor = undefined;
	}
	document.body.innerHTML = '';
});

describe('commitInlineText - spAutoFit editor resize', () => {
	it('grows the shape to the measured content height on commit', () => {
		mountEditorNode();
		stubScrollHeight(250);
		const editor = make();
		editor.setSlides([slide('a', [shape('e1')])]);

		editor.commitInlineText('e1', 'a much longer line of text than before');

		expect(editor.slides[0].elements[0].height).toBe(250);
	});

	it('does not touch height for normAutofit (font-shrink mode)', () => {
		mountEditorNode();
		stubScrollHeight(250);
		const editor = make();
		editor.setSlides([slide('a', [shape('e1', { textStyle: { autoFitMode: 'normal' } })])]);

		editor.commitInlineText('e1', 'some text');

		expect(editor.slides[0].elements[0].height).toBe(40);
	});

	it('does not touch height for a shape with no autofit at all', () => {
		mountEditorNode();
		stubScrollHeight(250);
		const editor = make();
		editor.setSlides([slide('a', [shape('e1', { textStyle: {} })])]);

		editor.commitInlineText('e1', 'some text');

		expect(editor.slides[0].elements[0].height).toBe(40);
	});
});
