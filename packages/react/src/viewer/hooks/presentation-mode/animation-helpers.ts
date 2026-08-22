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
