import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { attachEditorImagePaste } from 'pptx-viewer-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import { attachCanvasImagePaste } from './editor-image-paste';

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => ({
	...(await importOriginal()),
	attachEditorImagePaste: vi.fn(),
}));
const cleanups: (() => void)[] = [];
let detach = vi.fn();
beforeEach(() => {
	detach = vi.fn();
	vi.mocked(attachEditorImagePaste).mockReset().mockReturnValue(detach);
});
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) {
		cleanup();
	}
});

function setup() {
	const slides: PptxSlide[] = [
		{ id: 'slide-1', rId: 'rId1', slideNumber: 1, elements: [] },
		{ id: 'slide-2', rId: 'rId2', slideNumber: 2, elements: [] },
	];
	const store = createStore({
		...createInitialViewerState(),
		editable: true,
		slides,
	});
	const root = document.createElement('div');
	const canvas = document.createElement('div');
	const insertElement = vi.fn();
	const isEditing = vi.fn(() => false);
	const handler = {} as PptxHandler;
	const dispose = attachCanvasImagePaste(root, canvas, {
		store,
		getHandler: () => handler,
		isEditing,
		insertElement,
	});
	cleanups.push(dispose);
	return {
		store,
		root,
		canvas,
		insertElement,
		isEditing,
		dispose,
		options: () => vi.mocked(attachEditorImagePaste).mock.lastCall![1],
	};
}

describe('attachCanvasImagePaste', () => {
	it('uses the existing insertion command and active canvas', () => {
		const editor = setup();
		expect(editor.options().insertElement).toBe(editor.insertElement);
		expect(editor.options().getCanvas()).toBe(editor.canvas);
		expect(editor.options().getTarget()).toMatchObject({ slideId: 'slide-1' });
	});

	it.each([
		{ editable: false },
		{ loading: true },
		{ error: 'failure' },
		{ presenting: true },
		{ editTemplateMode: true },
		{ drawTool: 'pen' as const },
		{ masterViewTarget: { masterIndex: 0, layoutIndex: null } },
	])('leaves state %j ineligible without dropping root ownership', (patch) => {
		const editor = setup();
		editor.store.set(patch);
		expect(editor.options().getTarget()).toBeNull();
		expect(attachEditorImagePaste).toHaveBeenCalledTimes(2);
	});

	it.each(['permission', 'load', 'slide'])('disposes on synchronous %s away-and-back', (change) => {
		const editor = setup();
		if (change === 'permission') {
			editor.store.set({ editable: false });
			editor.store.set({ editable: true });
		}
		if (change === 'load') {
			editor.store.set({ loading: true });
			editor.store.set({ loading: false });
		}
		if (change === 'slide') {
			editor.store.set({ currentSlide: 1 });
			editor.store.set({ currentSlide: 0 });
		}
		expect(detach).toHaveBeenCalledTimes(2);
	});

	it('rechecks live inline editing and removes its subscription on detach', () => {
		const editor = setup();
		editor.isEditing.mockReturnValue(true);
		expect(editor.options().getTarget()).toBeNull();
		editor.dispose();
		editor.store.set({ currentSlide: 1 });
		expect(detach).toHaveBeenCalledOnce();
	});

	it('does not cancel on an ordinary same-slide element edit', () => {
		const editor = setup();
		editor.store.set({ slides: editor.store.get().slides.map((slide) => ({ ...slide })) });
		expect(detach).not.toHaveBeenCalled();
	});
});
