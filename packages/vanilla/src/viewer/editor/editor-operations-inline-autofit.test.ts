import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import { createEditorOps } from './editor-operations';

/**
 * Regression test for the `a:spAutoFit` ("Resize shape to fit text") editor
 * behaviour: committing an inline edit on an autofit text box must grow or
 * shrink the shape, not just rewrite its text.
 *
 * `EditorOperations.commitInlineText` looks up the still-mounted editor node
 * via `document.querySelector('[data-inline-editor]')`. That only resolves
 * because `inline-text-editor.ts`'s `close()` now fires `onCommit` (the call
 * that reaches here) BEFORE removing the surface - this pins that ordering
 * too, since it silently regresses to "never resizes" if reverted.
 */

function shape(id: string, over: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id,
		x: 0,
		y: 0,
		width: 300,
		height: 40,
		text: 'hi',
		textStyle: { autoFitMode: 'shrink' },
		...over,
	} as PptxElement;
}

function buildSlide(id: string, elements: PptxElement[]): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements, notes: '' };
}

function makeOps(elements: PptxElement[]) {
	const store = createStore({
		...createInitialViewerState(),
		slides: [buildSlide('a', elements)],
		currentSlide: 0,
		editable: true,
	});
	const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
	return { store, ops };
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

describe('createEditorOps commitInlineText - spAutoFit editor resize', () => {
	it('grows the shape to the measured content height on commit', () => {
		mountEditorNode();
		stubScrollHeight(250);
		const { store, ops } = makeOps([shape('e1')]);

		ops.commitInlineText('e1', 'a much longer line of text than before');

		expect(store.get().slides[0].elements[0].height).toBe(250);
	});

	it('does not touch height for normAutofit (font-shrink mode)', () => {
		mountEditorNode();
		stubScrollHeight(250);
		const { store, ops } = makeOps([shape('e1', { textStyle: { autoFitMode: 'normal' } })]);

		ops.commitInlineText('e1', 'some text');

		expect(store.get().slides[0].elements[0].height).toBe(40);
	});

	it('does not touch height for a shape with no autofit at all', () => {
		mountEditorNode();
		stubScrollHeight(250);
		const { store, ops } = makeOps([shape('e1', { textStyle: {} })]);

		ops.commitInlineText('e1', 'some text');

		expect(store.get().slides[0].elements[0].height).toBe(40);
	});
});
