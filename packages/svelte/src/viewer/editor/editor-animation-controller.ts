import type { PptxAnimationPreset, PptxElementAnimation } from 'pptx-viewer-core';
import type { AnimationGroup } from 'pptx-viewer-shared';
import {
	applyAnimationPreset,
	applyMotionPathPreset,
	clearMotionPath,
	removeElementAnimation,
	setMotionPath,
} from 'pptx-viewer-shared';

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

	/**
	 * Apply a catalogue motion path (ribbon gallery / inspector select) to the
	 * selection. A path is NOT one of the three preset buckets: it upserts the
	 * `motionPath` field on the same animation entry, so an element can travel a
	 * path AND fade in, exactly as PowerPoint allows.
	 */
	applyMotionPath(presetId: string): void {
		this.#commitMotionPath((animations, elementId) =>
			applyMotionPathPreset(animations, elementId, presetId),
		);
	}

	/**
	 * Write a raw path string (the canvas end-handle drag), bypassing the
	 * catalogue: a dragged path no longer matches any preset, and pinning it to
	 * one would silently discard the drag.
	 */
	setMotionPath(path: string): void {
		this.#commitMotionPath((animations, elementId) => setMotionPath(animations, elementId, path));
	}

	/** Drop the motion path, and the whole entry when nothing else is left on it. */
	clearMotionPath(): void {
		this.#commitMotionPath((animations, elementId) => clearMotionPath(animations, elementId));
	}

	/** Shared guard + history commit for the three motion-path mutations. */
	#commitMotionPath(
		mutate: (
			animations: readonly PptxElementAnimation[],
			elementId: string,
		) => PptxElementAnimation[],
	): void {
		const elementId = this.#editor.selectedElementId;
		const current = this.#editor.currentSlideIndex;
		const slide = this.#editor.slides[current];
		if (!this.#editor.editable || !elementId || !slide) {
			return;
		}
		const animations = mutate(slide.animations ?? [], elementId);
		this.#editor.commitSlides(updateSlide(this.#editor.slides, current, { animations }));
	}
}
