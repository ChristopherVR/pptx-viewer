import type { PptxAction, PptxSlide } from 'pptx-viewer-core';
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
	runPresentationEntranceAnimations: (slideIndex: number) => void;
	presentationTimersRef: { current: number[] };
	rehearsing: boolean;
	recordCurrentSlideTime: (slideIndex: number) => void;
	setShowRehearsalSummary: (value: boolean) => void;
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
		runPresentationEntranceAnimations,
		presentationTimersRef,
		rehearsing,
		recordCurrentSlideTime,
		setShowRehearsalSummary,
	} = input;

	const movePresentationSlideRef = useRef<(direction: 1 | -1) => void>(() => {});

	// -----------------------------------------------------------------------
	// Auto-advance scheduling (uses ref to break circular dependency)
	// -----------------------------------------------------------------------

	const scheduleAutoAdvanceForSlide = useCallback(
		(slideIndex: number) => {
			// When useTimings is explicitly false (manual advance mode), skip auto-advance
			if (useTimings === false) {
				return;
			}

			const slide = slides[slideIndex];
			const advanceAfterMs = slide?.transition?.advanceAfterMs;
			if (
				typeof advanceAfterMs !== 'number' ||
				!Number.isFinite(advanceAfterMs) ||
				advanceAfterMs < 0
			) {
				return;
			}

			const timer = window.setTimeout(
				() => {
					movePresentationSlideRef.current(1);
				},
				Math.max(0, advanceAfterMs),
			);
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

			const availableSlideIndexes =
				visibleSlideIndexes.length > 0
					? visibleSlideIndexes
					: slides.map((_slide, slideIndex) => slideIndex);
			if (availableSlideIndexes.length === 0) {
				return;
			}

			const currentVisiblePosition = availableSlideIndexes.indexOf(presentationSlideIndex);
			const normalizedCurrentPosition = currentVisiblePosition >= 0 ? currentVisiblePosition : 0;
			const nextPosition = normalizedCurrentPosition + direction;

			// --- Rehearsal: advancing past last slide ends rehearsal ---
			if (rehearsing && direction === 1 && nextPosition >= availableSlideIndexes.length) {
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
			if (
				!loopContinuously &&
				!rehearsing &&
				direction === 1 &&
				nextPosition >= availableSlideIndexes.length &&
				onAdvancePastLastSlide
			) {
				onAdvancePastLastSlide();
				return;
			}

			// Loop wrap: if advancing past the last slide and loop is enabled,
			// wrap around to the first slide instead of clamping.
			let resolvedPosition: number;
			if (
				loopContinuously &&
				!rehearsing &&
				direction === 1 &&
				nextPosition >= availableSlideIndexes.length
			) {
				resolvedPosition = 0;
			} else {
				resolvedPosition = Math.min(availableSlideIndexes.length - 1, Math.max(0, nextPosition));
			}
			const nextSlideIndex = availableSlideIndexes[resolvedPosition];
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
				runPresentationEntranceAnimations,
				scheduleAutoAdvanceForSlide: rehearsing ? undefined : scheduleAutoAdvanceForSlide,
				presentationTimersRef,
				setTransitionOverlay,
				// PowerPoint plays a slide's transition only when advancing into it.
				playTransition: direction === 1,
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
			runPresentationEntranceAnimations,
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
				runPresentationEntranceAnimations,
				scheduleAutoAdvanceForSlide,
				presentationTimersRef,
				setTransitionOverlay,
				// Direct jumps (action buttons, zoom tiles) are transition-less.
				playTransition: false,
			});
		},
		[
			clearPresentationTimers,
			onPlayActionSound,
			onSetActiveSlideIndex,
			presentationSlideIndex,
			presentationTimersRef,
			runPresentationEntranceAnimations,
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
			});
		},
		[movePresentationSlide, navigateToSlide, onPlayActionSound, onSetMode, slides.length],
	);

	return {
		movePresentationSlide,
		navigateToSlide,
		handlePresentationAction,
		scheduleAutoAdvanceForSlide,
	};
}
