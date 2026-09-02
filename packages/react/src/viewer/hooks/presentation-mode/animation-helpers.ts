import type { ElementAnimationState, TimelineClickGroup } from '../../utils/animation-timeline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** State updater function (compatible with React useState setter). */
type StateUpdater<T> = (updater: T | ((prev: T) => T)) => void;

// ---------------------------------------------------------------------------
// Seek support
//
// The click-group step application, staged-build RAF loop, and auto-advance
// chain now live in the shared `animation-playback-engine` (pptx-viewer-shared),
// consumed directly by `useAnimationPlayback`. This module keeps only the
// "seek" nuance: a second advance while a `p:seq/@nextAc="seek"` group is
// still mid-flight fast-forwards it to its authored end state instead of
// playing the next group. Only React implements this; see the shared module's
// JSDoc for the extraction note on porting it to the other four bindings.
// ---------------------------------------------------------------------------

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

/**
 * Finish the browser animations that belong to one timeline group.
 *
 * Presentation mode can render three independently animated DOM surfaces:
 * whole elements, text-build spans, and the background-only paint layer used
 * by `p:bg`. Match each surface by its timeline element id and leave unrelated
 * animations on the page untouched.
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
	setPresentationElementStates: StateUpdater<Map<string, ElementAnimationState>>,
	completedStates?: ReadonlyMap<string, ElementAnimationState>,
): void {
	setPresentationElementStates((previousStates) => {
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
				animatesFill: holdsAnimatedPaint && step.colorTargets?.includes('fill') ? true : undefined,
				animatesStroke:
					holdsAnimatedPaint && step.colorTargets?.includes('stroke') ? true : undefined,
			});
		}
		return nextStates;
	});
}
