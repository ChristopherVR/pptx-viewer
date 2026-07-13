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
		(target.querySelector('.pptx-svelte-comment-actions button') as HTMLButtonElement).click();
		flushSync();
		expect(editor.slides[0]?.comments?.[0]?.resolved).toBeTruthy();
		(
			target.querySelectorAll('.pptx-svelte-comment-actions button')[1] as HTMLButtonElement
		).click();
		flushSync();
		expect(editor.slides[0]?.comments).toStrictEqual([]);
	});
});
