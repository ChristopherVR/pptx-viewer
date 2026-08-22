import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, afterEach } from 'vitest';

import { resolveCommitTextAutoFitHeight } from './inline-edit-autofit-commit';

/**
 * Regression test for the `a:spAutoFit` ("Resize shape to fit text") editor
 * behaviour: typing into an autofit text box and committing (blur) must grow
 * or shrink the shape, not just replace its text.
 *
 * Angular's inline editor is a plain `<textarea>` (`slide-canvas.component.html`),
 * and `SlideCanvasComponent#commitText` already holds it directly as
 * `event.target` - no separate `[data-inline-editor]` DOM query needed, unlike
 * React/Vue. This tests the exact composition that handler performs.
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
});

function makeTextElement(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 'tx_1',
		type: 'text',
		x: 0,
		y: 0,
		width: 300,
		height: 40,
		text: 'Hello',
		textStyle: { autoFitMode: 'shrink' },
		...overrides,
	} as unknown as PptxElement;
}

describe('resolveCommitTextAutoFitHeight', () => {
	it('grows the shape to the measured content height for spAutoFit', () => {
		stubScrollHeight(250);
		const editor = document.createElement('textarea');
		const result = resolveCommitTextAutoFitHeight([makeTextElement()], 'tx_1', editor);
		expect(result).toBe(250);
	});

	it('never resizes for normAutofit (font-shrink mode)', () => {
		stubScrollHeight(250);
		const editor = document.createElement('textarea');
		const el = makeTextElement({ textStyle: { autoFitMode: 'normal' } });
		expect(resolveCommitTextAutoFitHeight([el], 'tx_1', editor)).toBeUndefined();
	});

	it('never resizes a shape with no autofit at all', () => {
		stubScrollHeight(250);
		const editor = document.createElement('textarea');
		const el = makeTextElement({ textStyle: {} });
		expect(resolveCommitTextAutoFitHeight([el], 'tx_1', editor)).toBeUndefined();
	});

	it('returns undefined when the element cannot be found (e.g. deleted mid-edit)', () => {
		stubScrollHeight(250);
		const editor = document.createElement('textarea');
		expect(resolveCommitTextAutoFitHeight([makeTextElement()], 'missing', editor)).toBeUndefined();
	});

	it('returns undefined for an element with no text properties (e.g. a table)', () => {
		stubScrollHeight(250);
		const editor = document.createElement('textarea');
		const el = { id: 'tbl_1', type: 'table', x: 0, y: 0, width: 100, height: 40 } as PptxElement;
		expect(resolveCommitTextAutoFitHeight([el], 'tbl_1', editor)).toBeUndefined();
	});
});
