/* oxlint-disable eslint/one-var -- the many action factory closures below each
   declare their own independent locals; merging unrelated declarations across
   them would hurt readability, not help it. */
import type {
	PptxAnimationPreset,
	PptxAnimationDirection,
	PptxAnimationRepeatMode,
	PptxAnimationSequence,
	PptxAnimationTimelineAnchor,
	PptxAnimationTimingCurve,
	PptxAnimationTrigger,
	PptxElementAnimation,
} from 'pptx-viewer-core';
import type { AnimationGroup } from 'pptx-viewer-shared';
import {
	applyAnimationPreset,
	applyAnimationTimelineOrder,
	applyMotionPathPreset,
	buildAnimationTimelineRows,
	clearMotionPath,
	moveAnimationTimelineRowBy,
	removeElementAnimation,
	reorderAnimationTimelineRows,
	setAnimationEmphasis,
	setAnimationEntrance,
	setAnimationExit,
	setDelay,
	setDirection,
	setDuration,
	setRepeatCount,
	setRepeatMode,
	setMotionPath,
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
/** Partial timing/effect-option update for one element's animation entry. */
export interface AnimationTimingPatch {
	durationMs?: number;
	delayMs?: number;
	trigger?: PptxAnimationTrigger;
	direction?: PptxAnimationDirection;
	sequence?: PptxAnimationSequence;
	timingCurve?: PptxAnimationTimingCurve;
	repeatCount?: number;
	repeatMode?: PptxAnimationRepeatMode | 'none';
	triggerShapeId?: string;
}

export interface AnimationActions {
	addAnimation(group: AnimationGroup, preset: PptxAnimationPreset): void;
	removeAnimation(): void;
	/**
	 * Set (or clear with `'none'`) a single effect bucket on the selected
	 * element, React's `AnimationPanel` select model: the entry is created on
	 * first effect and dropped once all three buckets are empty (shared
	 * `setAnimationEntrance`/`setAnimationExit`/`setAnimationEmphasis`).
	 */
	setAnimationEffect(group: AnimationGroup, preset: PptxAnimationPreset | 'none'): void;
	/**
	 * Apply a catalogue motion path to the selected element by preset id.
	 *
	 * `'none'` clears the path; `'custom'` (the inspector's read-only marker for
	 * a hand-dragged path) is deliberately a no-op, so re-picking the marker can
	 * never snap the dragged geometry back to a catalogue entry.
	 */
	applyMotionPath(presetId: string): void;
	/** Replace the selected element's raw path (canvas end-handle drag commit). */
	setMotionPathData(path: string): void;
	setAnimationTiming(elementId: string, patch: AnimationTimingPatch): void;
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

	/** The active slide's read-only native-effect anchors (see `PptxAnimationTimelineAnchor`). */
	const currentAnchors = (): readonly PptxAnimationTimelineAnchor[] =>
		store.get().slides[store.get().currentSlide]?.animationTimelineAnchors ?? [];

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

		setAnimationEffect(group, preset) {
			const state = store.get();
			const elementId = state.selectedElementId;
			const slide = state.slides[state.currentSlide];
			if (!state.editable || !elementId || !slide) {
				return;
			}
			const setter =
				group === 'entrance'
					? setAnimationEntrance
					: group === 'exit'
						? setAnimationExit
						: setAnimationEmphasis;
			const animations = setter(slide.animations ?? [], elementId, preset);
			ops.pushHistory();
			store.set({ slides: updateSlide(state.slides, state.currentSlide, { animations }) });
			ops.commitChange();
		},

		applyMotionPath(presetId) {
			if (presetId === 'custom') {
				return;
			}
			const state = store.get();
			const elementId = state.selectedElementId;
			const slide = state.slides[state.currentSlide];
			if (!state.editable || !elementId || !slide) {
				return;
			}
			const current = slide.animations ?? [];
			const animations =
				presetId === 'none'
					? clearMotionPath(current, elementId)
					: applyMotionPathPreset(current, elementId, presetId);
			ops.pushHistory();
			store.set({ slides: updateSlide(state.slides, state.currentSlide, { animations }) });
			ops.commitChange();
		},

		setMotionPathData(path) {
			const state = store.get();
			const elementId = state.selectedElementId;
			const slide = state.slides[state.currentSlide];
			if (!state.editable || !elementId || !slide) {
				return;
			}
			const animations = setMotionPath(slide.animations ?? [], elementId, path);
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

		// Both route through the FULL merged sequence (editor animations plus
		// the deck's own read-only anchors), so an editor-authored effect can
		// end up ahead of or behind a native effect, not just among the
		// effects this editor added.
		reorderAnimation(elementId, direction) {
			commitAnimations(elementId, (animations) =>
				moveAnimationTimelineRowBy(
					animations,
					currentAnchors(),
					elementId,
					direction === 'up' ? -1 : 1,
				),
			);
		},
		moveAnimation(elementId, index) {
			commitAnimations(elementId, (animations) => {
				const rows = buildAnimationTimelineRows(animations, currentAnchors());
				const nextRows = reorderAnimationTimelineRows(rows, `editor:${elementId}`, index);
				return applyAnimationTimelineOrder(animations, nextRows);
			});
		},
	};
}
