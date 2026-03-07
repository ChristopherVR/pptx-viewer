import type {
  ElementAnimationState,
  TimelineClickGroup,
} from "../../utils/animation-timeline";
import { stopAnimationSound } from "../../utils/animation-sound";

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
  setPresentationElementStates: StateUpdater<
    Map<string, ElementAnimationState>
  >,
  presentationTimersRef: { current: number[] },
): void {
  // Trigger sound actions for steps in this click-group
  for (const step of group.steps) {
    if (step.stopSound) {
      stopAnimationSound();
    } else if (step.soundPath && onPlayActionSound) {
      onPlayActionSound(step.soundPath);
    }
  }

  // Apply initial CSS animation states
  setPresentationElementStates(
    (previousStates: Map<string, ElementAnimationState>) => {
      const nextStates = new Map(previousStates);
      for (const step of group.steps) {
        const currentState = nextStates.get(step.elementId) ?? {
          visible: true,
          cssAnimation: undefined,
        };
        const shouldBeVisible =
          step.presetClass === "exit" ? currentState.visible : true;
        nextStates.set(step.elementId, {
          visible: shouldBeVisible,
          cssAnimation: step.cssAnimation,
        });
      }
      return nextStates;
    },
  );

  // Schedule cleanup after each step's animation completes
  for (const step of group.steps) {
    const timer = window.setTimeout(
      () => {
        setPresentationElementStates(
          (previousStates: Map<string, ElementAnimationState>) => {
            const nextStates = new Map(previousStates);
            const currentState = nextStates.get(step.elementId) ?? {
              visible: true,
              cssAnimation: undefined,
            };
            const visibleAfterStep =
              step.presetClass === "exit" ? false : currentState.visible;
            nextStates.set(step.elementId, {
              visible: visibleAfterStep,
              cssAnimation: undefined,
            });
            return nextStates;
          },
        );
      },
      Math.max(0, step.delayMs + step.durationMs + 8),
    );
    presentationTimersRef.current.push(timer);
  }
}
