/**
 * useAnnotationHandlers — Mode-switching callbacks that interact with
 * presentation annotations.  Extracted to keep the orchestrator lean.
 */
import { useCallback, useRef, useState } from "react";

import type { InkPptxElement, PptxSlide } from "pptx-viewer-core";
import type { ViewerMode } from "../types-core";
import type { UsePresentationModeResult } from "./usePresentationMode";
import type {
  AnnotationStroke,
  SlideAnnotationMap,
  UsePresentationAnnotationsResult,
} from "./usePresentationAnnotations";
import type { EditorHistoryResult } from "./useEditorHistory";
import { stopAllPersistentAudio } from "../utils/media";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UseAnnotationHandlersInput {
  mode: ViewerMode;
  presentation: UsePresentationModeResult;
  annotations: UsePresentationAnnotationsResult;
  history: EditorHistoryResult;
  setMode: React.Dispatch<React.SetStateAction<ViewerMode>>;
  setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface AnnotationHandlersResult {
  showKeepAnnotationsDialog: boolean;
  handleSetMode: (nextMode: ViewerMode) => void;
  handleKeepAnnotations: () => void;
  handleDiscardAnnotations: () => void;
  handleEnterPresenterView: () => void;
  handleEnterRehearsalMode: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAnnotationHandlers(
  input: UseAnnotationHandlersInput,
): AnnotationHandlersResult {
  const { mode, presentation, annotations, history, setMode, setSlides } =
    input;

  const [showKeepAnnotationsDialog, setShowKeepAnnotationsDialog] =
    useState(false);
  const pendingModeAfterAnnotationsRef = useRef<ViewerMode>("edit");

  // ── handleSetMode ─────────────────────────────────────────────
  const handleSetMode = useCallback(
    (nextMode: ViewerMode) => {
      if (nextMode === "present") {
        presentation.enterPresentMode();
      } else if (mode === "present" && annotations.hasAnyAnnotations) {
        stopAllPersistentAudio();
        pendingModeAfterAnnotationsRef.current = nextMode;
        setShowKeepAnnotationsDialog(true);
      } else {
        if (mode === "present") {
          stopAllPersistentAudio();
        }
        setMode(nextMode);
      }
    },
    [presentation, mode, annotations.hasAnyAnnotations, setMode],
  );

  // ── Keep annotations as ink elements ──────────────────────────
  const handleKeepAnnotations = useCallback(() => {
    const annotationMap: SlideAnnotationMap = annotations.allSlideAnnotations;
    if (annotationMap.size === 0) {
      setShowKeepAnnotationsDialog(false);
      setMode(pendingModeAfterAnnotationsRef.current);
      annotations.clearAllAnnotations();
      return;
    }

    setSlides((prev) =>
      prev.map((slide, slideIndex) => {
        const strokes = annotationMap.get(slideIndex);
        if (!strokes || strokes.length === 0) return slide;

        const inkElements: InkPptxElement[] = strokes.map(
          (stroke: AnnotationStroke) => {
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;
            for (const pt of stroke.points) {
              if (pt.x < minX) minX = pt.x;
              if (pt.y < minY) minY = pt.y;
              if (pt.x > maxX) maxX = pt.x;
              if (pt.y > maxY) maxY = pt.y;
            }
            const bboxWidth = Math.max(maxX - minX, 1);
            const bboxHeight = Math.max(maxY - minY, 1);
            const pathParts: string[] = [];
            for (let i = 0; i < stroke.points.length; i++) {
              const pt = stroke.points[i];
              const rx = pt.x - minX;
              const ry = pt.y - minY;
              pathParts.push(i === 0 ? `M ${rx} ${ry}` : `L ${rx} ${ry}`);
            }
            const inkTool: "pen" | "highlighter" =
              stroke.opacity < 1 ? "highlighter" : "pen";
            return {
              id: `ink-annotation-${stroke.id}`,
              type: "ink" as const,
              x: minX,
              y: minY,
              width: bboxWidth,
              height: bboxHeight,
              inkPaths: [pathParts.join(" ")],
              inkColors: [stroke.color],
              inkWidths: [stroke.width],
              inkOpacities: [stroke.opacity],
              inkTool,
            };
          },
        );

        return {
          ...slide,
          elements: [...slide.elements, ...inkElements],
        };
      }),
    );

    history.markDirty();
    annotations.clearAllAnnotations();
    setShowKeepAnnotationsDialog(false);
    setMode(pendingModeAfterAnnotationsRef.current);
  }, [annotations, setMode, setSlides, history]);

  // ── Discard annotations ───────────────────────────────────────
  const handleDiscardAnnotations = useCallback(() => {
    annotations.clearAllAnnotations();
    setShowKeepAnnotationsDialog(false);
    setMode(pendingModeAfterAnnotationsRef.current);
  }, [annotations, setMode]);

  // ── Presenter view / rehearsal shortcuts ──────────────────────
  const handleEnterPresenterView = useCallback(() => {
    presentation.enterPresenterView();
  }, [presentation]);

  const handleEnterRehearsalMode = useCallback(() => {
    presentation.enterRehearsalMode();
  }, [presentation]);

  return {
    showKeepAnnotationsDialog,
    handleSetMode,
    handleKeepAnnotations,
    handleDiscardAnnotations,
    handleEnterPresenterView,
    handleEnterRehearsalMode,
  };
}
