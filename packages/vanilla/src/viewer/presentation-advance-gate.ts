import type { PptxSlide } from 'pptx-viewer-core';
import { isClickAdvanceAllowed } from 'pptx-viewer-shared';

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
