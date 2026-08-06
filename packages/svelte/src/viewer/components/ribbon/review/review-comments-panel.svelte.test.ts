import type { PptxSlide } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import ReviewCommentsPanel from './ReviewCommentsPanel.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function createEditor(): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 'slide-1', elements: [] } as PptxSlide]);
	return editor;
}

describe('reviewCommentsPanel', () => {
	it('adds, resolves, and removes active-slide comments through editor history', () => {
		const target = document.createElement('div');
		const editor = createEditor();
		const instance = mount(ReviewCommentsPanel, { target, props: { editor } });
		cleanup = () => unmount(instance);

		const textarea = target.querySelector('textarea') as HTMLTextAreaElement;
		textarea.value = 'Check the opening slide';
		textarea.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();
		(target.querySelector('.pptx-svelte-comments-compose button') as HTMLButtonElement).click();
		flushSync();

		expect(editor.slides[0]?.comments?.[0]?.text).toBe('Check the opening slide');
		expect(target.textContent).toContain('Check the opening slide');
		const actionButton = (label: string): HTMLButtonElement =>
			Array.from(
				target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-comment-actions button'),
			).find((button) => button.textContent === label)!;
		actionButton('Resolve').click();
		flushSync();
		expect(editor.slides[0]?.comments?.[0]?.resolved).toBeTruthy();
		actionButton('Remove').click();
		flushSync();
		expect(editor.slides[0]?.comments).toStrictEqual([]);
	});

	it('appends a threaded reply nested under the parent card', () => {
		const target = document.createElement('div');
		const editor = createEditor();
		editor.setSlides([
			{
				id: 'slide-1',
				elements: [],
				comments: [{ id: 'c1', text: 'Parent comment', author: 'Alice' }],
			} as PptxSlide,
		]);
		const instance = mount(ReviewCommentsPanel, { target, props: { editor } });
		cleanup = () => unmount(instance);

		Array.from(target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-comment-actions button'))
			.find((button) => button.textContent === 'Reply')!
			.click();
		flushSync();
		const replyBox = target.querySelector(
			'.pptx-svelte-comment-reply-compose textarea',
		) as HTMLTextAreaElement;
		expect(replyBox.getAttribute('placeholder')).toContain('Reply');
		replyBox.value = 'A threaded reply';
		replyBox.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();
		(target.querySelector('.pptx-svelte-comment-reply-submit') as HTMLButtonElement).click();
		flushSync();

		const parent = editor.slides[0]?.comments?.[0];
		expect(parent?.replies?.[0]).toMatchObject({
			text: 'A threaded reply',
			threadId: 'c1',
			parentId: 'c1',
		});
		// The reply renders nested INSIDE the parent card's replies block.
		expect(target.querySelector('.pptx-svelte-comment-replies')?.textContent).toContain(
			'A threaded reply',
		);
	});
});
