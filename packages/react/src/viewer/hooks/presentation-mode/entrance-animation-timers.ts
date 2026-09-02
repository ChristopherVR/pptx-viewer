import type { PptxSlide } from 'pptx-viewer-core';
import type { PlaybackContext, PresentationAnimationController } from 'pptx-viewer-shared';
import { playGroup, scheduleAutoAdvanceChain } from 'pptx-viewer-shared';

import type { PresentationAnimationRuntime } from '../../types';
import { computeEntranceAnimationDelay } from '../usePresentationSetup-helpers';

/** State updater function (compatible with a React useState setter). */
type StateUpdater<T> = (updater: T | ((prev: T) => T)) => void;

/**
 * Schedule the slide's OPENING click-group when the deck marks it as
 * auto-starting (a "With Previous" / "After Previous" first effect), so the
 * slide animates on entry with no click. No-op when the next group is
 * click-gated, which keeps a normal slide waiting for the presenter.
 */
export function scheduleOpeningAutoPlayGroup(
	controller: PresentationAnimationController,
	ctx: PlaybackContext,
): void {
	if (!controller.hasMoreSteps()) {
		return;
	}
	const firstGroup = controller.peekNext();
	if (!firstGroup?.autoAdvance) {
		return;
	}
	const timer = window.setTimeout(() => {
		const group = controller.advance();
		if (!group) {
			return;
		}
		playGroup(controller, group, ctx);
		scheduleAutoAdvanceChain(controller, ctx);
	}, firstGroup.autoAdvanceDelayMs ?? 0);
	ctx.timers.push(timer);
}

/**
 * Schedule the legacy preset (`slide.animations`) entrance timers for a slide.
 *
 * This is the older `PptxElementAnimation` model that predates the native
 * `p:timing` timeline: each entrance-flagged animation starts `hidden` and
 * flips to `visible` after its computed delay. Extracted from
 * `useAnimationPlayback` so the hook stays focused on the native timeline (and
 * within the repo's file-size budget); it is pure scheduling with no React
 * dependency beyond the setter it is handed.
 *
 * Returns immediately when the slide carries no entrance presets, leaving the
 * runtime list untouched.
 */
export function scheduleEntranceAnimationTimers(
	slide: PptxSlide,
	setPresentationAnimations: StateUpdater<PresentationAnimationRuntime[]>,
	presentationTimersRef: { current: number[] },
): void {
	const entranceAnimations = [...(slide.animations || [])]
		.filter((animation) => Boolean(animation.entrance))
		.sort(
			(left, right) =>
				(left.order || Number.MAX_SAFE_INTEGER) - (right.order || Number.MAX_SAFE_INTEGER),
		);
	if (entranceAnimations.length === 0) {
		return;
	}

	setPresentationAnimations(
		entranceAnimations.map((animation) => ({
			elementId: animation.elementId,
			state: 'hidden',
			animation,
		})),
	);

	entranceAnimations.forEach((animation, animationIndex) => {
		const delay = computeEntranceAnimationDelay(animation.delayMs, animationIndex);
		const timer = window.setTimeout(() => {
			setPresentationAnimations((previousAnimations) =>
				previousAnimations.map((entry) =>
					entry.elementId === animation.elementId ? { ...entry, state: 'visible' } : entry,
				),
			);
		}, delay);
		presentationTimersRef.current.push(timer);
	});
}
