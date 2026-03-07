/**
 * usePointerHandlers — Global pointer move/up handlers for drag, resize,
 * marquee selection, and shape-adjustment interactions.
 *
 * Heavy logic is extracted into:
 *   - pointer-move-handlers.ts  (processPointerMove)
 *   - pointer-up-handlers.ts    (processPointerUp)
 *   - pointer-handler-types.ts  (shared types)
 */
import { useEffect } from "react";

import type { PointerFrameTracker } from "./pointer-handler-types";
import { processPointerMove } from "./pointer-move-handlers";
import { processPointerUp } from "./pointer-up-handlers";

export type { UsePointerHandlersInput } from "./pointer-handler-types";

import type { UsePointerHandlersInput } from "./pointer-handler-types";

export function usePointerHandlers(input: UsePointerHandlersInput): void {
  const {
    editorScale,
    canvasStageRef,
    canvasSize,
    activeSlide,
    activeSlideIndex,
    gridSpacingPx,
    dragStateRef,
    resizeStateRef,
    shapeAdjustmentDragStateRef,
    marqueeStateRef,
    editTemplateMode,
    snapToGrid,
    snapToShape,
    guides,
    templateElements,
    elementLookup,
    setMarqueeSelectionState,
    setSnapLines,
    setTemplateElementsBySlideId,
    setPointerCommitNonce,
    applySelection,
    clearSelection,
    updateSlides,
    updateElementById,
    markDirty,
  } = input;

  useEffect(() => {
    const tracker: PointerFrameTracker = {
      rafId: 0,
      pendingMoveEvent: null,
      lastSnapLinesKey: "",
    };

    const handlePointerMove = (e: PointerEvent) => {
      tracker.pendingMoveEvent = e;
      if (tracker.rafId === 0) {
        tracker.rafId = requestAnimationFrame(() => {
          tracker.rafId = 0;
          if (tracker.pendingMoveEvent) {
            processPointerMove(tracker.pendingMoveEvent, input, tracker);
            tracker.pendingMoveEvent = null;
          }
        });
      }
    };

    const handlePointerUp = () => {
      if (tracker.rafId !== 0) {
        cancelAnimationFrame(tracker.rafId);
        tracker.rafId = 0;
        tracker.pendingMoveEvent = null;
      }
      processPointerUp(input);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      if (tracker.rafId !== 0) cancelAnimationFrame(tracker.rafId);
    };
  }, [
    editorScale,
    canvasStageRef,
    dragStateRef,
    resizeStateRef,
    shapeAdjustmentDragStateRef,
    marqueeStateRef,
    editTemplateMode,
    snapToGrid,
    snapToShape,
    guides,
    templateElements,
    setMarqueeSelectionState,
    setSnapLines,
    elementLookup,
    setTemplateElementsBySlideId,
    setPointerCommitNonce,
    activeSlide,
    activeSlideIndex,
    canvasSize.width,
    canvasSize.height,
    gridSpacingPx,
    applySelection,
    clearSelection,
    updateSlides,
    updateElementById,
    markDirty,
    input,
  ]);
}
