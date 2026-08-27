import type { PptxSlideTransition, PptxTransitionType } from 'pptx-viewer-core';
import type { RibbonTransitionDraft } from 'pptx-viewer-shared';
import {
	applyRibbonTransitionDraft,
	mergeSlideTransition,
	ribbonTransitionTargets,
} from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import { updateAllSlides, updateSlide } from './editor-mutations';
import type { EditorOps } from './editor-operations';

/**
 * Slide-transition actions for the ribbon's Transitions tab. Playback already
 * reads `PptxSlide.transition` (see `animation/presentation-playback.ts`), so
 * this only needs to write that same field, history-integrated like every
 * other ribbon mutation.
 *
 * The ribbon's Transitions tab drives `applyTransitionDraft`, built on the
 * shared `ribbon-transitions` decision module, so every control on that tab
 * commits the moment it changes (the matching READ is a plain store read on the
 * chrome side, because the ribbon is built before this editor exists).
 * `applyTransition` is the older
 * single-shot form (type + duration + optional advance fields), kept because it
 * is part of the published `EditActions` surface: when `applyToAll` is true
 * every slide gets the same fresh `{ type, durationMs }` transition; otherwise
 * only the current slide is patched, preserving any advanced fields
 * (direction, sound, ...) it already carried.
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
	/**
	 * Commit the Transitions tab's whole draft, so EVERY control on that tab
	 * (preset, duration, advance-on-click, advance-after) takes effect the
	 * moment it changes instead of waiting for the next preset click.
	 *
	 * Apply to All copies the transition the ACTIVE slide ends up with onto
	 * every slide, which is what PowerPoint's own button does; the target list
	 * comes from the shared `ribbonTransitionTargets`.
	 */
	applyTransitionDraft(draft: RibbonTransitionDraft, applyToAll: boolean): void;
	/**
	 * Merge a raw partial change onto the ACTIVE slide's transition, for
	 * controls that write a single field outside the ribbon draft (currently
	 * the Sound picker: a freshly-picked file's `soundData` has no equivalent
	 * in {@link RibbonTransitionDraft}).
	 */
	applyTransitionChange(changes: Partial<PptxSlideTransition>): void;
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

		applyTransitionDraft(draft, applyToAll) {
			const state = store.get();
			const active = state.slides[state.currentSlide];
			if (!state.editable || !active) {
				return;
			}
			const transition = applyRibbonTransitionDraft(active, draft);
			const targets = new Set(
				ribbonTransitionTargets(state.slides.length, state.currentSlide, applyToAll),
			);
			ops.pushHistory();
			store.set({
				// A fresh object per slide: one shared reference would let a later
				// per-slide edit (the inspector's direction grid) leak across the deck.
				slides: state.slides.map((slide, index) =>
					targets.has(index) ? { ...slide, transition: { ...transition } } : slide,
				),
			});
			ops.commitChange();
		},

		applyTransitionChange(changes) {
			const state = store.get();
			const active = state.slides[state.currentSlide];
			if (!state.editable || !active) {
				return;
			}
			ops.pushHistory();
			const transition = mergeSlideTransition(active.transition, changes);
			store.set({ slides: updateSlide(state.slides, state.currentSlide, { transition }) });
			ops.commitChange();
		},
	};
}
