/**
 * usePresentationSetup — Wires up `usePresentationAnnotations` and
 * `usePresentationMode` together with the annotation-aware mode-switching
 * logic.  Returns both hook results plus the shared `actionSoundHandlerRef`.
 */
import { useRef, useState } from "react";

import type { PptxHandler, PptxSlide } from "../../core";
import type { ViewerMode } from "../types-core";
import { stopAnimationSound } from "../utils/animation-sound";
import { stopAllPersistentAudio } from "../utils/media";
import {
  usePresentationAnnotations,
  type UsePresentationAnnotationsResult,
} from "./usePresentationAnnotations";
import {
  usePresentationMode,
  type UsePresentationModeResult,
} from "./usePresentationMode";
import type { EditorHistoryResult } from "./useEditorHistory";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UsePresentationSetupInput {
  mode: ViewerMode;
  slides: PptxSlide[];
  visibleSlideIndexes: number[];
  activeSlideIndex: number;
  containerRef: React.RefObject<HTMLElement | null>;
  mediaDataUrls: Map<string, string>;
  presentationProperties: {
    loopContinuously?: boolean;
    showType?: string;
  };
  setMode: React.Dispatch<React.SetStateAction<ViewerMode>>;
  setActiveSlideIndex: React.Dispatch<React.SetStateAction<number>>;
  setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
  history: EditorHistoryResult;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface PresentationSetupResult {
  presentation: UsePresentationModeResult;
  annotations: UsePresentationAnnotationsResult;
  actionSoundHandlerRef: React.MutableRefObject<PptxHandler | null>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePresentationSetup(
  input: UsePresentationSetupInput,
): PresentationSetupResult {
  const {
    mode,
    slides,
    visibleSlideIndexes,
    activeSlideIndex,
    containerRef,
    mediaDataUrls,
    presentationProperties,
    setMode,
    setActiveSlideIndex,
    setSlides,
    history,
  } = input;

  const actionSoundHandlerRef = useRef<PptxHandler | null>(null);

  // Annotations dialog state (shared between annotations & presentation)
  const [, setShowKeepAnnotationsDialog] = useState(false);
  const pendingModeRef = useRef<ViewerMode>("edit");

  const annotations = usePresentationAnnotations({
    isActive: mode === "present",
    activeSlideIndex,
  });

  const presentation = usePresentationMode({
    mode,
    slides,
    visibleSlideIndexes,
    activeSlideIndex,
    containerRef,
    onSetMode: (nextMode: ViewerMode) => {
      if (
        mode === "present" &&
        nextMode !== "present" &&
        annotations.hasAnyAnnotations
      ) {
        pendingModeRef.current = nextMode;
        setShowKeepAnnotationsDialog(true);
      } else {
        if (mode === "present" && nextMode !== "present") {
          stopAllPersistentAudio();
          stopAnimationSound();
        }
        setMode(nextMode);
      }
    },
    onSetActiveSlideIndex: setActiveSlideIndex,
    onPlayActionSound: (soundPath: string) => {
      void (async () => {
        if (!soundPath) return;
        const cachedSound = mediaDataUrls.get(soundPath);
        if (cachedSound) {
          try {
            const audio = new Audio(cachedSound);
            void audio.play().catch(() => {
              /* ignore */
            });
          } catch {
            /* ignore */
          }
          return;
        }
        const sharedHandler = actionSoundHandlerRef.current;
        if (!sharedHandler) return;
        try {
          const dataUrl = await sharedHandler.getImageData(soundPath);
          if (!dataUrl) return;
          mediaDataUrls.set(soundPath, dataUrl);
          const audio = new Audio(dataUrl);
          void audio.play().catch(() => {
            /* ignore */
          });
        } catch {
          /* ignore */
        }
      })();
    },
    onToggleLaser: () => annotations.setPresentationTool("laser"),
    onTogglePen: () => annotations.setPresentationTool("pen"),
    onToggleEraser: () => annotations.setPresentationTool("eraser"),
    onToggleToolbar: () =>
      annotations.setToolbarVisible(!annotations.toolbarVisible),
    onSaveRehearsalTimings: (timings: Record<number, number>) => {
      setSlides((prev) =>
        prev.map((slide, idx) => {
          const ms = timings[idx];
          if (typeof ms !== "number") return slide;
          return {
            ...slide,
            transition: {
              ...slide.transition,
              type: slide.transition?.type ?? "none",
              advanceAfterMs: ms,
            },
          };
        }),
      );
      history.markDirty();
    },
    loopContinuously:
      Boolean(presentationProperties.loopContinuously) ||
      presentationProperties.showType === "kiosk",
  });

  return { presentation, annotations, actionSoundHandlerRef };
}
