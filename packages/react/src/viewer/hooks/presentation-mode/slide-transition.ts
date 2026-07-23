import type { PptxSlide } from 'pptx-viewer-core';
import { resolveTransitionDurationMs } from 'pptx-viewer-shared';

import type { PresentationTransitionOverlayState } from './types';

// ---------------------------------------------------------------------------
// Shared slide transition logic
// ---------------------------------------------------------------------------

export interface SlideTransitionDeps {
	slides: PptxSlide[];
	currentSlideIndex: number;
	onPlayActionSound?: (soundPath: string, options?: { loop?: boolean }) => void;
	setPresentationSlideVisible: (visible: boolean) => void;
	clearPresentationTimers: () => void;
	setPresentationSlideIndex: (index: number) => void;
	onSetActiveSlideIndex: (index: number) => void;
	runPresentationEntranceAnimations: (slideIndex: number) => void;
	scheduleAutoAdvanceForSlide?: (slideIndex: number) => void;
	presentationTimersRef: { current: number[] };
	/** Mount the transition overlay (or clear it with `null`). */
	setTransitionOverlay: (state: PresentationTransitionOverlayState | null) => void;
	/**
	 * Whether this navigation should play the incoming slide's transition.
	 * Forward steps play it (matching PowerPoint); backward steps and direct
	 * jumps are instant.
	 */
	playTransition: boolean;
}

/**
 * Execute a slide transition.
 *
 * The incoming slide is swapped onto the main stage immediately. When the
 * incoming slide carries a real (non-instant) `p:transition` and this is a
 * forward navigation, the outgoing slide is snapshotted into an animated
 * overlay layer that plays over the new slide for the transition's duration
 * (mirroring the Vue/Angular bindings). Entrance animations and auto-advance
 * are deferred until the transition has played so the incoming slide's builds
 * don't start underneath the overlay. For instant transitions the slide is
 * revealed at once with no overlay.
 */
export function executeSlideTransition(nextSlideIndex: number, deps: SlideTransitionDeps): void {
	const incomingSlide = deps.slides[nextSlideIndex];
	const transition = incomingSlide?.transition;
	const durationMs = deps.playTransition ? resolveTransitionDurationMs(transition) : 0;

	deps.clearPresentationTimers();

	// Swap to the incoming slide immediately: the main stage renders it while the
	// overlay (if any) animates the outgoing slide on top.
	deps.setPresentationSlideIndex(nextSlideIndex);
	deps.onSetActiveSlideIndex(nextSlideIndex);
	deps.setPresentationSlideVisible(true);

	if (durationMs > 0 && transition) {
		if (transition.soundPath && deps.onPlayActionSound) {
			deps.onPlayActionSound(transition.soundPath, { loop: transition.soundLoop === true });
		}
		deps.setTransitionOverlay({
			outgoingSlideIndex: deps.currentSlideIndex,
			incomingSlideIndex: nextSlideIndex,
			transition,
			durationMs,
		});
		const timer = window.setTimeout(() => {
			deps.runPresentationEntranceAnimations(nextSlideIndex);
			deps.scheduleAutoAdvanceForSlide?.(nextSlideIndex);
		}, durationMs);
		deps.presentationTimersRef.current.push(timer);
		return;
	}

	// Instant transition (none / cut / backward / jump): reveal at once.
	deps.setTransitionOverlay(null);
	deps.runPresentationEntranceAnimations(nextSlideIndex);
	deps.scheduleAutoAdvanceForSlide?.(nextSlideIndex);
}
