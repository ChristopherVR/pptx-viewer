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

	it('applyTransitionDraft writes the whole ribbon draft onto the active slide', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a'), buildSlide('b')],
			currentSlide: 0,
			editable: true,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createTransitionActions({ store, ops });

		actions.applyTransitionDraft(
			{
				type: 'push',
				durationSec: 1.25,
				advanceOnClick: false,
				advanceAfter: true,
				advanceAfterText: '00:03.00',
			},
			false,
		);

		expect(store.get().slides[0].transition).toMatchObject({
			type: 'push',
			durationMs: 1250,
			advanceOnClick: false,
			advanceAfterMs: 3000,
		});
		expect(store.get().slides[1].transition).toBeUndefined();
		ops.undo();
		expect(store.get().slides[0].transition).toBeUndefined();
	});

	it('applyTransitionDraft clears a timed advance when the After box is unticked', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [
				{
					...buildSlide('a'),
					transition: { type: 'fade', advanceAfterMs: 4000 } satisfies PptxSlideTransition,
				},
			],
			currentSlide: 0,
			editable: true,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createTransitionActions({ store, ops });

		actions.applyTransitionDraft(
			{
				type: 'fade',
				durationSec: 0.7,
				advanceOnClick: true,
				advanceAfter: false,
				advanceAfterText: '00:00.00',
			},
			false,
		);

		expect(store.get().slides[0].transition?.advanceAfterMs).toBeUndefined();
	});

	it('applyTransitionDraft copies the active slide transition to every slide on Apply to All', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [
				buildSlide('a'),
				{
					...buildSlide('b'),
					transition: { type: 'push', direction: 'l' } satisfies PptxSlideTransition,
				},
				buildSlide('c'),
			],
			currentSlide: 1,
			editable: true,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createTransitionActions({ store, ops });

		actions.applyTransitionDraft(
			{
				type: 'wipe',
				durationSec: 0.5,
				advanceOnClick: true,
				advanceAfter: false,
				advanceAfterText: '00:00.00',
			},
			true,
		);

		for (const slide of store.get().slides) {
			// The active slide's own direction rides along, which is what
			// PowerPoint's Apply To All does.
			expect(slide.transition).toMatchObject({ type: 'wipe', durationMs: 500, direction: 'l' });
		}
		// One object per slide, or a later per-slide edit would leak across the deck.
		expect(store.get().slides[0].transition).not.toBe(store.get().slides[2].transition);
	});

	it('applyTransitionChange merges a raw partial change onto the active slide, with history', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [
				{
					...buildSlide('a'),
					transition: { type: 'fade', durationMs: 500 } satisfies PptxSlideTransition,
				},
				buildSlide('b'),
			],
			currentSlide: 0,
			editable: true,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createTransitionActions({ store, ops });

		actions.applyTransitionChange({
			soundData: 'data:audio/wav;base64,AA==',
			soundFileName: 'x.wav',
		});

		expect(store.get().slides[0].transition).toMatchObject({
			type: 'fade',
			durationMs: 500,
			soundData: 'data:audio/wav;base64,AA==',
			soundFileName: 'x.wav',
		});
		expect(store.get().slides[1].transition).toBeUndefined();
		ops.undo();
		expect(store.get().slides[0].transition?.soundData).toBeUndefined();
	});

	it('applyTransitionChange is a no-op when the viewer is not editable', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a')],
			currentSlide: 0,
			editable: false,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createTransitionActions({ store, ops });

		actions.applyTransitionChange({ soundFileName: 'x.wav' });

		expect(store.get().slides[0].transition).toBeUndefined();
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
