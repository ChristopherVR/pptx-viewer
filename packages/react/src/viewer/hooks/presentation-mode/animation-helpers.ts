import { stopAnimationSound } from '../../utils/animation-sound';
import type { ElementAnimationState, TimelineClickGroup } from '../../utils/animation-timeline';
import { executeMediaCommand } from '../../utils/media-element-registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** State updater function (compatible with React useState setter). */
type StateUpdater<T> = (updater: T | ((prev: T) => T)) => void;

// ---------------------------------------------------------------------------
// Shared animation step application
// ---------------------------------------------------------------------------

/**
 * Apply an animation click-group's steps to the element states:
 * 1. Trigger sound effects (play or stop).
 * 2. Apply CSS animations to affected elements.
 * 3. Schedule cleanup timers to remove the CSS animation and update
 *    visibility after each step completes.
 */
export function applyAnimationGroupSteps(
	group: TimelineClickGroup,
	onPlayActionSound: ((soundPath: string) => void) | undefined,
	setPresentationElementStates: StateUpdater<Map<string, ElementAnimationState>>,
	presentationTimersRef: { current: number[] },
): void {
	// Trigger sound actions and media playback commands for this click-group.
	for (const step of group.steps) {
		if (step.command) {
			// `p:cmd` media command: drive the registered media element after the
			// step's delay (relative to the group start), never as a CSS effect.
			const command = step.command;
			const timer = window.setTimeout(
				() => {
					executeMediaCommand(command);
				},
				Math.max(0, step.delayMs),
			);
			presentationTimersRef.current.push(timer);
			continue;
		}
		if (step.stopSound) {
			stopAnimationSound();
		} else if (step.soundPath && onPlayActionSound) {
			onPlayActionSound(step.soundPath);
		}
	}

	// Apply initial CSS animation states
	setPresentationElementStates((previousStates: Map<string, ElementAnimationState>) => {
		const nextStates = new Map(previousStates);
		for (const step of group.steps) {
			if (step.command) {
				continue;
			}
			const currentState = nextStates.get(step.elementId) ?? {
				visible: true,
				cssAnimation: undefined,
			};
			const shouldBeVisible = step.presetClass === 'exit' ? currentState.visible : true;
			// Surface the step's colour targets during its active window so a
			// `p:animClr` fill/stroke recolour reaches the SVG vector (which then
			// paints with `fill: inherit` / `stroke: inherit` to receive the
			// wrapper's colour keyframe). Cleared by the cleanup timer below.
			const colorTargets = step.colorTargets;
			nextStates.set(step.elementId, {
				visible: shouldBeVisible,
				cssAnimation: step.cssAnimation,
				animatesFill: colorTargets?.includes('fill') ? true : undefined,
				animatesStroke: colorTargets?.includes('stroke') ? true : undefined,
			});
		}
		return nextStates;
	});

	// Schedule cleanup after each step's animation completes
	for (const step of group.steps) {
		if (step.command) {
			continue;
		}
		const timer = window.setTimeout(
			() => {
				setPresentationElementStates((previousStates: Map<string, ElementAnimationState>) => {
					const nextStates = new Map(previousStates);
					const currentState = nextStates.get(step.elementId) ?? {
						visible: true,
						cssAnimation: undefined,
					};
					// `afterAnimation: "hideAfterAnimation"` hides the element once its
					// (entrance/emphasis) effect ends, overriding the normal
					// presetClass-based visibility.
					const visibleAfterStep =
						step.presetClass === 'exit' || step.hideAfterEffect ? false : currentState.visible;
					// `p:cTn/@fill="hold"` (or "freeze"/"transition"): keep the CSS
					// animation attached so its final frame persists, instead of
					// dropping `fill-mode` along with the animation shorthand.
					nextStates.set(step.elementId, {
						visible: visibleAfterStep,
						cssAnimation: step.holdEndState ? step.cssAnimation : undefined,
					});
					return nextStates;
				});
			},
			Math.max(0, step.delayMs + step.durationMs + 8),
		);
		presentationTimersRef.current.push(timer);
	}
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
