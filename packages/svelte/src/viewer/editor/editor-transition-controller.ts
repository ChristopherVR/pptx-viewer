import type { PptxSlideTransition, PptxTransitionType } from 'pptx-viewer-core';
import type { RibbonTransitionDraft } from 'pptx-viewer-shared';
import {
	applyRibbonTransitionDraft,
	mergeSlideTransition,
	ribbonTransitionTargets,
} from 'pptx-viewer-shared';

import { updateAllSlides, updateSlide } from './editor-mutations';
import type { EditorState } from './editor-state.svelte';

/**
 * Slide-transition actions for the ribbon's Transitions tab, split out of
 * `EditorState` to keep it under the repo's 300-LOC budget. Playback already
 * reads `PptxSlide.transition` (see `presentation/presentation-controller.svelte.ts`),
 * so this only needs to write that same field, routed through
 * `EditorState.commitSlides` so it is history-integrated (undoable).
 *
 * `applyTransition` covers both the preset gallery buttons and the duration
 * input (the tab re-applies the currently-selected preset whenever the
 * duration changes), plus the "Apply to All Slides" checkbox: when
 * `applyToAll` is true every slide gets the same fresh `{ type, durationMs }`
 * transition; otherwise only the current slide is patched, preserving any
 * advanced fields (direction, sound, ...) it already carried.
 */
export class EditorTransitionController {
	readonly #editor: EditorState;

	constructor(editor: EditorState) {
		this.#editor = editor;
	}

	applyTransition(type: PptxTransitionType, durationMs: number, applyToAll: boolean): void {
		const current = this.#editor.currentSlideIndex;
		const slide = this.#editor.slides[current];
		if (!this.#editor.editable || !slide) {
			return;
		}
		const clampedDuration = Math.max(0, Math.round(durationMs));

		if (applyToAll) {
			const transition: PptxSlideTransition = { type, durationMs: clampedDuration };
			this.#editor.commitSlides(updateAllSlides(this.#editor.slides, { transition }));
		} else {
			const transition: PptxSlideTransition = {
				...slide.transition,
				type,
				durationMs: clampedDuration,
			};
			this.#editor.commitSlides(updateSlide(this.#editor.slides, current, { transition }));
		}
	}

	/**
	 * Commit the Transitions tab's whole draft (preset + duration + the Advance
	 * Slide modifiers) in one undoable step.
	 *
	 * The draft, and what it means for a slide's `p:transition`, is decided in
	 * `pptx-viewer-shared` (`ribbon-transitions`) so every binding writes the
	 * same fields; this only routes the result through `commitSlides`. Unlike
	 * `applyTransition`'s apply-to-all, the draft is MERGED onto each target so a
	 * slide keeps its authored direction / spokes / sound.
	 */
	applyRibbonDraft(draft: RibbonTransitionDraft, applyToAll: boolean): void {
		const editor = this.#editor;
		if (!editor.editable) {
			return;
		}
		const targets = ribbonTransitionTargets(
			editor.slides.length,
			editor.currentSlideIndex,
			applyToAll,
		);
		if (targets.length === 0) {
			return;
		}
		let next = editor.slides;
		for (const index of targets) {
			next = updateSlide(next, index, {
				transition: applyRibbonTransitionDraft(next[index], draft),
			});
		}
		editor.commitSlides(next);
	}

	/**
	 * Merge a raw partial change onto the ACTIVE slide's transition, for
	 * controls that write a single field outside the ribbon draft (currently
	 * the Sound picker: a freshly-picked file's `soundData` has no equivalent
	 * in {@link RibbonTransitionDraft}).
	 */
	applyChange(changes: Partial<PptxSlideTransition>): void {
		const editor = this.#editor;
		const current = editor.currentSlideIndex;
		const slide = editor.slides[current];
		if (!editor.editable || !slide) {
			return;
		}
		editor.commitSlides(
			updateSlide(editor.slides, current, {
				transition: mergeSlideTransition(slide.transition, changes),
			}),
		);
	}
}
