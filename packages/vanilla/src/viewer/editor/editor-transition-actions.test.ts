import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import { createEditorOps } from './editor-operations';
import { createTransitionActions } from './editor-transition-actions';

function buildSlide(id: string): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements: [] };
}

describe('createTransitionActions', () => {
	it('assigns a transition to the current slide only, with history', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a'), buildSlide('b')],
			currentSlide: 0,
			editable: true,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createTransitionActions({ store, ops });

		actions.applyTransition('fade', 700, false);

		expect(store.get().slides[0].transition).toStrictEqual({ type: 'fade', durationMs: 700 });
		expect(store.get().slides[1].transition).toBeUndefined();
		expect(store.get().dirty).toBeTruthy();
		expect(ops.canUndo()).toBeTruthy();

		ops.undo();
		expect(store.get().slides[0].transition).toBeUndefined();
	});

	it('preserves existing advanced fields (e.g. direction) when re-applying a type/duration', () => {
		const existingTransition: PptxSlideTransition = { type: 'push', direction: 'l' };
		const store = createStore({
			...createInitialViewerState(),
			slides: [{ ...buildSlide('a'), transition: existingTransition }],
			currentSlide: 0,
			editable: true,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createTransitionActions({ store, ops });

		actions.applyTransition('wipe', 500, false);

		expect(store.get().slides[0].transition).toStrictEqual({
			type: 'wipe',
			direction: 'l',
			durationMs: 500,
		});
	});

	it('applies the same fresh transition to every slide when applyToAll is true', () => {
		const existingTransition: PptxSlideTransition = { type: 'push', direction: 'l' };
		const store = createStore({
			...createInitialViewerState(),
			slides: [
				{ ...buildSlide('a'), transition: existingTransition },
				buildSlide('b'),
				buildSlide('c'),
			],
			currentSlide: 1,
			editable: true,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createTransitionActions({ store, ops });

		actions.applyTransition('dissolve', 1200, true);

		for (const slide of store.get().slides) {
			expect(slide.transition).toStrictEqual({ type: 'dissolve', durationMs: 1200 });
		}
	});

	it('clamps a negative duration to zero and rounds fractional ms', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a')],
			currentSlide: 0,
			editable: true,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createTransitionActions({ store, ops });

		actions.applyTransition('fade', -5, false);
		expect(store.get().slides[0].transition?.durationMs).toBe(0);

		actions.applyTransition('fade', 123.6, false);
		expect(store.get().slides[0].transition?.durationMs).toBe(124);
	});

	it('is a no-op when the viewer is not editable', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a')],
			currentSlide: 0,
			editable: false,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createTransitionActions({ store, ops });

		actions.applyTransition('fade', 700, false);

		expect(store.get().slides[0].transition).toBeUndefined();
		expect(ops.canUndo()).toBeFalsy();
	});
});
