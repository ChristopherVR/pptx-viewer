import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import { describe, expect, it, vi, afterEach } from 'vitest';

import type { EditorOperations } from './useEditorOperations';
import { useInlineEditing } from './useInlineEditing';

/**
 * Regression test for the `a:spAutoFit` ("Resize shape to fit text") editor
 * behaviour: typing into an autofit text box and committing (blur) must grow
 * or shrink the shape, not just re-segment its text.
 *
 * `commitInlineEdit` looks up the still-mounted editor node via
 * `document.querySelector('[data-inline-editor]')`, exactly as
 * `InlineTextEditor.vue` renders it, so this test seeds a real DOM node with
 * that attribute rather than mocking the lookup away - the DOM query itself
 * is the binding-specific part `shape-autofit-resize.test.ts`'s
 * `resolveInlineEditAutoFitHeight` suite cannot cover.
 */

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

afterEach(() => {
	if (originalScrollHeightDescriptor) {
		Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeightDescriptor);
		originalScrollHeightDescriptor = undefined;
	}
	document.body.innerHTML = '';
});

function makeElement(textStyle: TextStyle = { autoFitMode: 'shrink' }): PptxElement {
	return {
		id: 'text-1',
		type: 'text',
		x: 0,
		y: 0,
		width: 300,
		height: 40,
		text: 'Box A',
		textSegments: [{ text: 'Box A', style: {} }],
		textStyle,
	} as unknown as PptxElement;
}

function mountEditorNode(): HTMLElement {
	const editorEl = document.createElement('div');
	editorEl.setAttribute('data-inline-editor', '');
	editorEl.setAttribute('contenteditable', 'true');
	document.body.appendChild(editorEl);
	return editorEl;
}

describe('commitInlineEdit - spAutoFit editor resize', () => {
	it('grows the shape to the measured content height on commit', () => {
		mountEditorNode();
		stubScrollHeight(250);
		const element = makeElement();
		const updateElement = vi.fn();
		const editing = useInlineEditing({
			canEdit: () => true,
			findActiveElement: (id) => (id === element.id ? element : undefined),
			ops: { updateElement } as unknown as EditorOperations,
		});

		editing.enterInlineEdit(element.id);
		editing.updateInlineText('A much longer line of text that wraps to several lines');
		editing.commitInlineEdit();

		expect(updateElement).toHaveBeenCalledOnce();
		expect(updateElement.mock.calls[0][1]).toMatchObject({ height: 250 });
	});

	it('does not touch height for normAutofit (font-shrink mode)', () => {
		mountEditorNode();
		stubScrollHeight(250);
		const element = makeElement({ autoFitMode: 'normal' });
		const updateElement = vi.fn();
		const editing = useInlineEditing({
			canEdit: () => true,
			findActiveElement: (id) => (id === element.id ? element : undefined),
			ops: { updateElement } as unknown as EditorOperations,
		});

		editing.enterInlineEdit(element.id);
		editing.updateInlineText('Some text');
		editing.commitInlineEdit();

		expect(updateElement).toHaveBeenCalledOnce();
		expect(updateElement.mock.calls[0][1]).not.toHaveProperty('height');
	});

	it('does not touch height for a shape with no autofit at all', () => {
		mountEditorNode();
		stubScrollHeight(250);
		const element = makeElement({});
		const updateElement = vi.fn();
		const editing = useInlineEditing({
			canEdit: () => true,
			findActiveElement: (id) => (id === element.id ? element : undefined),
			ops: { updateElement } as unknown as EditorOperations,
		});

		editing.enterInlineEdit(element.id);
		editing.updateInlineText('Some text');
		editing.commitInlineEdit();

		expect(updateElement).toHaveBeenCalledOnce();
		expect(updateElement.mock.calls[0][1]).not.toHaveProperty('height');
	});
});
