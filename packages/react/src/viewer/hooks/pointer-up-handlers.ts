/**
 * Extracted pointer-up (commit) logic for usePointerHandlers.
 * Commits marquee selections, drag moves, resizes, and resets state.
 */
import type { PptxElement } from "pptx-viewer-core";
import { MIN_ELEMENT_SIZE } from "../constants";
import {
  rerouteConnectorsForMovedElements,
  applyReroutedConnectors,
} from "../utils/connector-reroute";
import type { UsePointerHandlersInput } from "./pointer-handler-types";

// ---------------------------------------------------------------------------
// Pure helper functions (exported for testing)
// ---------------------------------------------------------------------------

export interface MarqueeRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface ElementRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute which element IDs are hit by a marquee selection rectangle.
 * Returns empty array if the marquee is too small (< 3px in both dimensions).
 */
export function computeMarqueeHitIds(
  marquee: MarqueeRect,
  elements: ElementRect[],
): string[] {
  const minX = Math.min(marquee.startX, marquee.currentX);
  const minY = Math.min(marquee.startY, marquee.currentY);
  const maxX = Math.max(marquee.startX, marquee.currentX);
  const maxY = Math.max(marquee.startY, marquee.currentY);
  const w = maxX - minX,
    h = maxY - minY;
  if (w <= 3 && h <= 3) return [];
  return elements
    .filter((el) => {
      const eMinX = el.x,
        eMinY = el.y;
      const eMaxX = el.x + Math.max(el.width, MIN_ELEMENT_SIZE);
      const eMaxY = el.y + Math.max(el.height, MIN_ELEMENT_SIZE);
      return !(eMaxX < minX || eMinX > maxX || eMaxY < minY || eMinY > maxY);
    })
    .map((el) => el.id);
}

/**
 * Merge additive (shift-click) marquee selections with newly hit IDs.
 */
export function mergeAdditiveSelection(
  baseSelectionIds: string[] | undefined,
  hitIds: string[],
): string[] {
  return Array.from(new Set([...(baseSelectionIds ?? []), ...hitIds]));
}

// ---------------------------------------------------------------------------
// Main pointer-up processor
// ---------------------------------------------------------------------------

export function processPointerUp(input: UsePointerHandlersInput): void {
  const {
    editTemplateMode,
    templateElements,
    activeSlide,
    activeSlideIndex,
    marqueeStateRef,
    dragStateRef,
    resizeStateRef,
    shapeAdjustmentDragStateRef,
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

  const marquee = marqueeStateRef.current;
  const drag = dragStateRef.current;
  const rs = resizeStateRef.current;
  const adj = shapeAdjustmentDragStateRef.current;

  if (marquee) {
    commitMarquee(
      marquee,
      editTemplateMode,
      templateElements,
      activeSlide,
      applySelection,
      clearSelection,
    );
    marqueeStateRef.current = null;
    setMarqueeSelectionState(null);
  }

  if (drag?.moved) {
    commitDrag(
      drag,
      editTemplateMode,
      activeSlide,
      activeSlideIndex,
      setTemplateElementsBySlideId,
      updateSlides,
    );
  }

  if (rs?.moved) {
    // Apply the resize and reroute any connectors attached to the resized element
    const resizedId = rs.elementId;
    const resizeUpdates = {
      x: rs.lastX,
      y: rs.lastY,
      width: rs.lastWidth,
      height: rs.lastHeight,
    };
    updateElementById(resizedId, resizeUpdates);
    // Reroute connectors referencing the resized element
    const movedIds = new Set([resizedId]);
    updateSlides((prev) =>
      prev.map((s, i) => {
        if (i !== activeSlideIndex) return s;
        const rerouted = rerouteConnectorsForMovedElements(s.elements, movedIds);
        if (rerouted.length === 0) return s;
        return {
          ...s,
          elements: applyReroutedConnectors(s.elements, rerouted),
        };
      }),
    );
  }

  const wasMoved = drag?.moved || rs?.moved || adj?.moved;

  marqueeStateRef.current = null;
  dragStateRef.current = null;
  resizeStateRef.current = null;
  shapeAdjustmentDragStateRef.current = null;
  setMarqueeSelectionState(null);
  setSnapLines([]);

  if (wasMoved) {
    markDirty();
    setPointerCommitNonce((n) => n + 1);
  }
}

// ── Marquee commit ───────────────────────────────────────────────────────────

function commitMarquee(
  marquee: NonNullable<UsePointerHandlersInput["marqueeStateRef"]["current"]>,
  editTemplateMode: boolean,
  templateElements: PptxElement[],
  activeSlide: UsePointerHandlersInput["activeSlide"],
  applySelection: UsePointerHandlersInput["applySelection"],
  clearSelection: UsePointerHandlersInput["clearSelection"],
): void {
  const sourceElements = editTemplateMode
    ? templateElements
    : (activeSlide?.elements ?? []);
  const hitIds = computeMarqueeHitIds(marquee, sourceElements);
  if (marquee.additive) {
    const merged = mergeAdditiveSelection(marquee.baseSelectionIds, hitIds);
    if (merged.length > 0) applySelection(merged[0], merged);
    else clearSelection();
  } else if (hitIds.length > 0) {
    applySelection(hitIds[0], hitIds);
  } else {
    clearSelection();
  }
}

// ── Drag commit ──────────────────────────────────────────────────────────────

function commitDrag(
  drag: NonNullable<UsePointerHandlersInput["dragStateRef"]["current"]>,
  editTemplateMode: boolean,
  activeSlide: UsePointerHandlersInput["activeSlide"],
  activeSlideIndex: number,
  setTemplateElementsBySlideId: UsePointerHandlersInput["setTemplateElementsBySlideId"],
  updateSlides: UsePointerHandlersInput["updateSlides"],
): void {
  const dx = drag.lastDx,
    dy = drag.lastDy;
  if (editTemplateMode) {
    const movedIds = new Set(Object.keys(drag.startPositionsById));
    setTemplateElementsBySlideId((prev: Record<string, PptxElement[]>) => {
      const slideId = activeSlide?.id;
      if (!slideId) return prev;
      const els = prev[slideId] ?? [];
      const movedElements = els.map((el) => {
        const start = drag.startPositionsById[el.id];
        if (!start) return el;
        return { ...el, x: start.x + dx, y: start.y + dy };
      });
      const rerouted = rerouteConnectorsForMovedElements(movedElements, movedIds);
      return {
        ...prev,
        [slideId]: applyReroutedConnectors(movedElements, rerouted),
      };
    });
  } else {
    const movedIds = new Set(Object.keys(drag.startPositionsById));
    updateSlides((prev) =>
      prev.map((s, i) => {
        if (i !== activeSlideIndex) return s;
        // First apply the drag positions
        const movedElements = s.elements.map((el) => {
          const start = drag.startPositionsById[el.id];
          if (!start) return el;
          return { ...el, x: start.x + dx, y: start.y + dy };
        });
        // Then reroute any connectors attached to the moved shapes
        const rerouted = rerouteConnectorsForMovedElements(movedElements, movedIds);
        return {
          ...s,
          elements: applyReroutedConnectors(movedElements, rerouted),
        };
      }),
    );
  }
}
