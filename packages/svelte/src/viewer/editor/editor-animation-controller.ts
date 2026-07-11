import type { PptxAnimationPreset } from 'pptx-viewer-core';
import type { AnimationGroup } from 'pptx-viewer-shared';
import { applyAnimationPreset, removeElementAnimation } from 'pptx-viewer-shared';

import { updateSlide } from './editor-mutations';
import type { EditorState } from './editor-state.svelte';

/**
 * Element-animation actions for the ribbon's Animations tab, split out of
 * `EditorState` to keep it under the repo's 300-LOC budget.
 *
 * Animation data lives on the SLIDE (`PptxSlide.animations`, keyed by
 * `elementId`), not on the element itself, matching how the presentation
 * playback state machine reads it (`buildClickGroups` in
 * `presentation/animation-playback.svelte.ts`). Both actions target the
 * currently selected element and route through the shared
 * `animation-authoring.ts` "coarse group preset" model (`applyAnimationPreset`
 * / `removeElementAnimation`), the same one the Vue/vanilla ribbons use:
 * applying a preset sets one of entrance/emphasis/exit without touching the
 * others; remove drops the whole entry. Both mutations go through
 * `EditorState.commitSlides`, so they are history-integrated (undoable).
 */
export class EditorAnimationController {
	readonly #editor: EditorState;

	constructor(editor: EditorState) {
		this.#editor = editor;
	}

	addAnimation(group: AnimationGroup, preset: PptxAnimationPreset): void {
		const elementId = this.#editor.selectedElementId;
		const current = this.#editor.currentSlideIndex;
		const slide = this.#editor.slides[current];
		if (!this.#editor.editable || !elementId || !slide) {
			return;
		}
		const animations = applyAnimationPreset(slide.animations ?? [], elementId, group, preset);
		this.#editor.commitSlides(updateSlide(this.#editor.slides, current, { animations }));
	}

	removeAnimation(): void {
		const elementId = this.#editor.selectedElementId;
		const current = this.#editor.currentSlideIndex;
		const slide = this.#editor.slides[current];
		if (!this.#editor.editable || !elementId || !slide?.animations?.length) {
			return;
		}
		const animations = removeElementAnimation(slide.animations, elementId);
		if (animations.length === slide.animations.length) {
			return;
		}
		this.#editor.commitSlides(updateSlide(this.#editor.slides, current, { animations }));
	}
}
