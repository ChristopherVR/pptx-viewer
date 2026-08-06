// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { placeCaretAtEnd } from './inline-caret';

describe('placeCaretAtEnd', () => {
	it('collapses the selection to the end of the content', () => {
		const el = document.createElement('div');
		el.contentEditable = 'true';
		el.textContent = 'TARGET';
		document.body.appendChild(el);

		placeCaretAtEnd(el);

		const sel = window.getSelection();
		expect(sel).not.toBeNull();
		expect(sel!.rangeCount).toBe(1);
		const range = sel!.getRangeAt(0);
		expect(range.collapsed).toBeTruthy();
		// The caret sits after the last character of the seeded text.
		expect(range.endContainer === el || range.endContainer === el.firstChild).toBeTruthy();
		if (range.endContainer === el.firstChild) {
			expect(range.endOffset).toBe('TARGET'.length);
		} else {
			expect(range.endOffset).toBe(el.childNodes.length);
		}
		el.remove();
	});

	it('handles multi-node content by collapsing after the last child', () => {
		const el = document.createElement('div');
		for (const part of ['one', 'two']) {
			const span = document.createElement('span');
			span.textContent = part;
			el.appendChild(span);
		}
		document.body.appendChild(el);

		placeCaretAtEnd(el);

		const range = window.getSelection()!.getRangeAt(0);
		expect(range.collapsed).toBeTruthy();
		expect(range.endContainer).toBe(el);
		expect(range.endOffset).toBe(2);
		el.remove();
	});

	it('is a no-op on an empty selection-less document (no throw)', () => {
		const el = document.createElement('div');
		document.body.appendChild(el);
		expect(() => placeCaretAtEnd(el)).not.toThrow();
		el.remove();
	});
});
