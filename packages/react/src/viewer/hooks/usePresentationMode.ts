import {
	attachPresentationVisibilityPause,
	buildMorphAnimationRules,
	buildMorphTransitionPlan,
	createPresenterShowGuard,
	morphOptionToMode,
} from 'pptx-viewer-shared';
import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import { acceptsPresentationInput } from './presentation-mode/audience-content-store';
import type {
	PresentationTransitionOverlayState,
	SlideAdvanceTrigger,
	UsePresentationModeInput,
	UsePresentationModeResult,
} from './presentation-mode/types';
import { useAnimationPlayback } from './presentation-mode/useAnimationPlayback';
import { useAudienceMode } from './presentation-mode/useAudienceMode';
import { usePresentationKeyboard } from './presentation-mode/usePresentationKeyboard';
import { usePresenterConsole } from './presentation-mode/usePresenterConsole';
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
		onSetPointerTool,
		onEraseAnnotations,
		onToggleInkMarkup,
		onToggleToolbar,
		onSaveRehearsalTimings,
		loopContinuously,
		showWithAnimation,
		useTimings,
		endWithBlackSlide = true,
	} = input;

	// -----------------------------------------------------------------------
	// Shared state
	// -----------------------------------------------------------------------

	const [presentationSlideIndex, setPresentationSlideIndex] = useState(0);
	const [presentationSlideVisible, setPresentationSlideVisible] = useState(true);
	const [transitionOverlay, setTransitionOverlay] =
		useState<PresentationTransitionOverlayState | null>(null);
	const handleTransitionOverlayComplete = useCallback(() => {
		setTransitionOverlay(null);
	}, []);
	const [presenterMode, setPresenterMode] = useState(false);
	// PowerPoint's Ctrl+S "All Slides" navigator, available during the show.
	const [allSlidesOpen, setAllSlidesOpen] = useState(false);
	// Black "End of slide show" screen shown after advancing past the last
	// slide (Options > Advanced > "End with black slide").
	const [endOfShowVisible, setEndOfShowVisible] = useState(false);
	const [presentationStartTime, setPresentationStartTime] = useState<number | null>(null);
	// Guards against the fullscreenchange listener exiting present mode when we
	// intentionally leave fullscreen to switch to presenter view. React grew this
	// latch first, as a private ref; it is now shared so the other four bindings
	// classify the same exit the same way (see `presenter-show-lifecycle`).
	const showGuard = useMemo(() => createPresenterShowGuard(), []);

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
		seedSlideAnimations,
		startSlideAnimations,
		isSeededCompleted,
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

	// Leaving the show for ANY reason also ends the presenter console. Without
	// this the console stayed "open" after the show exited, so the audience
	// window was never told to close and sat on the last slide indefinitely.
	useEffect(() => {
		if (mode !== 'present') {
			setPresenterMode(false);
		}
	}, [mode]);

	// Advancing past the last slide either shows the black end-of-show
	// screen (PowerPoint's "End with black slide") or exits directly.
	const handleAdvancePastLastSlide = useCallback(() => {
		if (endWithBlackSlide) {
			setEndOfShowVisible(true);
		} else {
			onSetMode('edit');
		}
	}, [endWithBlackSlide, onSetMode]);

	const {
		movePresentationSlide: moveNavigationSlide,
		navigateToSlide,
		handlePresentationAction,
		scheduleAutoAdvanceForSlide,
	} = useSlideNavigation({
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
		onAdvancePastLastSlide: handleAdvancePastLastSlide,
		playNextAnimationGroup,
		clearPresentationTimers,
		seedSlideAnimations,
		startSlideAnimations,
		presentationTimersRef,
		rehearsing,
		recordCurrentSlideTime,
		setShowRehearsalSummary,
	});

	// While the end-of-show screen is up, the next forward advance exits the
	// show and a backward advance returns to the last slide.
	const movePresentationSlide = useCallback(
		(direction: 1 | -1, trigger: SlideAdvanceTrigger = 'explicit') => {
			// An audience display mirrors the presenter and never drives itself: a
			// tap or swipe of its own would move it off the presenter's slide, and
			// the next snapshot would drag it back.
			if (!acceptsPresentationInput()) {
				return;
			}
			if (endOfShowVisible) {
				setEndOfShowVisible(false);
				if (direction === 1) {
					onSetMode('edit');
				}
				return;
			}
			// A slide entered backward shows its builds already complete. The next
			// back press replays them from the start rather than leaving the slide,
			// so a presenter who overshot can watch the build again (PowerPoint).
			if (direction === -1 && isSeededCompleted()) {
				runPresentationEntranceAnimations(presentationSlideIndex);
				return;
			}
			moveNavigationSlide(direction, trigger);
		},
		[
			endOfShowVisible,
			isSeededCompleted,
			moveNavigationSlide,
			onSetMode,
			presentationSlideIndex,
			runPresentationEntranceAnimations,
		],
	);

	const { handleZoomClick, zoomReturnSlideIndex, returnToZoomSlide, clearZoomReturn } =
		useZoomNavigation({ navigateToSlide });
	const openAllSlides = useCallback(() => setAllSlidesOpen(true), []);
	const closeAllSlides = useCallback(() => setAllSlidesOpen(false), []);
	// Gated on the show being live: this hook is mounted for the whole session,
	// so an always-on console clock re-rendered the entire editor at 1 Hz while
	// the user was only editing (issue #145).
	const presenterConsole = usePresenterConsole(presentationSlideIndex, mode === 'present');

	const {
		openAudienceWindow,
		closeAudienceWindow,
		isAudienceWindowOpen,
		syncSlideToAudience,
		syncStateToAudience,
		swapDisplays,
	} = usePresenterWindow({
		currentSlideIndex: presentationSlideIndex,
		isPresenterMode: presenterMode,
		content,
		snapshot: presenterConsole.snapshot,
	});

	// Audience tab auto-enters present mode and syncs slides via BroadcastChannel
	useAudienceMode({
		mode,
		onSetMode,
		onSetActiveSlideIndex: (index) => {
			onSetActiveSlideIndex(index);
			setPresentationSlideIndex(index);
		},
		containerRef,
		onSnapshot: presenterConsole.applyAudienceSnapshot,
		// The presenter ended the session but this tab could not close itself:
		// show the black end-of-slide-show screen rather than the editor.
		onPresenterEnded: () => setEndOfShowVisible(true),
	});

	// -----------------------------------------------------------------------
	// Enter present mode: call from a click handler so requestFullscreen works
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
			// Switch from fullscreen to presenter view: exit fullscreen first.
			// Arm the guard so the fullscreenchange listener doesn't exit
			// present mode when it sees fullscreen disappear.
			showGuard.expectAudienceBounce();
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
	}, [presenterMode, presentationStartTime, containerRef, showGuard]);

	// -----------------------------------------------------------------------
	// Keyboard navigation
	// -----------------------------------------------------------------------

	usePresentationKeyboard({
		mode,
		movePresentationSlide,
		navigateToSlide,
		slideCount: slides.length,
		showSlideIndexes: visibleSlideIndexes,
		onSetMode,
		onSetPointerTool,
		onEraseAnnotations,
		onToggleInkMarkup,
		onToggleToolbar,
		onShowAllSlides: openAllSlides,
		onToggleBlackScreen: () =>
			presenterConsole.setBlackout(
				presenterConsole.snapshot.blackout === 'black' ? 'none' : 'black',
			),
		onToggleWhiteScreen: () =>
			presenterConsole.setBlackout(
				presenterConsole.snapshot.blackout === 'white' ? 'none' : 'white',
			),
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
	const presentationSlideIndexRef = useRef(presentationSlideIndex);
	presentationSlideIndexRef.current = presentationSlideIndex;
	const clearPresentationTimersRef = useRef(clearPresentationTimers);
	clearPresentationTimersRef.current = clearPresentationTimers;

	// A hidden tab is a paused show: stage media and cross-slide persistent
	// audio stop, and the pending auto-advance timer is cancelled so the deck
	// does not run on unseen. When the tab is visible again the media resumes
	// and auto-advance re-arms for the slide the show is currently on.
	useEffect(() => {
		if (mode !== 'present') {
			return;
		}
		return attachPresentationVisibilityPause({
			root: containerRef.current ?? undefined,
			onHidden: () => clearPresentationTimersRef.current(),
			onVisible: () => scheduleAutoAdvanceRef.current(presentationSlideIndexRef.current),
		});
	}, [mode, containerRef]);

	// Layout effect on purpose: entering the show must seed the first slide's
	// animation states BEFORE the browser paints the presentation stage, or the
	// opening slide flashes every entrance-animated element at its final state
	// for a frame before snapping back to replay (issue #132).
	useLayoutEffect(() => {
		if (mode === 'present') {
			// Only runs when entering present mode (mode changes to "present").
			// Slide-to-slide navigation during presentation is handled entirely
			// by executeSlideTransition; re-running here on every activeSlideIndex
			// change would duplicate entrance animations and cause visible lag.
			const idx = activeSlideIndexRef.current;
			setPresentationSlideIndex(idx);
			runEntranceAnimationsRef.current(idx);
			scheduleAutoAdvanceRef.current(idx);
		} else {
			// Leaving present mode: drop any in-flight transition overlay.
			setTransitionOverlay(null);
		}
		// Entering or leaving, a stale end-of-show screen never carries over.
		setEndOfShowVisible(false);
		// NOTE: fullscreen exit is handled by the dedicated effect below -
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
			if (showGuard.classifyFullscreenExit() === 'restore-show') {
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
		showGuard,
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
	// Morph transition
	// -----------------------------------------------------------------------

	// PowerPoint's Morph is a FLIP animation: the ARRIVING slide's elements are
	// what move, starting from wherever their counterpart sat on the leaving
	// slide. So the per-element animations are merged into the live stage's
	// animation states here, and only the elements with no counterpart are left
	// for the overlay to fade out. See shared `buildMorphTransitionPlan`.
	const morphPlan = useMemo(() => {
		if (!transitionOverlay || transitionOverlay.transition.type !== 'morph') {
			return undefined;
		}
		return buildMorphTransitionPlan(
			slides[transitionOverlay.outgoingSlideIndex],
			slides[transitionOverlay.incomingSlideIndex],
			transitionOverlay.durationMs,
			morphOptionToMode(transitionOverlay.transition.morphOption),
		);
	}, [transitionOverlay, slides]);

	const morphedElementStates = useMemo(() => {
		if (!morphPlan || morphPlan.incomingAnimations.size === 0) {
			return presentationElementStates;
		}
		const merged = new Map(presentationElementStates);
		for (const [elementId, animation] of morphPlan.incomingAnimations) {
			const existing = merged.get(elementId);
			// An entrance animation on the arriving slide wins: PowerPoint plays
			// the build, not the morph, for a shape that is explicitly animated in.
			if (existing?.cssAnimation) {
				continue;
			}
			merged.set(elementId, { ...existing, visible: true, cssAnimation: animation });
		}
		return merged;
	}, [morphPlan, presentationElementStates]);

	// A picture's source crop rides the `<img>` INSIDE the element, so unlike
	// every other morph animation it cannot be merged into the element state
	// above: it needs a descendant rule. The stage injects this stylesheet, and
	// the ids are unique to the arriving slide, so no scope attribute is needed
	// (see `buildMorphAnimationRules`). Issue #148.
	const morphedKeyframesCss = useMemo(() => {
		if (!morphPlan) {
			return presentationKeyframesCss;
		}
		const imageRules = buildMorphAnimationRules(morphPlan, '', 'incoming', 'image');
		return `${presentationKeyframesCss ?? ''}\n${morphPlan.keyframesCss}\n${imageRules}`;
	}, [morphPlan, presentationKeyframesCss]);

	// -----------------------------------------------------------------------
	// Return
	// -----------------------------------------------------------------------

	return {
		presentationSlideIndex,
		setPresentationSlideIndex,
		presentationSlideVisible,
		transitionOverlay,
		handleTransitionOverlayComplete,
		morphPlan,
		presentationAnimations,
		presentationElementStates: morphedElementStates,
		presentationKeyframesCss: morphedKeyframesCss,
		clearPresentationTimers,
		runPresentationEntranceAnimations,
		endOfShowVisible,
		allSlidesOpen,
		openAllSlides,
		closeAllSlides,
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
		syncStateToAudience,
		swapPresenterDisplays: swapDisplays,
		presenterSnapshot: presenterConsole.snapshot,
		setPresenterBlackout: presenterConsole.setBlackout,
		togglePresenterTimer: presenterConsole.toggleTimer,
		resetPresenterTimer: presenterConsole.resetTimer,
		stepPresenterZoom: presenterConsole.stepZoom,
		resetPresenterZoom: presenterConsole.resetZoom,
		setPresenterCaption: presenterConsole.setCaption,
		setPresenterSubtitlesVisible: presenterConsole.setSubtitlesVisible,
		updatePresenterSnapshot: presenterConsole.updateSnapshot,
	};
}
