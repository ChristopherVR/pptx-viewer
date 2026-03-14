import { useEffect } from "react";

import type { ViewerMode } from "../../types";
import { mapKeyToPresentationAction } from "./keyboard-helpers";

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
      const mapped = mapKeyToPresentationAction(event.key, event.ctrlKey);
      if (mapped.action === "none") return;

      event.preventDefault();

      switch (mapped.action) {
        case "exit":
          if (rehearsing) {
            recordCurrentSlideTime(presentationSlideIndex);
            setShowRehearsalSummary(true);
          }
          onSetMode("edit");
          return;
        case "next":
          movePresentationSlide(1);
          return;
        case "prev":
          movePresentationSlide(-1);
          return;
        case "toggleLaser":
          onToggleLaser?.();
          return;
        case "togglePen":
          onTogglePen?.();
          return;
        case "toggleEraser":
          onToggleEraser?.();
          return;
        case "toggleToolbar":
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
