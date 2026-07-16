import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import MediaSection from './MediaSection.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

function editorWith(element: PptxElement): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [element] }]);
	editor.select(element.id);
	return editor;
}

describe('advanced inspector parity', () => {
	it('adds media bookmarks and caption tracks', () => {
		const editor = editorWith({
			type: 'media',
			id: 'm1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			mediaType: 'video',
		} as PptxElement);
		const target = document.createElement('div');
		document.body.appendChild(target);
		const instance = mount(MediaSection, { target, props: { editor } });
		cleanup = () => {
			unmount(instance);
			target.remove();
		};
		flushSync();
		const label = target.querySelector<HTMLInputElement>('input[placeholder="Bookmark label"]');
		if (!label) {
			throw new Error('bookmark label input missing');
		}
		label.value = 'Intro';
		label.dispatchEvent(new Event('input', { bubbles: true }));
		target.querySelector<HTMLButtonElement>('button[aria-label="Add bookmark"]')?.click();
		flushSync();
		const media = editor.selectedElement?.type === 'media' ? editor.selectedElement : undefined;
		expect(media?.bookmarks?.[0]?.label).toBe('Intro');
		const addTrack = Array.from(target.querySelectorAll('button')).find(
			(button) => button.textContent === 'Add caption track',
		);
		addTrack?.click();
		flushSync();
		expect(
			editor.selectedElement?.type === 'media' ? editor.selectedElement.captionTracks : [],
		).toHaveLength(1);
	});
});
