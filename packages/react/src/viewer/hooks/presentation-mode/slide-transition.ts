import type { PptxSlide } from 'pptx-viewer-core';
import { resolveTransitionDurationMs } from 'pptx-viewer-shared';

import type { PresentationTransitionOverlayState } from './types';
import type { SeedSlideAnimationOptions } from './useAnimationPlayback';

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
	/**
	 * Seed the incoming slide's animation timeline (initial hidden states)
	 * WITHOUT starting playback. Called synchronously with the slide swap so the
	 * incoming slide never paints its animated elements at their final state.
	 */
	seedSlideAnimations: (slideIndex: number, options?: SeedSlideAnimationOptions) => void;
	/** Start playback (auto-play group + entrance timers) for the seeded slide. */
	startSlideAnimations: (slideIndex: number) => void;
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
	/**
	 * Seed the incoming slide as fully built rather than replaying it. Set when
	 * stepping BACKWARD onto a slide, which PowerPoint shows with its builds
	 * already complete.
	 */
	seedCompleted?: boolean;
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
	// overlay (if any) animates the outgoing slide on top. The animation timeline
	// is seeded in the SAME batch, so the incoming slide's first paint already
	// has its entrance-animated elements hidden. Deferring the seed until the
	// transition finished rendered every animated element at its FINAL state
	// under (and through) the overlay, then snapped them back to replay.
	deps.setPresentationSlideIndex(nextSlideIndex);
	deps.onSetActiveSlideIndex(nextSlideIndex);
	deps.setPresentationSlideVisible(true);
	deps.seedSlideAnimations(nextSlideIndex, { completed: deps.seedCompleted });

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
		// Playback (auto-play builds, entrance timers, auto-advance) still waits
		// for the transition, so builds don't run underneath the overlay.
		const timer = window.setTimeout(() => {
			deps.startSlideAnimations(nextSlideIndex);
			deps.scheduleAutoAdvanceForSlide?.(nextSlideIndex);
		}, durationMs);
		deps.presentationTimersRef.current.push(timer);
		return;
	}

	// Instant transition (none / cut / backward / jump): reveal at once.
	deps.setTransitionOverlay(null);
	deps.startSlideAnimations(nextSlideIndex);
	deps.scheduleAutoAdvanceForSlide?.(nextSlideIndex);
}
