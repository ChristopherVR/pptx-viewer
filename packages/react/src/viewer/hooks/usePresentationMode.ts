import { useState, useCallback, useEffect, useRef } from 'react';

import type {
	UsePresentationModeInput,
	UsePresentationModeResult,
} from './presentation-mode/types';
import { useAnimationPlayback } from './presentation-mode/useAnimationPlayback';
import { useAudienceMode } from './presentation-mode/useAudienceMode';
import { usePresentationKeyboard } from './presentation-mode/usePresentationKeyboard';
import { usePresenterWindow } from './presentation-mode/usePresenterWindow';
import { useRehearsalTimings } from './presentation-mode/useRehearsalTimings';
import { useSlideNavigation } from './presentation-mode/useSlideNavigation';
import { useZoomNavigation } from './presentation-mode/useZoomNavigation';

export type { UsePresentationModeInput, UsePresentationModeResult };

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePresentationMode(input: UsePresentationModeInput): UsePresentationModeResult {
	const {
		mode,
		slides,
		visibleSlideIndexes,
		activeSlideIndex,
		containerRef,
		content,
		onSetMode,
		onSetActiveSlideIndex,
		onPlayActionSound,
		onToggleLaser,
		onTogglePen,
		onToggleEraser,
		onToggleToolbar,
		onSaveRehearsalTimings,
		loopContinuously,
		showWithAnimation,
		useTimings,
	} = input;

	// -----------------------------------------------------------------------
	// Shared state
	// -----------------------------------------------------------------------

	const [presentationSlideIndex, setPresentationSlideIndex] = useState(0);
	const [presentationSlideVisible, setPresentationSlideVisible] = useState(true);
	const [presenterMode, setPresenterMode] = useState(false);
	const [presentationStartTime, setPresentationStartTime] = useState<number | null>(null);
	// Guards against the fullscreenchange listener exiting present mode
	// when we intentionally exit fullscreen to switch to presenter view.
	const switchingToPresenterRef = useRef(false);

	// -----------------------------------------------------------------------
	// Sub-hooks
	// -----------------------------------------------------------------------

	const {
		presentationAnimations,
		presentationElementStates,
		presentationKeyframesCss,
		interactiveTriggerShapeIds,
		hoverTriggerShapeIds,
		clearPresentationTimers,
		playNextAnimationGroup,
		handleInteractiveShapeClick,
		handleHoverStart,
		handleHoverEnd,
		runPresentationEntranceAnimations,
		presentationTimersRef,
	} = useAnimationPlayback({ slides, onPlayActionSound, showWithAnimation });

	const {
		rehearsing,
		setRehearsing,
		recordedTimings,
		slideStartTime,
		showRehearsalSummary,
		setShowRehearsalSummary,
		rehearsalPaused,
		recordCurrentSlideTime,
		dismissRehearsalSummary,
		saveRehearsalTimings,
		enterRehearsalMode,
		toggleRehearsalPause,
	} = useRehearsalTimings({
		containerRef,
		onSetMode,
		onSaveRehearsalTimings,
		setPresentationStartTime,
		setPresenterMode,
	});

	const {
		movePresentationSlide,
		navigateToSlide,
		handlePresentationAction,
		scheduleAutoAdvanceForSlide,
	} = useSlideNavigation({
		slides,
		visibleSlideIndexes,
		presentationSlideIndex,
		setPresentationSlideIndex,
		setPresentationSlideVisible,
		onSetMode,
		onSetActiveSlideIndex,
		onPlayActionSound,
		loopContinuously,
		useTimings,
		playNextAnimationGroup,
		clearPresentationTimers,
		runPresentationEntranceAnimations,
		presentationTimersRef,
		rehearsing,
		recordCurrentSlideTime,
		setShowRehearsalSummary,
	});

	const { handleZoomClick, zoomReturnSlideIndex, returnToZoomSlide, clearZoomReturn } =
		useZoomNavigation({ navigateToSlide });

	const { openAudienceWindow, closeAudienceWindow, isAudienceWindowOpen, syncSlideToAudience } =
		usePresenterWindow({
			currentSlideIndex: presentationSlideIndex,
			isPresenterMode: presenterMode,
			content,
		});

	// Audience tab auto-enters present mode and syncs slides via BroadcastChannel
	useAudienceMode({
		mode,
		onSetMode,
		onSetActiveSlideIndex,
		containerRef,
	});

	// -----------------------------------------------------------------------
	// Enter present mode — call from a click handler so requestFullscreen works
	// -----------------------------------------------------------------------

	const enterPresentMode = useCallback(() => {
		setPresenterMode(false);
		setRehearsing(false);
		setPresentationStartTime(Date.now());
		// Request fullscreen synchronously within the user gesture call-stack
		try {
			const wrapper = containerRef.current;
			if (wrapper && typeof wrapper.requestFullscreen === 'function') {
				void wrapper.requestFullscreen().catch(() => {
					/* ignore fullscreen errors */
				});
			}
		} catch {
			/* fullscreen not supported */
		}
		onSetMode('present');
	}, [containerRef, onSetMode, setRehearsing]);

	const enterPresenterView = useCallback(() => {
		setPresenterMode(true);
		setRehearsing(false);
		setPresentationStartTime(Date.now());
		onSetMode('present');
	}, [onSetMode, setRehearsing]);

	/**
	 * Toggle between presenter view (split-screen with notes) and regular
	 * fullscreen presentation. Triggered by the `N` key during presentation.
	 */
	const togglePresenterView = useCallback(() => {
		if (!presenterMode) {
			// Switch from fullscreen to presenter view — exit fullscreen first.
			// Set the guard so the fullscreenchange listener doesn't exit
			// present mode when it sees fullscreen disappear.
			switchingToPresenterRef.current = true;
			try {
				if (document.fullscreenElement) {
					void document.exitFullscreen().catch(() => {
						/* ignore */
					});
				}
			} catch {
				/* fullscreen not supported */
			}
			setPresenterMode(true);
			if (!presentationStartTime) {
				setPresentationStartTime(Date.now());
			}
		} else {
			// Switch from presenter view to fullscreen
			setPresenterMode(false);
			try {
				const wrapper = containerRef.current;
				if (wrapper && typeof wrapper.requestFullscreen === 'function') {
					void wrapper.requestFullscreen().catch(() => {
						/* ignore fullscreen errors */
					});
				}
			} catch {
				/* fullscreen not supported */
			}
		}
	}, [presenterMode, presentationStartTime, containerRef]);

	// -----------------------------------------------------------------------
	// Keyboard navigation
	// -----------------------------------------------------------------------

	usePresentationKeyboard({
		mode,
		movePresentationSlide,
		onSetMode,
		onToggleLaser,
		onTogglePen,
		onToggleEraser,
		onToggleToolbar,
		onTogglePresenterView: togglePresenterView,
		rehearsing,
		recordCurrentSlideTime,
		presentationSlideIndex,
		setShowRehearsalSummary,
	});

	// -----------------------------------------------------------------------
	// Present-mode initialisation effect (animations, auto-advance)
	// -----------------------------------------------------------------------

	// Use refs for callbacks whose identity changes on every render (they
	// depend on `slides` and other frequently-changing values). Without this,
	// the effect re-runs → calls setPresentationSlideIndex → re-render →
	// callbacks get new identity → effect re-runs → infinite loop.
	const runEntranceAnimationsRef = useRef(runPresentationEntranceAnimations);
	runEntranceAnimationsRef.current = runPresentationEntranceAnimations;
	const scheduleAutoAdvanceRef = useRef(scheduleAutoAdvanceForSlide);
	scheduleAutoAdvanceRef.current = scheduleAutoAdvanceForSlide;
	const activeSlideIndexRef = useRef(activeSlideIndex);
	activeSlideIndexRef.current = activeSlideIndex;

	useEffect(() => {
		if (mode === 'present') {
			// Only runs when entering present mode (mode changes to "present").
			// Slide-to-slide navigation during presentation is handled entirely
			// by executeSlideTransition — re-running here on every activeSlideIndex
			// change would duplicate entrance animations and cause visible lag.
			const idx = activeSlideIndexRef.current;
			setPresentationSlideIndex(idx);
			runEntranceAnimationsRef.current(idx);
			scheduleAutoAdvanceRef.current(idx);
		}
		// NOTE: fullscreen exit is handled by the dedicated effect below —
		// doing it here would fire on every dependency change (e.g. slide
		// navigation) and race with the fullscreenchange listener.
	}, [mode]);

	// Exit fullscreen only when truly leaving present mode (not on every
	// dependency change of the initialisation effect above).
	useEffect(() => {
		if (mode !== 'present') {
			return;
		}
		return () => {
			try {
				if (document.fullscreenElement) {
					void document.exitFullscreen().catch(() => {
						/* ignore */
					});
				}
			} catch {
				/* fullscreen not supported */
			}
		};
	}, [mode]);

	// Sync mode when user exits fullscreen via browser chrome / Escape.
	// We track whether fullscreen was actually entered so we don't
	// immediately exit when requestFullscreen() is still in-flight.
	useEffect(() => {
		if (mode !== 'present') {
			return;
		}
		// In presenter view mode, we don't use fullscreen, so skip this listener
		if (presenterMode) {
			return;
		}

		let wasFullscreen = Boolean(document.fullscreenElement);

		const handleFullscreenChange = () => {
			// When toggling to presenter view, we intentionally exit fullscreen.
			// Don't treat that as "user wants to leave present mode".
			if (switchingToPresenterRef.current) {
				switchingToPresenterRef.current = false;
				wasFullscreen = Boolean(document.fullscreenElement);
				return;
			}
			const isFullscreen = Boolean(document.fullscreenElement);
			if (wasFullscreen && !isFullscreen) {
				// Transitioned FROM fullscreen TO non-fullscreen → exit present mode
				if (rehearsing) {
					recordCurrentSlideTime(presentationSlideIndex);
					setShowRehearsalSummary(true);
				}
				onSetMode('edit');
			}
			wasFullscreen = isFullscreen;
		};
		document.addEventListener('fullscreenchange', handleFullscreenChange);
		return () => {
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
		};
	}, [
		mode,
		onSetMode,
		presenterMode,
		rehearsing,
		recordCurrentSlideTime,
		presentationSlideIndex,
		setShowRehearsalSummary,
	]);

	// -----------------------------------------------------------------------
	// Cleanup on unmount
	// -----------------------------------------------------------------------

	useEffect(() => {
		const timersRef = presentationTimersRef;
		return () => {
			timersRef.current.forEach((timer) => {
				window.clearTimeout(timer);
			});
		};
	}, [presentationTimersRef]);

	// -----------------------------------------------------------------------
	// Return
	// -----------------------------------------------------------------------

	return {
		presentationSlideIndex,
		setPresentationSlideIndex,
		presentationSlideVisible,
		presentationAnimations,
		presentationElementStates,
		presentationKeyframesCss,
		clearPresentationTimers,
		runPresentationEntranceAnimations,
		movePresentationSlide,
		navigateToSlide,
		handlePresentationAction,
		handleInteractiveShapeClick,
		interactiveTriggerShapeIds,
		hoverTriggerShapeIds,
		handleHoverStart,
		handleHoverEnd,
		enterPresentMode,
		presenterMode,
		enterPresenterView,
		togglePresenterView,
		presentationStartTime,
		rehearsing,
		enterRehearsalMode,
		recordedTimings,
		slideStartTime,
		showRehearsalSummary,
		dismissRehearsalSummary,
		saveRehearsalTimings,
		rehearsalPaused,
		toggleRehearsalPause,
		handleZoomClick,
		zoomReturnSlideIndex,
		returnToZoomSlide,
		clearZoomReturn,
		openAudienceWindow,
		closeAudienceWindow,
		isAudienceWindowOpen,
		syncSlideToAudience,
	};
}
