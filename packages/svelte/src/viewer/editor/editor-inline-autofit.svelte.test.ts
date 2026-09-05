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

/**
 * Regression test for the `a:normAutofit` ("Shrink text on overflow") editor
 * behaviour: typing past capacity must recompute
 * `autoFitFontScale`/`autoFitLineSpacingReduction`, not leave the stale
 * authored value on the element forever.
 */
describe('commitInlineText - normAutofit editor font shrink', () => {
	it('shrinks fontScale/lnSpcReduction when the text overflows the box', () => {
		mountEditorNode();
		// jsdom's stubbed scrollHeight cannot vary per candidate step, so every
		// rung in the staircase measures as "still overflowing" and the
		// decision lands on the smallest (floor) rung.
		stubScrollHeight(400);
		const editor = make();
		editor.setSlides([slide('a', [shape('e1', { textStyle: { autoFitMode: 'normal' } })])]);

		editor.commitInlineText('e1', 'a very long line of text that overflows the box');

		expect(editor.slides[0].elements[0].textStyle).toMatchObject({
			autoFitFontScale: 0.25,
			autoFitLineSpacingReduction: 0.2,
		});
	});

	it('does not touch textStyle for spAutoFit (shape-resize mode)', () => {
		mountEditorNode();
		stubScrollHeight(250);
		const editor = make();
		editor.setSlides([slide('a', [shape('e1')])]);

		editor.commitInlineText('e1', 'a much longer line of text than before');

		expect(editor.slides[0].elements[0].textStyle).toStrictEqual({ autoFitMode: 'shrink' });
	});

	it('leaves textStyle alone when the (stubbed) content already fits the box', () => {
		mountEditorNode();
		stubScrollHeight(5);
		const editor = make();
		editor.setSlides([slide('a', [shape('e1', { textStyle: { autoFitMode: 'normal' } })])]);

		editor.commitInlineText('e1', 'short');

		expect(editor.slides[0].elements[0].textStyle).toStrictEqual({ autoFitMode: 'normal' });
	});
});
