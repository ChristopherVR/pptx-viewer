/**
 * `useAnimationPlayback` — reactive, click-stepped animation playback for
 * presentation mode.
 *
 * A slide carries an ordered list of {@link PptxElementAnimation}s. PowerPoint
 * groups them into "click groups": an animation triggered `onClick` /
 * `onShapeClick` starts a new group, while `withPrevious` / `afterPrevious`
 * animations join the group that precedes them (running together or
 * sequentially within that group). Advancing the presentation one step reveals
 * one more click group.
 *
 * This composable:
 *  - splits `animations` into click groups (reactive, recomputed when the
 *    slide's animations change);
 *  - tracks the current playback step (driven by `currentIndex` and/or the
 *    returned {@link UseAnimationPlaybackResult.advance});
 *  - exposes a reactive `Map<elementId, CSSProperties>` of the animation styles
 *    that should currently be applied (every element in a *revealed* group gets
 *    its resolved CSS, with the correct cumulative delay for sequential
 *    `afterPrevious` chains).
 *
 * It is framework-light: only Vue reactivity primitives are used and all the
 * preset → CSS mapping is delegated to {@link resolveAnimationCss}.
 *
 * @module composables/useAnimationPlayback
 */

import type { PptxElementAnimation } from 'pptx-viewer-core';
import {
	buildClickGroups,
	clampStep,
	pendingElementStyles,
	revealedElementStyles,
} from 'pptx-viewer-shared';
import type { AnimationClickGroup, CSSProperties } from 'pptx-viewer-shared';
import { computed, ref, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter, WritableComputedRef } from 'vue';

// Re-export the shared pure click-group model so existing importers
// (`PowerPointViewer.vue` and others) keep their `AnimationClickGroup` /
// `CSSProperties` / `buildClickGroups` imports unchanged.
export type { AnimationClickGroup, CSSProperties } from 'pptx-viewer-shared';
export { buildClickGroups } from 'pptx-viewer-shared';

export interface UseAnimationPlaybackOptions {
	/** The current slide's animations, in document/timeline order. */
	animations: MaybeRefOrGetter<PptxElementAnimation[] | undefined>;
	/**
	 * The externally-controlled playback step (e.g. derived from a parent
	 * `clickIndex`). When provided it seeds and keeps the internal step in sync;
	 * the returned {@link UseAnimationPlaybackResult.advance} / `reset` also
	 * mutate the internal step. Optional — playback also works standalone.
	 */
	currentIndex?: MaybeRefOrGetter<number | undefined>;
}

export interface UseAnimationPlaybackResult {
	/**
	 * Reactive map of `elementId → CSS properties` to apply to each element for
	 * the current step. Only elements in revealed click groups appear.
	 */
	elementStyles: ComputedRef<Map<string, CSSProperties>>;
	/**
	 * Reactive map of `elementId → CSS properties` for elements whose entrance
	 * has not yet been revealed (they should be hidden). Lets the host pre-seed
	 * pending entrances so they don't flash visible.
	 */
	pendingStyles: ComputedRef<Map<string, CSSProperties>>;
	/** Number of click groups on this slide (i.e. how many `advance()` steps). */
	groupCount: ComputedRef<number>;
	/**
	 * The current playback step: how many click groups have been revealed.
	 * Reading it returns the effective step (clamped to the group count, falling
	 * back to the external `currentIndex` until the host advances manually);
	 * writing it records a manual override.
	 */
	step: WritableComputedRef<number>;
	/** True when every click group has been revealed. */
	isComplete: ComputedRef<boolean>;
	/**
	 * Reveal the next click group. Returns `true` if a group was revealed,
	 * `false` if playback was already complete (so the caller can fall through
	 * to slide navigation).
	 */
	advance: () => boolean;
	/** Reveal every click group at once (e.g. jump to the slide's final state). */
	play: () => void;
	/** Reset playback to before the first click group. */
	reset: () => void;
}

export function useAnimationPlayback(
	options: UseAnimationPlaybackOptions,
): UseAnimationPlaybackResult {
	const groups = computed<AnimationClickGroup[]>(() => {
		const list = toValue(options.animations) ?? [];
		return buildClickGroups(list);
	});

	const groupCount = computed(() => groups.value.length);

	// Internal, unclamped step. `null` means "follow the external currentIndex";
	// any number means the host has taken manual control via advance/play/reset.
	const manualStep = ref<number | null>(null);

	// The effective step, always clamped to the current group count and
	// synchronously derived (no watchers) so reads are correct immediately even
	// in non-component contexts. Writing it records a manual override.
	const step = computed<number>({
		get() {
			const base =
				manualStep.value ??
				(options.currentIndex !== undefined ? (toValue(options.currentIndex) ?? 0) : 0);
			return clampStep(base, groupCount.value);
		},
		set(value: number) {
			manualStep.value = clampStep(value, groupCount.value);
		},
	});

	const isComplete = computed(() => step.value >= groupCount.value);

	// Resolve the CSS for the revealed / pending click groups via the shared
	// pure playback maths (afterPrevious delay chaining, last-write-wins per
	// element, pending-entrance hide-until-revealed).
	const elementStyles = computed<Map<string, CSSProperties>>(() =>
		revealedElementStyles(groups.value, step.value),
	);

	const pendingStyles = computed<Map<string, CSSProperties>>(() =>
		pendingElementStyles(groups.value, step.value),
	);

	const advance = (): boolean => {
		if (step.value >= groupCount.value) {
			return false;
		}
		step.value += 1;
		return true;
	};

	const play = (): void => {
		step.value = groupCount.value;
	};

	const reset = (): void => {
		step.value = 0;
	};

	return {
		elementStyles,
		pendingStyles,
		groupCount,
		step,
		isComplete,
		advance,
		play,
		reset,
	};
}
