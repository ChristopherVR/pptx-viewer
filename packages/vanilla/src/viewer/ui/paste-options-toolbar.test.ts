/**
 * The Paste Options toolbar is painted from the store subscription, which runs
 * in the same tick as the paste, before the stage has rendered the pasted
 * element. It used to give up when that node was missing, so an ordinary
 * paste never showed the toolbar in the vanilla demo.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ViewerState } from '../state';
import { createStore } from '../state/store';
import { mountPasteOptionsToolbar } from './paste-options-toolbar';

afterEach(() => {
	document.body.innerHTML = '';
	vi.useRealTimers();
});

function nextFrame(): Promise<void> {
	return new Promise((resolve) => {
		requestAnimationFrame(() => {
			resolve();
		});
	});
}

/** The main-canvas container; a thumbnail copy outside it must not anchor the toolbar. */
function canvas(): HTMLElement {
	let viewport = document.querySelector<HTMLElement>('[data-pptx-viewport]');
	if (!viewport) {
		viewport = document.createElement('div');
		viewport.setAttribute('data-pptx-viewport', '');
		document.body.appendChild(viewport);
	}
	return viewport;
}

function mount() {
	const store = createStore({ pasteOptionsToolbar: null } as unknown as ViewerState);
	const handle = mountPasteOptionsToolbar({
		doc: document,
		store,
		getTranslator: () => (key: string) => key,
		onChoose: vi.fn(),
	});
	return { store, handle };
}

describe('paste options toolbar', () => {
	it('appears once the pasted element renders, even a frame after the paste', async () => {
		const { store, handle } = mount();
		store.set({
			pasteOptionsToolbar: [{ id: 'pasted-1', sourceClone: {} as PptxElement }],
		});
		// The stage has not rendered the pasted element yet; the slides-pane
		// thumbnail (outside the canvas) already has, and must not be used.
		const thumbnail = document.createElement('div');
		thumbnail.setAttribute('data-element-id', 'pasted-1');
		document.body.appendChild(thumbnail);
		await nextFrame();
		expect(document.querySelector('[data-pptx-paste-options]')).toBeNull();

		const node = document.createElement('div');
		node.setAttribute('data-element-id', 'pasted-1');
		canvas().appendChild(node);
		await nextFrame();
		await nextFrame();

		expect(document.querySelector('[data-pptx-paste-options]')).not.toBeNull();
		handle.destroy();
	});

	it('stops waiting once the toolbar is cleared', async () => {
		const { store, handle } = mount();
		store.set({
			pasteOptionsToolbar: [{ id: 'pasted-2', sourceClone: {} as PptxElement }],
		});
		store.set({ pasteOptionsToolbar: null });
		const node = document.createElement('div');
		node.setAttribute('data-element-id', 'pasted-2');
		canvas().appendChild(node);
		await nextFrame();

		expect(document.querySelector('[data-pptx-paste-options]')).toBeNull();
		handle.destroy();
	});
});
