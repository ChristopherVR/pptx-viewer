import type { PptxSlide, PptxThemeColorScheme } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import { createEditorOps } from './editor-operations';
import { createSlideActions } from './editor-slide-actions';

const buildSlides = (count: number): PptxSlide[] =>
	Array.from({ length: count }, (_, index) => ({
		id: `slide-${index + 1}`,
		rId: `rId-${index + 1}`,
		slideNumber: index + 1,
		elements: [],
	}));

describe('insertSlideFromTemplate', () => {
	it('inserts the built template after the current slide, selected and history-integrated', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: buildSlides(2),
			currentSlide: 0,
			editable: true,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const pushHistory = vi.spyOn(ops, 'pushHistory');
		const commitChange = vi.spyOn(ops, 'commitChange');
		const actions = createSlideActions({ store, ops, getHandler: () => null });

		actions.insertSlideFromTemplate('agenda');

		const state = store.get();
		expect(state.slides).toHaveLength(3);
		expect(state.currentSlide).toBe(1);
		// A non-blank template inserts real starter content.
		expect(state.slides[1].elements.length).toBeGreaterThan(0);
		// The deck stays renumbered to match array order.
		expect(state.slides.map((slide) => slide.slideNumber)).toStrictEqual([1, 2, 3]);
		expect(state.selectedElementId).toBeNull();
		expect(state.selectedElementIds).toStrictEqual([]);
		expect(pushHistory).toHaveBeenCalledOnce();
		expect(commitChange).toHaveBeenCalledOnce();
	});

	it('pushes history BEFORE the mutation so undo restores the previous deck', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: buildSlides(2),
			currentSlide: 0,
			editable: true,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createSlideActions({ store, ops, getHandler: () => null });

		actions.insertSlideFromTemplate('title');
		expect(store.get().slides).toHaveLength(3);
		ops.undo();
		expect(store.get().slides).toHaveLength(2);
		expect(store.get().slides.map((slide) => slide.id)).toStrictEqual(['slide-1', 'slide-2']);
	});

	it('is a no-op when editing is disabled', () => {
		const store = createStore({ ...createInitialViewerState(), slides: buildSlides(2) });
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const pushHistory = vi.spyOn(ops, 'pushHistory');
		const actions = createSlideActions({ store, ops, getHandler: () => null });

		actions.insertSlideFromTemplate('quote');

		expect(store.get().slides).toHaveLength(2);
		expect(pushHistory).not.toHaveBeenCalled();
	});
});

describe('getTemplateScheme', () => {
	it('maps the loaded theme colour scheme into a template scheme', () => {
		const colorScheme: PptxThemeColorScheme = {
			dk1: '#111111',
			lt1: '#FEFEFE',
			dk2: '#222222',
			lt2: '#EEEEEE',
			accent1: '#AA0000',
			accent2: '#00AA00',
			accent3: '#0000AA',
			accent4: '#AAAA00',
			accent5: '#00AAAA',
			accent6: '#AA00AA',
			hlink: '#0563C1',
			folHlink: '#954F72',
		};
		const store = createStore({ ...createInitialViewerState(), colorScheme });
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createSlideActions({ store, ops, getHandler: () => null });

		expect(actions.getTemplateScheme()).toMatchObject({ accent1: '#AA0000', dk1: '#111111' });
	});

	it('returns an empty map before a theme is loaded (builders fall back to defaults)', () => {
		const store = createStore(createInitialViewerState());
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });
		const actions = createSlideActions({ store, ops, getHandler: () => null });

		expect(actions.getTemplateScheme()).toStrictEqual({});
	});
});
