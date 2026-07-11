import type { PptxAnimationPreset } from 'pptx-viewer-core';
import type { AnimationGroup } from 'pptx-viewer-shared';
import { applyAnimationPreset, removeElementAnimation } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import { updateSlide } from './editor-mutations';
import type { EditorOps } from './editor-operations';

/**
 * Element-animation actions for the ribbon's Animations tab.
 *
 * Animation data lives on the SLIDE (`PptxSlide.animations`, keyed by
 * `elementId`), not on the element itself, matching how the presentation
 * playback state machine reads it (`buildClickGroups(slide.animations)` in
 * `animation/presentation-playback.ts`). Both actions target the currently
 * selected element and route through the shared `animation-authoring.ts`
 * "coarse group preset" model (`applyAnimationPreset` / `removeElementAnimation`),
 * the same one the Vue ribbon uses: applying a preset sets one of
 * entrance/emphasis/exit without touching the others; remove drops the whole
 * entry.
 */
export interface AnimationActions {
	addAnimation(group: AnimationGroup, preset: PptxAnimationPreset): void;
	removeAnimation(): void;
}

export interface AnimationActionsDeps {
	store: Store<ViewerState>;
	ops: EditorOps;
}

export function createAnimationActions(deps: AnimationActionsDeps): AnimationActions {
	const { store, ops } = deps;

	return {
		addAnimation(group, preset) {
			const state = store.get();
			const elementId = state.selectedElementId;
			const slide = state.slides[state.currentSlide];
			if (!state.editable || !elementId || !slide) {
				return;
			}
			const animations = applyAnimationPreset(slide.animations ?? [], elementId, group, preset);
			ops.pushHistory();
			store.set({ slides: updateSlide(state.slides, state.currentSlide, { animations }) });
			ops.commitChange();
		},

		removeAnimation() {
			const state = store.get();
			const elementId = state.selectedElementId;
			const slide = state.slides[state.currentSlide];
			if (!state.editable || !elementId || !slide?.animations?.length) {
				return;
			}
			const animations = removeElementAnimation(slide.animations, elementId);
			if (animations.length === slide.animations.length) {
				return;
			}
			ops.pushHistory();
			store.set({ slides: updateSlide(state.slides, state.currentSlide, { animations }) });
			ops.commitChange();
		},
	};
}
