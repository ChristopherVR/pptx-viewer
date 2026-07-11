import type { PptxSlideTransition, PptxTransitionType } from 'pptx-viewer-core';

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
}
