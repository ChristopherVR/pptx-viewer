import { useRef, useState, useCallback } from "react";

import type { ViewerMode } from "../../types";

// ---------------------------------------------------------------------------
// Sub-hook interface
// ---------------------------------------------------------------------------

export interface UseRehearsalTimingsInput {
  containerRef: React.RefObject<HTMLElement | null>;
  onSetMode: (mode: ViewerMode) => void;
  onSaveRehearsalTimings?: (timings: Record<number, number>) => void;
  setPresentationStartTime: (time: number | null) => void;
  setPresenterMode: (mode: boolean) => void;
}

export interface UseRehearsalTimingsResult {
  rehearsing: boolean;
  setRehearsing: React.Dispatch<React.SetStateAction<boolean>>;
  recordedTimings: Record<number, number>;
  slideStartTime: number | null;
  showRehearsalSummary: boolean;
  setShowRehearsalSummary: React.Dispatch<React.SetStateAction<boolean>>;
  rehearsalPaused: boolean;
  recordCurrentSlideTime: (slideIndex: number) => void;
  dismissRehearsalSummary: () => void;
  saveRehearsalTimings: () => void;
  enterRehearsalMode: () => void;
  toggleRehearsalPause: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRehearsalTimings(
  input: UseRehearsalTimingsInput,
): UseRehearsalTimingsResult {
  const {
    containerRef,
    onSetMode,
    onSaveRehearsalTimings,
    setPresentationStartTime,
    setPresenterMode,
  } = input;

  const [rehearsing, setRehearsing] = useState(false);
  const [recordedTimings, setRecordedTimings] = useState<
    Record<number, number>
  >({});
  const [slideStartTime, setSlideStartTime] = useState<number | null>(null);
  const [showRehearsalSummary, setShowRehearsalSummary] = useState(false);
  const [rehearsalPaused, setRehearsalPaused] = useState(false);
  const pauseAccumulatedRef = useRef(0);
  const pauseStartRef = useRef<number | null>(null);

  /** Record the time spent on the current slide and reset for the next one. */
  const recordCurrentSlideTime = useCallback(
    (slideIdx: number) => {
      if (slideStartTime === null) return;
      let pausedMs = pauseAccumulatedRef.current;
      if (pauseStartRef.current !== null) {
        pausedMs += Date.now() - pauseStartRef.current;
      }
      const elapsed = Date.now() - slideStartTime - pausedMs;
      setRecordedTimings((prev) => ({
        ...prev,
        [slideIdx]: Math.max(0, elapsed),
      }));
      // Reset per-slide timer
      pauseAccumulatedRef.current = 0;
      pauseStartRef.current = rehearsalPaused ? Date.now() : null;
      setSlideStartTime(Date.now());
    },
    [slideStartTime, rehearsalPaused],
  );

  const dismissRehearsalSummary = useCallback(() => {
    setShowRehearsalSummary(false);
    setRehearsing(false);
    setRecordedTimings({});
  }, []);

  const saveRehearsalTimings = useCallback(() => {
    onSaveRehearsalTimings?.(recordedTimings);
    setShowRehearsalSummary(false);
    setRehearsing(false);
  }, [onSaveRehearsalTimings, recordedTimings]);

  const enterRehearsalMode = useCallback(() => {
    setPresenterMode(false);
    setRehearsing(true);
    setRecordedTimings({});
    setRehearsalPaused(false);
    setShowRehearsalSummary(false);
    pauseAccumulatedRef.current = 0;
    pauseStartRef.current = null;
    const now = Date.now();
    setPresentationStartTime(now);
    setSlideStartTime(now);
    // Request fullscreen
    try {
      const wrapper = containerRef.current;
      if (wrapper && typeof wrapper.requestFullscreen === "function") {
        void wrapper.requestFullscreen().catch(() => {
          /* ignore */
        });
      }
    } catch {
      /* fullscreen not supported */
    }
    onSetMode("present");
  }, [containerRef, onSetMode, setPresentationStartTime, setPresenterMode]);

  const toggleRehearsalPause = useCallback(() => {
    setRehearsalPaused((prev) => {
      if (prev) {
        // Resuming — accumulate paused time
        if (pauseStartRef.current !== null) {
          pauseAccumulatedRef.current += Date.now() - pauseStartRef.current;
          pauseStartRef.current = null;
        }
      } else {
        // Pausing
        pauseStartRef.current = Date.now();
      }
      return !prev;
    });
  }, []);

  return {
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
  };
}
