/**
 * `animation-playback-seek`: PowerPoint's `p:seq/@nextAc="seek"` behaviour
 * (ECMA-376 S19.5.60) for the main click sequence of a running slide show.
 *
 * A presenter click that lands while the previous click-group is still
 * mid-flight must fast-forward THAT group to its authored end state, not start
 * the next group on top of it: the running CSS / Web Animations are finished in
 * place, every pending cleanup timer and the staged-build RAF are cancelled,
 * and each step is written to the exact state its own cleanup timer would have
 * reached. Only once the group is settled (or its duration has elapsed) does a
 * click advance the sequence.
 *
 * This used to live only in the React binding
 * (`presentation-mode/animation-helpers.ts`); Vue / Angular / Svelte / Vanilla
 * advanced immediately regardless of `seqNextAction`, so a second click during
 * a build silently skipped a step there. {@link advanceMainSequence} is the one
 * entry point every binding now routes its "next click" through, so the branch
 * cannot drift again.
 *
 * Companion to `animation-playback-engine` (kept separate for that file's line
 * budget). `animation-sequence-gating` handles the OTHER two `@nextAc` tokens
 * inside the pure `TimelineEngine`; `"seek"` needs the DOM and the host's
 * timers, so it lives here in the DOM-glue layer instead.
 *
 * @module render/animation-playback-seek
 */

import type {
	PlaybackAnimationController,
	PlaybackContext,
	StatesSetter,
} from './animation-playback-engine';
import {
	cancelBuildReveal,
	playGroup,
	scheduleAutoAdvanceChain,
} from './animation-playback-engine';
import type { ElementAnimationState, TimelineClickGroup } from './animation-timeline-types';
import { PresentationAnimationController } from './presentation-animation-controller';

// ---------------------------------------------------------------------------
// Active-group tracking
// ---------------------------------------------------------------------------

/**
 * The click-group most recently started by a presenter click, plus the
 * wall-clock instant (`performance.now()` domain) at which its authored
 * duration runs out. Owned by the binding (a ref / field / closure variable)
 * and mutated in place by the helpers below.
 */
export interface ActiveAnimationGroup {
	group: TimelineClickGroup | null;
	endAtMs: number;
}

/** A fresh, empty tracker (no group in flight). */
export function createActiveAnimationGroup(): ActiveAnimationGroup {
	return { group: null, endAtMs: 0 };
}

/** Record `group` as the in-flight click-group, ending `totalDurationMs` from `nowMs`. */
export function markAnimationGroupActive(
	active: ActiveAnimationGroup,
	group: TimelineClickGroup,
	nowMs: number = performance.now(),
): void {
	active.group = group;
	active.endAtMs = nowMs + Math.max(0, group.totalDurationMs);
}

/** Forget the in-flight click-group (slide change, seek completed, teardown). */
export function clearActiveAnimationGroup(active: ActiveAnimationGroup): void {
	active.group = null;
	active.endAtMs = 0;
}

/**
 * Whether a second presentation advance should seek the active group to its
 * authored end instead of starting the next group immediately.
 */
export function shouldSeekAnimationGroup(
	group: TimelineClickGroup | null,
	endAtMs: number,
	nowMs: number,
): group is TimelineClickGroup {
	return group?.seqNextAction === 'seek' && nowMs < endAtMs;
}

// ---------------------------------------------------------------------------
// Finishing a group in place
// ---------------------------------------------------------------------------

/**
 * Finish the browser animations that belong to one timeline group.
 *
 * Presentation mode can render three independently animated DOM surfaces:
 * whole elements, text-build spans, and the background-only paint layer used
 * by `p:bg`. Match each surface by its timeline element id and leave unrelated
 * animations on the page untouched. Returns the number of animations finished.
 */
export function finishDomAnimationsForGroup(
	group: TimelineClickGroup,
	root: ParentNode = document,
): number {
	const targetIds = new Set(
		group.steps.filter((step) => !step.command).map((step) => step.elementId),
	);
	if (targetIds.size === 0) {
		return 0;
	}

	const activeAnimations = new Set<Animation>();
	const candidates = root.querySelectorAll<HTMLElement>(
		'[data-element-id], [data-anim-id], [data-pptx-animation-layer="background"]',
	);
	for (const element of candidates) {
		let animationElementId = element.dataset.animId ?? element.dataset.elementId;
		if (element.dataset.pptxAnimationLayer === 'background') {
			const hostId = element.closest<HTMLElement>('[data-element-id]')?.dataset.elementId;
			animationElementId = hostId ? `${hostId}::pptx-bg` : undefined;
		}
		if (!animationElementId || !targetIds.has(animationElementId)) {
			continue;
		}
		if (typeof element.getAnimations !== 'function') {
			continue;
		}
		for (const animation of element.getAnimations()) {
			activeAnimations.add(animation);
		}
	}

	let finishedCount = 0;
	for (const animation of activeAnimations) {
		const iterations = animation.effect?.getTiming().iterations;
		if (animation.playState === 'finished' || animation.playState === 'idle') {
			continue;
		}
		if (iterations === Infinity) {
			continue;
		}
		try {
			animation.finish();
			finishedCount += 1;
		} catch {
			// A detached animation may become unfinishable between lookup and seek.
		}
	}
	return finishedCount;
}

/**
 * Fold a rapidly-seeked group into the same end state its normal cleanup
 * timers would reach. `completedStates` carries progress 1 for staged chart
 * and SmartArt builds.
 */
export function finishAnimationGroupSteps(
	group: TimelineClickGroup,
	setStates: StatesSetter,
	completedStates?: ReadonlyMap<string, ElementAnimationState>,
): void {
	setStates((previousStates) => {
		const nextStates = new Map(previousStates);
		for (const step of group.steps) {
			if (step.command) {
				continue;
			}
			const currentState = nextStates.get(step.elementId) ?? {
				visible: true,
				cssAnimation: undefined,
			};
			const holdsAnimatedPaint =
				step.holdEndState && step.colorTargets !== undefined && step.colorTargets.length > 0;
			nextStates.set(step.elementId, {
				...currentState,
				visible: step.presetClass !== 'exit' && !step.hideAfterEffect,
				cssAnimation: step.holdEndState ? step.cssAnimation : undefined,
				build: completedStates?.get(step.elementId)?.build ?? currentState.build,
				chartReveal: completedStates?.get(step.elementId)?.chartReveal ?? currentState.chartReveal,
				diagramReveal:
					completedStates?.get(step.elementId)?.diagramReveal ?? currentState.diagramReveal,
				animatesFill: holdsAnimatedPaint && step.colorTargets?.includes('fill') ? true : undefined,
				animatesStroke:
					holdsAnimatedPaint && step.colorTargets?.includes('stroke') ? true : undefined,
			});
		}
		return nextStates;
	});
}

// ---------------------------------------------------------------------------
// The one "next click" entry point
// ---------------------------------------------------------------------------

/**
 * {@link PlaybackAnimationController} plus the exhaustion probe the click path
 * needs. A real `PresentationAnimationController` satisfies this structurally.
 */
export interface SeekableAnimationController extends PlaybackAnimationController {
	hasMoreSteps(): boolean;
}

/**
 * Cancel every pending step / auto-advance timer and the staged-build RAF held
 * in `ctx`, in place (so a `ctx` built once stays valid), and forget the
 * in-flight click-group when a tracker is supplied. Every binding's "clear
 * timers" path should route through this so a slide change also drops the
 * seek target: a stale group from the previous slide must never be seeked.
 */
export function clearPlaybackTimers(ctx: PlaybackContext, active?: ActiveAnimationGroup): void {
	for (const timer of ctx.timers) {
		window.clearTimeout(timer);
	}
	ctx.timers.length = 0;
	cancelBuildReveal(ctx.buildHandle);
	if (active) {
		clearActiveAnimationGroup(active);
	}
}

/**
 * Handle one presenter "next" click against the main sequence.
 *
 * - If the previously clicked group is authored `nextAc="seek"` and is still
 *   inside its duration window, fast-forward it (DOM animations, timers,
 *   states) and re-arm the auto-advance chain; the sequence position does NOT
 *   move, so the following click starts the next group.
 * - Otherwise advance the controller, play the returned group, and remember it
 *   as the new seek target.
 *
 * Returns `true` when the click was consumed by this slide's animations and
 * `false` when the sequence is exhausted (or there is no controller), so the
 * caller can fall through to slide navigation. Callers gate on their own
 * "animations enabled" switch before calling.
 */
export function advanceMainSequence(
	controller: SeekableAnimationController | null,
	ctx: PlaybackContext,
	active: ActiveAnimationGroup,
	nowMs: number = performance.now(),
): boolean {
	if (!controller || !controller.hasMoreSteps()) {
		return false;
	}
	if (shouldSeekAnimationGroup(active.group, active.endAtMs, nowMs)) {
		const group = active.group;
		finishDomAnimationsForGroup(group, ctx.frameRoot?.() ?? document);
		const buildIds = PresentationAnimationController.collectBuildStepIds(group);
		const completedStates = controller.computeStatesFor(buildIds);
		clearPlaybackTimers(ctx, active);
		finishAnimationGroupSteps(group, ctx.setStates, completedStates);
		scheduleAutoAdvanceChain(controller, ctx);
		return true;
	}

	// The controller's own gating clock is `Date.now()`-based; leave its default.
	const group = controller.advance();
	if (!group) {
		return false;
	}
	playGroup(controller, group, ctx);
	markAnimationGroupActive(active, group, nowMs);
	scheduleAutoAdvanceChain(controller, ctx);
	return true;
}
