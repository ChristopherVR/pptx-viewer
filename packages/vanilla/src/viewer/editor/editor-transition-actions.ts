import type { PptxSlideTransition, PptxTransitionType } from 'pptx-viewer-core';

import type { Store, ViewerState } from '../state';
import { updateAllSlides, updateSlide } from './editor-mutations';
import type { EditorOps } from './editor-operations';

/**
 * Slide-transition actions for the ribbon's Transitions tab. Playback already
 * reads `PptxSlide.transition` (see `animation/presentation-playback.ts`), so
 * this only needs to write that same field, history-integrated like every
 * other ribbon mutation.
 *
 * `applyTransition` covers both the preset gallery buttons and the duration
 * input (the tab re-applies the currently-selected preset whenever the
 * duration changes), plus the "Apply to All Slides" checkbox: when
 * `applyToAll` is true every slide gets the same fresh `{ type, durationMs }`
 * transition; otherwise only the current slide is patched, preserving any
 * advanced fields (direction, sound, ...) it already carried.
 */
/** How the deck advances past a slide, from the Transitions tab's Advance Slide group. */
export interface TransitionAdvance {
	/** Advance when the presenter clicks (PowerPoint's default). */
	onClick: boolean;
	/** Auto-advance after this many ms; omitted when the presenter drives it. */
	afterMs?: number;
}

export interface TransitionActions {
	applyTransition(
		type: PptxTransitionType,
		durationMs: number,
		applyToAll: boolean,
		advance?: TransitionAdvance,
	): void;
}

export interface TransitionActionsDeps {
	store: Store<ViewerState>;
	ops: EditorOps;
}

export function createTransitionActions(deps: TransitionActionsDeps): TransitionActions {
	const { store, ops } = deps;

	return {
		applyTransition(type, durationMs, applyToAll, advance) {
			const state = store.get();
			const slide = state.slides[state.currentSlide];
			if (!state.editable || !slide) {
				return;
			}
			const clampedDuration = Math.max(0, Math.round(durationMs));

			ops.pushHistory();
			const advanceFields: Partial<PptxSlideTransition> = advance
				? { advanceOnClick: advance.onClick, advanceAfterMs: advance.afterMs }
				: {};
			if (applyToAll) {
				const transition: PptxSlideTransition = {
					type,
					durationMs: clampedDuration,
					...advanceFields,
				};
				store.set({ slides: updateAllSlides(state.slides, { transition }) });
			} else {
				const transition: PptxSlideTransition = {
					...slide.transition,
					type,
					durationMs: clampedDuration,
					...advanceFields,
				};
				store.set({ slides: updateSlide(state.slides, state.currentSlide, { transition }) });
			}
			ops.commitChange();
		},
	};
}
