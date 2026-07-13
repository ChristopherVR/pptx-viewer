import { cloneElement, cloneSlide } from 'pptx-viewer-core';
import { createBlankSlide, makeSlideId } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import type { EditorOps } from './editor-operations';

/**
 * New/duplicate/delete-slide actions for the ribbon's Home > Slides group,
 * backed by the shared `slide-operations.ts` factory. Every mutation is
 * history-integrated (matches the element-level actions in `editor-edit-ops`)
 * and renumbers `slideNumber` across the whole deck so it always matches the
 * array index (mirrors the Vue `useSlideOperations` contract).
 */
export interface SlideActions {
	addSlide(): void;
	duplicateSlide(): void;
	deleteSlide(): void;
}

export interface SlideActionsDeps {
	store: Store<ViewerState>;
	ops: EditorOps;
}

export function createSlideActions(deps: SlideActionsDeps): SlideActions {
	const { store, ops } = deps;

	return {
		addSlide() {
			const state = store.get();
			if (!state.editable) {
				return;
			}
			ops.pushHistory();
			const insertAt = state.currentSlide + 1;
			const slide = createBlankSlide(insertAt + 1);
			const slides = [
				...state.slides.slice(0, insertAt),
				slide,
				...state.slides.slice(insertAt),
			].map((s, i) => ({ ...s, slideNumber: i + 1 }));
			store.set({
				slides,
				currentSlide: insertAt,
				selectedElementId: null,
				selectedElementIds: [],
			});
			ops.commitChange();
		},

		duplicateSlide() {
			const state = store.get();
			const source = state.slides[state.currentSlide];
			if (!state.editable || !source) {
				return;
			}
			ops.pushHistory();
			const insertAt = state.currentSlide + 1;
			const copy = { ...cloneSlide(source), id: makeSlideId() };
			const sourceTemplate = state.templateElementsBySlideId[source.id] ?? [];
			const slides = [
				...state.slides.slice(0, insertAt),
				copy,
				...state.slides.slice(insertAt),
			].map((s, i) => ({ ...s, slideNumber: i + 1 }));
			store.set({
				slides,
				templateElementsBySlideId: {
					...state.templateElementsBySlideId,
					[copy.id]: sourceTemplate.map(cloneElement),
				},
				currentSlide: insertAt,
				selectedElementId: null,
				selectedElementIds: [],
			});
			ops.commitChange();
		},

		deleteSlide() {
			const state = store.get();
			if (!state.editable || state.slides.length <= 1) {
				return;
			}
			ops.pushHistory();
			const slides = state.slides
				.filter((_, i) => i !== state.currentSlide)
				.map((s, i) => ({ ...s, slideNumber: i + 1 }));
			const currentSlide = Math.min(state.currentSlide, slides.length - 1);
			const templateElementsBySlideId = { ...state.templateElementsBySlideId };
			delete templateElementsBySlideId[state.slides[state.currentSlide].id];
			store.set({
				slides,
				templateElementsBySlideId,
				currentSlide,
				selectedElementId: null,
				selectedElementIds: [],
			});
			ops.commitChange();
		},
	};
}
