import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import { createSlideBackgroundActions } from './editor-background-actions';
import { createEditorOps } from './editor-operations';

function buildSlide(id: string): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements: [] };
}

describe('createSlideBackgroundActions', () => {
	it('sets the current slide background colour and records history when editable', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a')],
			currentSlide: 0,
			editable: true,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createSlideBackgroundActions({ store, ops });

		actions.setSlideBackgroundColor('#ff0000');

		expect(store.get().slides[0].backgroundColor).toBe('#ff0000');
		expect(store.get().dirty).toBeTruthy();
		expect(ops.canUndo()).toBeTruthy();

		ops.undo();
		expect(store.get().slides[0].backgroundColor).toBeUndefined();
	});

	it('clears every background field on the current slide', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [
				{
					...buildSlide('a'),
					backgroundColor: '#ff0000',
					backgroundImage: 'data:image/png;base64,x',
					backgroundGradient: 'linear-gradient(#fff, #000)',
				},
			],
			currentSlide: 0,
			editable: true,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createSlideBackgroundActions({ store, ops });

		actions.clearSlideBackground();

		const slide = store.get().slides[0];
		expect(slide.backgroundColor).toBeUndefined();
		expect(slide.backgroundImage).toBeUndefined();
		expect(slide.backgroundGradient).toBeUndefined();
	});

	it('only touches the current slide, leaving others untouched', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a'), buildSlide('b')],
			currentSlide: 1,
			editable: true,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createSlideBackgroundActions({ store, ops });

		actions.setSlideBackgroundColor('#00ff00');

		expect(store.get().slides[0].backgroundColor).toBeUndefined();
		expect(store.get().slides[1].backgroundColor).toBe('#00ff00');
	});

	it('is a no-op when the viewer is not editable', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a')],
			currentSlide: 0,
			editable: false,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createSlideBackgroundActions({ store, ops });

		actions.setSlideBackgroundColor('#ff0000');

		expect(store.get().slides[0].backgroundColor).toBeUndefined();
		expect(ops.canUndo()).toBeFalsy();
	});
});
