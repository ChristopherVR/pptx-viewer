import type { PptxComment } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import CommentReplyThread from './CommentReplyThread.svelte';

/**
 * Wave-4 B5: replies render RECURSIVELY, at any depth. `PptxComment.replies`
 * is itself `PptxComment[]`, so a legacy `p:cmLst` comment core now nests the
 * same way modern ones always were can carry a reply-of-a-reply; the panel
 * used to unroll only one level.
 */

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountThread(replies: PptxComment[]): HTMLElement {
	const target = document.createElement('div');
	const instance = mount(CommentReplyThread, { target, props: { replies } });
	flushSync();
	cleanup = () => unmount(instance);
	return target;
}

describe('commentReplyThread', () => {
	it('renders nothing for an empty list', () => {
		const target = mountThread([]);
		expect(target.querySelector('.pptx-svelte-comment-replies')).toBeNull();
	});

	it('renders a single level of replies', () => {
		const target = mountThread([{ id: 'r1', text: 'first reply', author: 'Alice' } as PptxComment]);
		expect(target.textContent).toContain('first reply');
		expect(target.textContent).toContain('Alice');
	});

	it('renders a grandchild reply nested three levels deep', () => {
		const replies: PptxComment[] = [
			{
				id: 'r1',
				text: 'level one',
				author: 'Alice',
				replies: [
					{
						id: 'r2',
						text: 'level two',
						author: 'Bob',
						replies: [{ id: 'r3', text: 'level three', author: 'Carol' } as PptxComment],
					} as PptxComment,
				],
			} as PptxComment,
		];
		const target = mountThread(replies);
		expect(target.textContent).toContain('level one');
		expect(target.textContent).toContain('level two');
		expect(target.textContent).toContain('level three');
		// Nested three deep: the outer .pptx-svelte-comment-replies contains two
		// further nested instances of itself.
		const nested = target.querySelectorAll('.pptx-svelte-comment-replies');
		expect(nested).toHaveLength(3);
	});
});
