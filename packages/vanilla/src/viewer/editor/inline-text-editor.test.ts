// @vitest-environment jsdom
/**
 * Regression: opening the inline editor must place the caret at the END of the
 * seeded text (typing appends), the contract shared by all five bindings via
 * `placeCaretAtEnd`. Focus alone leaves the caret at the start, which is the
 * parity bug this pins.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { openInlineEditor } from './inline-text-editor';

function textElement(): PptxElement {
	return {
		id: 'el-1',
		type: 'text',
		x: 0,
		y: 0,
		width: 200,
		height: 50,
		text: 'TARGET',
		textSegments: [{ text: 'TARGET', style: {} }],
	} as unknown as PptxElement;
}

describe('openInlineEditor caret placement', () => {
	it('collapses the selection to the end of the seeded text', () => {
		const overlayRoot = document.createElement('div');
		document.body.appendChild(overlayRoot);

		const session = openInlineEditor({
			doc: document,
			overlayRoot,
			box: { x: 0, y: 0, width: 200, height: 50, rotation: 0 },
			scale: 1,
			element: textElement(),
			onCommit: () => {},
			onClose: () => {},
		});

		const sel = window.getSelection();
		expect(sel).not.toBeNull();
		expect(sel!.rangeCount).toBe(1);
		const range = sel!.getRangeAt(0);
		expect(range.collapsed).toBeTruthy();
		// End position: after the last child (segment span) of the surface, or at
		// the end of its trailing text node.
		const endsAtEnd =
			(range.endContainer === session.el && range.endOffset === session.el.childNodes.length) ||
			(range.endContainer.nodeType === Node.TEXT_NODE &&
				range.endContainer.textContent === 'TARGET' &&
				range.endOffset === 'TARGET'.length);
		expect(endsAtEnd).toBeTruthy();

		session.cancel();
		overlayRoot.remove();
	});
});

describe('openInlineEditor commit ordering', () => {
	it('fires onCommit while the surface is still attached and [data-inline-editor]-tagged', () => {
		// `a:spAutoFit` needs to measure the live editor node from inside
		// `onCommit` (see `resolveInlineTextAutoFitHeight`'s doc comment); a
		// node already `.remove()`d reports `offsetWidth: 0`, breaking that
		// measurement. This pins the ordering that makes it work: commit
		// before removal.
		const overlayRoot = document.createElement('div');
		document.body.appendChild(overlayRoot);
		let attachedDuringCommit: boolean | undefined;
		let foundDuringCommit: Element | null | undefined;

		const session = openInlineEditor({
			doc: document,
			overlayRoot,
			box: { x: 0, y: 0, width: 200, height: 50, rotation: 0 },
			scale: 1,
			element: textElement(),
			onCommit: () => {
				attachedDuringCommit = document.body.contains(session.el);
				foundDuringCommit = document.querySelector('[data-inline-editor]');
			},
			onClose: () => {},
		});

		session.el.textContent = 'CHANGED';
		session.commit();

		expect(attachedDuringCommit).toBeTruthy();
		expect(foundDuringCommit).toBe(session.el);
		// ...and is removed once the commit callback returns.
		expect(document.body.contains(session.el)).toBeFalsy();

		overlayRoot.remove();
	});
});
