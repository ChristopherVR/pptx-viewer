import { useState, useCallback, useEffect } from "react";

import type {
  UsePresentationModeInput,
  UsePresentationModeResult,
} from "./presentation-mode/types";
import { useAnimationPlayback } from "./presentation-mode/useAnimationPlayback";
import { useRehearsalTimings } from "./presentation-mode/useRehearsalTimings";
import { usePresentationKeyboard } from "./presentation-mode/usePresentationKeyboard";
import { useSlideNavigation } from "./presentation-mode/useSlideNavigation";
import { useZoomNavigation } from "./presentation-mode/useZoomNavigation";
import { usePresenterWindow } from "./presentation-mode/usePresenterWindow";

export type { UsePresentationModeInput, UsePresentationModeResult };

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePresentationMode(
  input: UsePresentationModeInput,
): UsePresentationModeResult {
  const {
    mode,
    slides,
    visibleSlideIndexes,
    activeSlideIndex,
    containerRef,
    onSetMode,
    onSetActiveSlideIndex,
    onPlayActionSound,
    onToggleLaser,
    onTogglePen,
    onToggleEraser,
    onToggleToolbar,
    onSaveRehearsalTimings,
    loopContinuously,
  } = input;

  // -----------------------------------------------------------------------
  // Shared state
  // -----------------------------------------------------------------------

  const [presentationSlideIndex, setPresentationSlideIndex] = useState(0);
  const [presentationSlideVisible, setPresentationSlideVisible] =
    useState(true);
  const [presenterMode, setPresenterMode] = useState(false);
  const [presentationStartTime, setPresentationStartTime] = useState<
    number | null
  >(null);

  // -----------------------------------------------------------------------
  // Sub-hooks
  // -----------------------------------------------------------------------

  const {
    presentationAnimations,
    presentationElementStates,
    presentationKeyframesCss,
    interactiveTriggerShapeIds,
    clearPresentationTimers,
    playNextAnimationGroup,
    handleInteractiveShapeClick,
    runPresentationEntranceAnimations,
    presentationTimersRef,
  } = useAnimationPlayback({ slides, onPlayActionSound });

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
    playNextAnimationGroup,
    clearPresentationTimers,
    runPresentationEntranceAnimations,
    presentationTimersRef,
    rehearsing,
    recordCurrentSlideTime,
    setShowRehearsalSummary,
  });

  const {
    handleZoomClick,
    zoomReturnSlideIndex,
    returnToZoomSlide,
    clearZoomReturn,
  } = useZoomNavigation({ navigateToSlide });

  const {
    openAudienceWindow,
    closeAudienceWindow,
    isAudienceWindowOpen,
    syncSlideToAudience,
  } = usePresenterWindow({
    currentSlideIndex: presentationSlideIndex,
    isPresenterMode: presenterMode,
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
      if (wrapper && typeof wrapper.requestFullscreen === "function") {
        void wrapper.requestFullscreen().catch(() => {
          /* ignore fullscreen errors */
        });
      }
    } catch {
      /* fullscreen not supported */
    }
    onSetMode("present");
  }, [containerRef, onSetMode, setRehearsing]);

  const enterPresenterView = useCallback(() => {
    setPresenterMode(true);
    setRehearsing(false);
    setPresentationStartTime(Date.now());
    onSetMode("present");
  }, [onSetMode, setRehearsing]);

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
    rehearsing,
    recordCurrentSlideTime,
    presentationSlideIndex,
    setShowRehearsalSummary,
  });

  // -----------------------------------------------------------------------
  // Present-mode initialisation effect (animations, auto-advance)
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (mode === "present") {
      setPresentationSlideIndex(activeSlideIndex);
      runPresentationEntranceAnimations(activeSlideIndex);
      scheduleAutoAdvanceForSlide(activeSlideIndex);
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
  }, [
    activeSlideIndex,
    mode,
    runPresentationEntranceAnimations,
    scheduleAutoAdvanceForSlide,
  ]);

  // Sync mode when user exits fullscreen via browser chrome / Escape
  useEffect(() => {
    if (mode !== "present") return;
    // In presenter view mode, we don't use fullscreen, so skip this listener
    if (presenterMode) return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        if (rehearsing) {
          recordCurrentSlideTime(presentationSlideIndex);
          setShowRehearsalSummary(true);
        }
        onSetMode("edit");
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
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
    enterPresentMode,
    presenterMode,
    enterPresenterView,
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
