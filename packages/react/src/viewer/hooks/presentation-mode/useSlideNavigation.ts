import type { PptxAction, PptxSlide } from 'pptx-viewer-core';
import {
	hasShowSlideAfter,
	nextShowSlideIndex,
	previousShowSlideIndex,
	resolveAutoAdvanceDelayMs,
} from 'pptx-viewer-shared';
import { useRef, useCallback } from 'react';

import type { ViewerMode } from '../../types';
import { handlePresentationActionImpl } from './presentation-actions';
import { executeSlideTransition } from './slide-transition';
import type { PresentationTransitionOverlayState, SlideAdvanceTrigger } from './types';

// ---------------------------------------------------------------------------
// Click-advance gating
// ---------------------------------------------------------------------------

/**
 * PowerPoint suppresses click-to-advance when a slide's transition sets
 * `advanceOnClick` to false: the show then advances only via timings or explicit
 * navigation. Returns true when a click-triggered forward advance must be
 * blocked. Backward moves and explicit navigation are never blocked, and an
 * undefined flag defaults to allowed (preserving existing behaviour).
 */
export function isClickAdvanceBlocked(
	slide: PptxSlide | undefined,
	direction: 1 | -1,
	trigger: SlideAdvanceTrigger,
): boolean {
	return trigger === 'click' && direction === 1 && slide?.transition?.advanceOnClick === false;
}

// ---------------------------------------------------------------------------
// Sub-hook interface
// ---------------------------------------------------------------------------

export interface UseSlideNavigationInput {
	slides: PptxSlide[];
	visibleSlideIndexes: number[];
	presentationSlideIndex: number;
	setPresentationSlideIndex: (index: number) => void;
	setPresentationSlideVisible: (visible: boolean) => void;
	setTransitionOverlay: (state: PresentationTransitionOverlayState | null) => void;
	onSetMode: (mode: ViewerMode) => void;
	onSetActiveSlideIndex: (index: number) => void;
	onPlayActionSound?: (soundPath: string) => void;
	loopContinuously?: boolean;
	/** Whether to use rehearsed auto-advance timings. When false, slides advance only on click. */
	useTimings?: boolean;
	/**
	 * Fired when the user advances past the last slide (no loop, no rehearsal).
	 * The presentation-mode hook uses it for PowerPoint's "End with black
	 * slide" behavior. When absent, advancing past the end clamps as before.
	 */
	onAdvancePastLastSlide?: () => void;
	playNextAnimationGroup: () => boolean;
	clearPresentationTimers: () => void;
	/** Seed the incoming slide's initial animation states (no playback). */
	seedSlideAnimations: (slideIndex: number, options?: { completed?: boolean }) => void;
	/** Start the seeded slide's playback (auto-play group + entrance timers). */
	startSlideAnimations: (slideIndex: number) => void;
	presentationTimersRef: { current: number[] };
	rehearsing: boolean;
	recordCurrentSlideTime: (slideIndex: number) => void;
	setShowRehearsalSummary: (value: boolean) => void;
	/** `ppaction://hlinkshowjump?jump=lastslideviewed`. */
	onLastViewed?: () => void;
	/** `ppaction://customshow?id=<id>[&return=true]`. */
	onCustomShow?: (customShowId: string, returnAfter: boolean) => void;
	/** `ppaction://hlinkfile`. */
	onOpenFile?: (target: string) => void;
	/** `ppaction://hlinkpres`. */
	onOpenPresentation?: (target: string) => void;
	/** `ppaction://media`. */
	onPlayMedia?: (elementId: string | undefined) => void;
}

export interface UseSlideNavigationResult {
	movePresentationSlide: (direction: 1 | -1, trigger?: SlideAdvanceTrigger) => void;
	navigateToSlide: (slideIndex: number) => void;
	handlePresentationAction: (action: PptxAction) => void;
	scheduleAutoAdvanceForSlide: (slideIndex: number) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSlideNavigation(input: UseSlideNavigationInput): UseSlideNavigationResult {
	const {
		slides,
		visibleSlideIndexes,
		presentationSlideIndex,
		setPresentationSlideIndex,
		setPresentationSlideVisible,
		setTransitionOverlay,
		onSetMode,
		onSetActiveSlideIndex,
		onPlayActionSound,
		loopContinuously,
		useTimings,
		onAdvancePastLastSlide,
		playNextAnimationGroup,
		clearPresentationTimers,
		seedSlideAnimations,
		startSlideAnimations,
		presentationTimersRef,
		rehearsing,
		recordCurrentSlideTime,
		setShowRehearsalSummary,
		onLastViewed,
		onCustomShow,
		onOpenFile,
		onOpenPresentation,
		onPlayMedia,
	} = input;

	const movePresentationSlideRef = useRef<(direction: 1 | -1) => void>(() => {});

	// -----------------------------------------------------------------------
	// Auto-advance scheduling (uses ref to break circular dependency)
	// -----------------------------------------------------------------------

	const scheduleAutoAdvanceForSlide = useCallback(
		(slideIndex: number) => {
			// PowerPoint's "Advance slide: After <n>" (`p:transition/@advTm`),
			// resolved by the shared helper every binding shares so a deck cannot
			// advance in one framework and stall in another. `useTimings === false`
			// is "Advance slides: Manually", which ignores authored timings.
			const delayMs = resolveAutoAdvanceDelayMs(slides[slideIndex], { useTimings });
			if (delayMs === undefined) {
				return;
			}

			const timer = window.setTimeout(() => {
				movePresentationSlideRef.current(1);
			}, delayMs);
			presentationTimersRef.current.push(timer);
		},
		[slides, presentationTimersRef, useTimings],
	);

	// -----------------------------------------------------------------------
	// Slide navigation
	// -----------------------------------------------------------------------

	const movePresentationSlide = useCallback(
		(direction: 1 | -1, trigger: SlideAdvanceTrigger = 'explicit') => {
			// A click/tap still steps through any pending element-animation builds,
			// but once they are exhausted PowerPoint only advances the slide on
			// click when the transition allows it (advanceOnClick !== false).
			if (direction === 1 && playNextAnimationGroup()) {
				return;
			}
			if (isClickAdvanceBlocked(slides[presentationSlideIndex], direction, trigger)) {
				return;
			}

			// The show order (custom-show membership minus hidden slides) is resolved
			// upstream; the shared helpers below turn it into "what comes next", so
			// a slide the author hid is skipped in every binding identically.
			const availableSlideIndexes =
				visibleSlideIndexes.length > 0
					? visibleSlideIndexes
					: slides.map((_slide, slideIndex) => slideIndex);
			if (availableSlideIndexes.length === 0) {
				return;
			}

			const pastLastSlide =
				direction === 1 && !hasShowSlideAfter(presentationSlideIndex, availableSlideIndexes);

			// --- Rehearsal: advancing past last slide ends rehearsal ---
			if (rehearsing && pastLastSlide) {
				recordCurrentSlideTime(presentationSlideIndex);
				try {
					if (document.fullscreenElement) {
						void document.exitFullscreen().catch(() => {
							/* ignore */
						});
					}
				} catch {
					/* ignore */
				}
				onSetMode('edit');
				setShowRehearsalSummary(true);
				return;
			}

			// Advancing past the last slide (no loop, not rehearsing): let the
			// presentation hook decide (black end-of-show slide or exit).
			if (!loopContinuously && !rehearsing && pastLastSlide && onAdvancePastLastSlide) {
				onAdvancePastLastSlide();
				return;
			}

			const nextSlideIndex =
				direction === 1
					? nextShowSlideIndex(presentationSlideIndex, availableSlideIndexes, {
							loop: Boolean(loopContinuously) && !rehearsing,
						})
					: previousShowSlideIndex(presentationSlideIndex, availableSlideIndexes);
			if (nextSlideIndex === undefined || nextSlideIndex === presentationSlideIndex) {
				return;
			}

			// Record timing for the slide we are leaving (rehearsal mode only)
			if (rehearsing && direction === 1) {
				recordCurrentSlideTime(presentationSlideIndex);
			}

			executeSlideTransition(nextSlideIndex, {
				slides,
				currentSlideIndex: presentationSlideIndex,
				onPlayActionSound,
				setPresentationSlideVisible,
				clearPresentationTimers,
				setPresentationSlideIndex,
				onSetActiveSlideIndex,
				seedSlideAnimations,
				startSlideAnimations,
				scheduleAutoAdvanceForSlide: rehearsing ? undefined : scheduleAutoAdvanceForSlide,
				presentationTimersRef,
				setTransitionOverlay,
				// PowerPoint plays a slide's transition only when advancing into it.
				playTransition: direction === 1,
				// Stepping back onto a slide shows it with its builds already played.
				seedCompleted: direction === -1,
			});
		},
		[
			clearPresentationTimers,
			loopContinuously,
			onAdvancePastLastSlide,
			onPlayActionSound,
			onSetActiveSlideIndex,
			onSetMode,
			playNextAnimationGroup,
			presentationSlideIndex,
			presentationTimersRef,
			recordCurrentSlideTime,
			rehearsing,
			seedSlideAnimations,
			startSlideAnimations,
			scheduleAutoAdvanceForSlide,
			setShowRehearsalSummary,
			slides,
			visibleSlideIndexes,
			setPresentationSlideVisible,
			setPresentationSlideIndex,
			setTransitionOverlay,
		],
	);

	// Keep the ref in sync so scheduleAutoAdvanceForSlide always calls the
	// latest version of movePresentationSlide.
	movePresentationSlideRef.current = movePresentationSlide;

	// -----------------------------------------------------------------------
	// Direct slide navigation (for action buttons / slide jumps)
	// -----------------------------------------------------------------------

	const navigateToSlide = useCallback(
		(targetIndex: number) => {
			if (targetIndex < 0 || targetIndex >= slides.length) {
				return;
			}
			if (targetIndex === presentationSlideIndex) {
				return;
			}

			executeSlideTransition(targetIndex, {
				slides,
				currentSlideIndex: presentationSlideIndex,
				onPlayActionSound,
				setPresentationSlideVisible,
				clearPresentationTimers,
				setPresentationSlideIndex,
				onSetActiveSlideIndex,
				seedSlideAnimations,
				startSlideAnimations,
				scheduleAutoAdvanceForSlide,
				presentationTimersRef,
				setTransitionOverlay,
				// A jump ENTERS the target slide, so PowerPoint plays that slide's
				// transition exactly as it does for a forward advance - hyperlinks,
				// action buttons, Home/End and "type a number + Enter" all animate.
				// Suppressing it here is why a deck navigated by clicking its own
				// on-slide links (this is how the issue #131 reporter drives their
				// wheel menu) appeared to have no morph at all, while the same
				// transition played fine on PageDown.
				playTransition: true,
			});
		},
		[
			clearPresentationTimers,
			onPlayActionSound,
			onSetActiveSlideIndex,
			presentationSlideIndex,
			presentationTimersRef,
			seedSlideAnimations,
			startSlideAnimations,
			scheduleAutoAdvanceForSlide,
			slides,
			setPresentationSlideIndex,
			setPresentationSlideVisible,
			setTransitionOverlay,
		],
	);

	// -----------------------------------------------------------------------
	// Presentation action handler (action buttons, hyperlinks, slide jumps)
	// -----------------------------------------------------------------------

	const handlePresentationAction = useCallback(
		(action: PptxAction) => {
			handlePresentationActionImpl(action, {
				movePresentationSlide,
				navigateToSlide,
				onPlayActionSound,
				onSetMode,
				slidesLength: slides.length,
				onLastViewed,
				onCustomShow,
				onOpenFile,
				onOpenPresentation,
				onPlayMedia,
			});
		},
		[
			movePresentationSlide,
			navigateToSlide,
			onPlayActionSound,
			onSetMode,
			slides.length,
			onLastViewed,
			onCustomShow,
			onOpenFile,
			onOpenPresentation,
			onPlayMedia,
		],
	);

	return {
		movePresentationSlide,
		navigateToSlide,
		handlePresentationAction,
		scheduleAutoAdvanceForSlide,
	};
}
