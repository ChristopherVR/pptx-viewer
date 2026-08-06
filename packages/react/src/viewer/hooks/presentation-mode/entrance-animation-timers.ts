import type { PptxSlide } from 'pptx-viewer-core';
import type { PresentationAnimationController } from 'pptx-viewer-shared';

import type { PresentationAnimationRuntime } from '../../types';
import type { ElementAnimationState, TimelineClickGroup } from '../../utils/animation-timeline';
import { computeEntranceAnimationDelay } from '../usePresentationSetup-helpers';
import { applyAnimationGroupSteps } from './animation-helpers';

/** State updater function (compatible with a React useState setter). */
type StateUpdater<T> = (updater: T | ((prev: T) => T)) => void;

/** Everything the opening auto-play group needs to run and chain onward. */
export interface AutoPlayGroupDeps {
	onPlayActionSound?: (soundPath: string) => void;
	setPresentationElementStates: StateUpdater<Map<string, ElementAnimationState>>;
	presentationTimersRef: { current: number[] };
	/** Start the staged chart / SmartArt reveal loop for the played group. */
	startBuildReveal: (
		controller: PresentationAnimationController,
		group: TimelineClickGroup,
	) => void;
	/** Chain any consecutive auto-advance groups that follow. */
	scheduleAutoAdvanceChain: (controller: PresentationAnimationController) => void;
}

/**
 * Schedule the slide's OPENING click-group when the deck marks it as
 * auto-starting (a "With Previous" / "After Previous" first effect), so the
 * slide animates on entry with no click. No-op when the next group is
 * click-gated, which keeps a normal slide waiting for the presenter.
 */
export function scheduleOpeningAutoPlayGroup(
	controller: PresentationAnimationController,
	deps: AutoPlayGroupDeps,
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
		applyAnimationGroupSteps(
			group,
			deps.onPlayActionSound,
			deps.setPresentationElementStates,
			deps.presentationTimersRef,
		);
		deps.startBuildReveal(controller, group);
		deps.scheduleAutoAdvanceChain(controller);
	}, firstGroup.autoAdvanceDelayMs ?? 0);
	deps.presentationTimersRef.current.push(timer);
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
