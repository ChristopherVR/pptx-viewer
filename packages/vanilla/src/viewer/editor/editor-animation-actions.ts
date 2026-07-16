import type {
	PptxAnimationPreset,
	PptxAnimationDirection,
	PptxAnimationRepeatMode,
	PptxAnimationSequence,
	PptxAnimationTimingCurve,
	PptxAnimationTrigger,
	PptxElementAnimation,
} from 'pptx-viewer-core';
import type { AnimationGroup } from 'pptx-viewer-shared';
import {
	applyAnimationPreset,
	removeElementAnimation,
	reorderAnimationDown,
	reorderAnimationUp,
	setDelay,
	setDirection,
	setDuration,
	setRepeatCount,
	setRepeatMode,
	setSequence,
	setTimingCurve,
	setTrigger,
	setTriggerShapeId,
} from 'pptx-viewer-shared';

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
	setAnimationTiming(
		elementId: string,
		patch: {
			durationMs?: number;
			delayMs?: number;
			trigger?: PptxAnimationTrigger;
			direction?: PptxAnimationDirection;
			sequence?: PptxAnimationSequence;
			timingCurve?: PptxAnimationTimingCurve;
			repeatCount?: number;
			repeatMode?: PptxAnimationRepeatMode | 'none';
			triggerShapeId?: string;
		},
	): void;
	reorderAnimation(elementId: string, direction: 'up' | 'down'): void;
	moveAnimation(elementId: string, index: number): void;
}

export interface AnimationActionsDeps {
	store: Store<ViewerState>;
	ops: EditorOps;
}

export function createAnimationActions(deps: AnimationActionsDeps): AnimationActions {
	const { store, ops } = deps;
	const commitAnimations = (
		elementId: string,
		update: (animations: readonly PptxElementAnimation[]) => PptxElementAnimation[],
	): void => {
		const state = store.get();
		const slide = state.slides[state.currentSlide];
		if (!state.editable || !slide?.animations?.some((item) => item.elementId === elementId)) {
			return;
		}
		const animations = update(slide.animations);
		ops.pushHistory();
		store.set({ slides: updateSlide(state.slides, state.currentSlide, { animations }) });
		ops.commitChange();
	};

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

		setAnimationTiming(elementId, patch) {
			commitAnimations(elementId, (current) => {
				let animations = [...current];
				if (patch.durationMs !== undefined) {
					animations = setDuration(animations, elementId, patch.durationMs);
				}
				if (patch.delayMs !== undefined) {
					animations = setDelay(animations, elementId, patch.delayMs);
				}
				if (patch.trigger !== undefined) {
					animations = setTrigger(animations, elementId, patch.trigger);
				}
				if (patch.direction !== undefined) {
					animations = setDirection(animations, elementId, patch.direction);
				}
				if (patch.sequence !== undefined) {
					animations = setSequence(animations, elementId, patch.sequence);
				}
				if (patch.timingCurve !== undefined) {
					animations = setTimingCurve(animations, elementId, patch.timingCurve);
				}
				if (patch.repeatCount !== undefined) {
					animations = setRepeatCount(animations, elementId, patch.repeatCount);
				}
				if (patch.repeatMode !== undefined) {
					animations = setRepeatMode(animations, elementId, patch.repeatMode);
				}
				if (patch.triggerShapeId !== undefined) {
					animations = setTriggerShapeId(animations, elementId, patch.triggerShapeId || undefined);
				}
				return animations;
			});
		},

		reorderAnimation(elementId, direction) {
			commitAnimations(elementId, (animations) =>
				direction === 'up'
					? reorderAnimationUp(animations, elementId)
					: reorderAnimationDown(animations, elementId),
			);
		},
		moveAnimation(elementId, index) {
			commitAnimations(elementId, (animations) => {
				const ordered = [...animations].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
				const from = ordered.findIndex((item) => item.elementId === elementId);
				if (from < 0) {
					return ordered;
				}
				const [moved] = ordered.splice(from, 1);
				ordered.splice(Math.max(0, Math.min(index, ordered.length)), 0, moved);
				return ordered.map((item, order) => ({ ...item, order }));
			});
		},
	};
}
