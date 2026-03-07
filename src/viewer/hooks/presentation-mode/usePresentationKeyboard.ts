import { useEffect } from "react";

import type { ViewerMode } from "../../types";

// ---------------------------------------------------------------------------
// Sub-hook interface
// ---------------------------------------------------------------------------

export interface UsePresentationKeyboardInput {
  mode: ViewerMode;
  movePresentationSlide: (direction: 1 | -1) => void;
  onSetMode: (mode: ViewerMode) => void;
  onToggleLaser?: () => void;
  onTogglePen?: () => void;
  onToggleEraser?: () => void;
  onToggleToolbar?: () => void;
  rehearsing: boolean;
  recordCurrentSlideTime: (slideIndex: number) => void;
  presentationSlideIndex: number;
  setShowRehearsalSummary: (value: boolean) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Registers keyboard shortcuts for presentation mode: arrow/space
 * for slide navigation, Escape to exit, and annotation tool toggles.
 */
export function usePresentationKeyboard(
  input: UsePresentationKeyboardInput,
): void {
  const {
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
  } = input;

  useEffect(() => {
    if (mode !== "present") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (rehearsing) {
          recordCurrentSlideTime(presentationSlideIndex);
          setShowRehearsalSummary(true);
        }
        onSetMode("edit");
        return;
      }
      if (
        event.key === "ArrowRight" ||
        event.key === "PageDown" ||
        event.key === " "
      ) {
        event.preventDefault();
        movePresentationSlide(1);
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        movePresentationSlide(-1);
        return;
      }
      // Annotation tool shortcuts
      if (event.key === "l" || event.key === "L") {
        event.preventDefault();
        onToggleLaser?.();
        return;
      }
      if (event.key === "p" || event.key === "P") {
        event.preventDefault();
        onTogglePen?.();
        return;
      }
      if (event.key === "e" || event.key === "E") {
        event.preventDefault();
        onToggleEraser?.();
        return;
      }
      if (event.key === "m" && event.ctrlKey) {
        event.preventDefault();
        onToggleToolbar?.();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
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
  ]);
}
