import type { PptxSlide } from 'pptx-viewer-core';
import type { PresentationActionRunner } from 'pptx-viewer-shared';
import { handlePresentationStageClick, isClickAdvanceAllowed } from 'pptx-viewer-shared';

/** Inputs to the swipe/tap advance gate, read from the live viewer state. */
export interface SwipeAdvanceGateInput {
	/** True only while the live (fullscreen) presentation show is running. */
	presenting: boolean;
	/** True when the current slide's on-click animation builds are all revealed. */
	animationBuildsComplete: boolean;
	/** The slide the show currently displays. */
	currentSlide: PptxSlide | undefined;
}

/**
 * Whether a swipe / tap during a running show must be swallowed instead of
 * advancing to the next slide. This mirrors PowerPoint's "On Mouse Click"
 * gate: a swipe/tap still steps the current slide's remaining animation builds,
 * but once those are exhausted it only advances the slide when the slide's
 * transition allows it (advanceOnClick !== false). Outside a running show (a
 * preview-mode swipe) nothing is gated, and keyboard / on-screen next-button
 * navigation never calls this at all.
 */
export function isSwipeAdvanceBlocked(input: SwipeAdvanceGateInput): boolean {
	return (
		input.presenting && input.animationBuildsComplete && !isClickAdvanceAllowed(input.currentSlide)
	);
}

/** Inputs to the full stage-click decision (action first, then advance). */
export interface PresentationStageClickInput extends SwipeAdvanceGateInput {
	/** The clicked node, used to find the on-slide action under the pointer. */
	target: EventTarget | null;
	/** Deck length, used to clamp a jump target. */
	slideCount: number;
	/** The show's navigation, for an action that navigates. */
	runner: PresentationActionRunner;
}

/**
 * The whole "what does this click mean" decision for a running show, in one
 * testable place rather than inline in the chrome's listener.
 *
 * PowerPoint's precedence: an on-slide Action Setting under the pointer runs
 * and consumes the click; live content and show chrome own their own clicks;
 * only what is left over advances, and then only if the slide's
 * `advanceOnClick` gate allows it.
 *
 * @returns `true` when the caller should advance the show.
 */
export function resolvePresentationStageClick(input: PresentationStageClickInput): boolean {
	const outcome = handlePresentationStageClick(
		input.target,
		input.currentSlide,
		{ slideCount: input.slideCount },
		input.runner,
	);
	if (outcome !== 'advance') {
		return false;
	}
	return !isSwipeAdvanceBlocked(input);
}
