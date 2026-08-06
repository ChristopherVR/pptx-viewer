/**
 * Regression: mounting the inline editor must place the caret at the END of
 * the seeded text (typing appends), the contract shared by all five bindings
 * via the shared `placeCaretAtEnd`. Focus alone leaves the caret at the start,
 * which is the parity bug this pins.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';

import InlineTextEditor from './InlineTextEditor.svelte';

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

describe('inline text editor caret placement', () => {
	it('collapses the selection to the end of the seeded text on mount', () => {
		const host = document.createElement('div');
		document.body.appendChild(host);

		const component = mount(InlineTextEditor, {
			target: host,
			props: {
				element: textElement(),
				box: { x: 0, y: 0, width: 200, height: 50 },
				scale: 1,
				oncommit: () => {},
				onclose: () => {},
			},
		});
		flushSync();

		const editor = host.querySelector<HTMLElement>('[data-inline-editor]');
		expect(editor).not.toBeNull();
		expect(editor!.textContent).toBe('TARGET');

		const sel = window.getSelection();
		expect(sel).not.toBeNull();
		expect(sel!.rangeCount).toBe(1);
		const range = sel!.getRangeAt(0);
		expect(range.collapsed).toBeTruthy();
		const endsAtEnd =
			(range.endContainer === editor && range.endOffset === editor!.childNodes.length) ||
			(range.endContainer.nodeType === Node.TEXT_NODE &&
				range.endContainer.textContent === 'TARGET' &&
				range.endOffset === 'TARGET'.length);
		expect(endsAtEnd).toBeTruthy();

		unmount(component);
		host.remove();
	});
});
