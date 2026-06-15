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

import type { PptxElementAnimation, PptxAnimationTrigger } from 'pptx-viewer-core';
import { initialHiddenStyle, resolveAnimationCss } from 'pptx-viewer-shared';
import { computed, ref, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter, WritableComputedRef } from 'vue';

/** Minimal CSS-properties shape: kebab-case property → value. */
export type CSSProperties = Record<string, string>;

/** A single click-triggered group of animations that play as one step. */
export interface AnimationClickGroup {
	/** Animations belonging to this group, in document order. */
	animations: PptxElementAnimation[];
}

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

/**
 * Triggers that begin a brand-new click group. Everything else
 * (`withPrevious`, `afterPrevious`, `afterDelay`) folds into the current group.
 */
function startsNewGroup(trigger: PptxAnimationTrigger | undefined): boolean {
	return trigger === 'onClick' || trigger === 'onShapeClick' || trigger === 'onHover';
}

/**
 * Splits an ordered animation list into click groups. The first animation
 * always begins a group even if it isn't explicitly `onClick` (PowerPoint shows
 * the first build on the first advance). Subsequent `withPrevious` /
 * `afterPrevious` animations attach to the group in progress.
 */
export function buildClickGroups(
	animations: readonly PptxElementAnimation[],
): AnimationClickGroup[] {
	const groups: AnimationClickGroup[] = [];
	for (const animation of animations) {
		const isFirst = groups.length === 0;
		if (isFirst || startsNewGroup(animation.trigger)) {
			groups.push({ animations: [animation] });
		} else {
			groups[groups.length - 1].animations.push(animation);
		}
	}
	return groups;
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

	/**
	 * Resolve the CSS for every animation in the revealed groups. Within a group,
	 * `afterPrevious` animations are pushed back by the accumulated duration of
	 * the preceding animations so sequential chains play in order; `withPrevious`
	 * shares the running delay. The last write for an element id wins (a later
	 * emphasis/exit overrides an earlier entrance), matching how a single CSS
	 * `animation` shorthand can only hold one running effect.
	 */
	const elementStyles = computed<Map<string, CSSProperties>>(() => {
		const result = new Map<string, CSSProperties>();
		const revealed = groups.value.slice(0, step.value);

		for (const group of revealed) {
			let runningDelayMs = 0;
			let previousDurationMs = 0;

			for (const animation of group.animations) {
				const resolved = resolveAnimationCss(animation);
				if (!resolved) {
					continue;
				}

				// Compute the in-group delay for sequential vs. concurrent triggers.
				if (animation.trigger === 'afterPrevious') {
					runningDelayMs += previousDurationMs;
				}
				// `withPrevious` (and the group's first animation) keep runningDelayMs.

				const ownDelay = animation.delayMs ?? 0;
				const totalDelay = runningDelayMs + ownDelay;
				const duration = durationOf(resolved.style);

				const style: CSSProperties = {
					...resolved.style,
					'animation-delay': `${totalDelay}ms`,
				};
				result.set(animation.elementId, style);

				previousDurationMs = duration;
			}
		}

		return result;
	});

	/**
	 * Elements with a pending entrance (in a not-yet-revealed group) that should
	 * be hidden until their group plays.
	 */
	const pendingStyles = computed<Map<string, CSSProperties>>(() => {
		const result = new Map<string, CSSProperties>();
		const pending = groups.value.slice(step.value);

		for (const group of pending) {
			for (const animation of group.animations) {
				const hidden = initialHiddenStyle(animation);
				if (Object.keys(hidden).length > 0) {
					// Don't hide an element that an already-revealed group made visible.
					if (!result.has(animation.elementId)) {
						result.set(animation.elementId, hidden);
					}
				}
			}
		}

		return result;
	});

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

/** Clamp a step into `[0, count]`. */
function clampStep(value: number, count: number): number {
	if (value < 0) {
		return 0;
	}
	if (value > count) {
		return count;
	}
	return value;
}

/** Parse the numeric ms duration out of a resolved style's `animation-duration`. */
function durationOf(style: CSSProperties): number {
	const raw = style['animation-duration'];
	if (!raw) {
		return 0;
	}
	const match = /^(?<ms>\d+(?:\.\d+)?)ms$/u.exec(raw);
	return match ? Number(match.groups?.ms) : 0;
}
