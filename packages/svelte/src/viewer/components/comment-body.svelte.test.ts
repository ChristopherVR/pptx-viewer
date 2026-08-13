import type { PptxCommentMention } from 'pptx-viewer-core';
import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import CommentBody from './CommentBody.svelte';

const BOB = '{2CB2E9D0-D392-EB21-5D46-FBA34C1295E6}';

const mentions: PptxCommentMention[] = [
	{ personId: BOB, authorName: 'Bob Example', startIndex: 3, length: 11 },
];

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function render(props: { text: string; mentions?: PptxCommentMention[] }): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const component = mount(CommentBody, { target, props });
	cleanup = () => {
		unmount(component);
		target.remove();
	};
	return target;
}

describe('commentBody', () => {
	it('renders an @-mention as a distinct, attributed span', () => {
		const target = render({ text: 'Hi Bob Example can you check this', mentions });
		const mention = target.querySelector('[data-pptx-comment-mention]');
		expect(mention).not.toBeNull();
		expect(mention?.textContent).toBe('Bob Example');
		expect(mention?.getAttribute('data-pptx-comment-mention')).toBe(BOB);
		expect(mention?.getAttribute('title')).toBe('Bob Example');
		expect(mention?.classList.contains('pptx-comment-mention')).toBeTruthy();
		expect(target.textContent).toBe('Hi Bob Example can you check this');
	});

	it('renders a body with no mentions as plain text', () => {
		const target = render({ text: 'Nothing to see' });
		expect(target.querySelector('[data-pptx-comment-mention]')).toBeNull();
		expect(target.textContent).toBe('Nothing to see');
	});
});
