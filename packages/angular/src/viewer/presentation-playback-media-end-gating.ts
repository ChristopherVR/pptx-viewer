/**
 * `presentation-playback-media-end-gating`: the Angular-local counterpart of
 * the shared `animation-media-end-gating`'s `applyMediaEndedStep`, split out
 * of `presentation-playback-helpers.ts` to stay within that file's line
 * budget.
 *
 * This file's own `PlaybackContext` (`presentation-playback-helpers.ts`) has
 * no `playSound`/`stopSound` fields, so it is not structurally assignable to
 * the shared `PlaybackContext` and the shared `applyMediaEndedStep` cannot be
 * called directly from here; this is a local copy operating on the local
 * shape instead.
 *
 * @module viewer/presentation-playback-media-end-gating
 */

import { zeroDelayCssAnimation } from '../internal/shared';
import type { TimelineStep } from '../internal/shared';
import type { PlaybackContext } from './presentation-playback-helpers';

/**
 * Apply a single `onStopAudio`-gated step's CSS the moment the media node it
 * depends on REALLY finishes, rather than the estimated `delayMs` baked into
 * `step.cssAnimation` at build time. Called from the corresponding
 * `<audio>`/`<video>` element's `ended` handler
 * (`presentation-playback-helpers.ts`'s `applyAnimationGroupSteps`).
 */
export function applyMediaEndedStep(step: TimelineStep, ctx: PlaybackContext): void {
	const cssAnimation = zeroDelayCssAnimation(step.cssAnimation);
	ctx.setStates((previous) => {
		const next = new Map(previous);
		const current = next.get(step.elementId) ?? { visible: true, cssAnimation: undefined };
		const shouldBeVisible = step.presetClass === 'exit' ? current.visible : true;
		next.set(step.elementId, {
			visible: shouldBeVisible,
			cssAnimation,
			animatesFill: step.colorTargets?.includes('fill') ? true : undefined,
			animatesStroke: step.colorTargets?.includes('stroke') ? true : undefined,
		});
		return next;
	});

	const timer = window.setTimeout(
		() => {
			ctx.setStates((previous) => {
				const next = new Map(previous);
				const current = next.get(step.elementId) ?? { visible: true, cssAnimation: undefined };
				const visibleAfter =
					step.presetClass === 'exit' || step.hideAfterEffect ? false : current.visible;
				next.set(step.elementId, {
					visible: visibleAfter,
					cssAnimation: step.holdEndState ? cssAnimation : undefined,
				});
				return next;
			});
		},
		Math.max(0, step.durationMs + 8),
	);
	ctx.timers.push(timer);
}
