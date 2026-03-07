/**
 * useCanvasEventHandlers — Event delegation, guide-drag state, find-result
 * highlights, and selected-element bounds for the slide canvas.
 */
import React, { useCallback, useMemo, useState } from "react";
import type { PptxElement } from "../../../core";
import type { ElementFindHighlights } from "../../utils/text-render";
import { getElementIdFromEvent, type ZoomViewport } from "./canvas-types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FindResult {
  slideIndex: number;
  elementId: string;
  segmentIndex: number;
  startOffset: number;
  length: number;
}

export interface DraggingGuide {
  id: string;
  axis: "h" | "v";
  pointerId: number;
}

export interface CanvasEventHandlers {
  /* find highlights */
  elementFindHighlightsMap: Map<string, ElementFindHighlights>;
  /* selected bounds for ruler highlight */
  selectedBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  /* event delegation on the stage */
  handleStageClick: (e: React.MouseEvent) => void;
  handleStageDblClick: (e: React.MouseEvent) => void;
  handleStageMouseDown: (e: React.MouseEvent) => void;
  handleStageContextMenu: (e: React.MouseEvent) => void;
  /* guide dragging */
  draggingGuide: DraggingGuide | null;
  setDraggingGuide: React.Dispatch<React.SetStateAction<DraggingGuide | null>>;
  handleStagePointerMove: (e: React.PointerEvent) => void;
  handleStagePointerUp: (e: React.PointerEvent) => void;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useCanvasEventHandlers({
  cbRef,
  onCanvasMouseDown,
  findResults,
  findResultIndex,
  activeSlideIndex,
  selectedElement,
  zoom,
  onMoveGuide,
}: {
  cbRef: {
    readonly current: {
      onClick: (elementId: string, e: React.MouseEvent) => void;
      onDoubleClick: (elementId: string, e: React.MouseEvent) => void;
      onMouseDown: (elementId: string, e: React.MouseEvent) => void;
      onContextMenu: (elementId: string, e: React.MouseEvent) => void;
    };
  };
  onCanvasMouseDown?: (e: React.MouseEvent) => void;
  findResults?: FindResult[];
  findResultIndex?: number;
  activeSlideIndex?: number;
  selectedElement: PptxElement | null;
  zoom: ZoomViewport;
  onMoveGuide?: (guideId: string, position: number) => void;
}): CanvasEventHandlers {
  /* ── Per-element find highlights (memoised) ───────────────────── */
  const elementFindHighlightsMap = useMemo(() => {
    const map = new Map<string, ElementFindHighlights>();
    if (!findResults || findResults.length === 0 || activeSlideIndex == null)
      return map;
    for (let i = 0; i < findResults.length; i++) {
      const r = findResults[i];
      if (r.slideIndex !== activeSlideIndex) continue;
      if (!map.has(r.elementId)) map.set(r.elementId, new Map());
      const elMap = map.get(r.elementId)!;
      if (!elMap.has(r.segmentIndex)) elMap.set(r.segmentIndex, []);
      elMap.get(r.segmentIndex)!.push({
        startOffset: r.startOffset,
        length: r.length,
        isCurrent: i === (findResultIndex ?? -1),
      });
    }
    return map;
  }, [findResults, findResultIndex, activeSlideIndex]);

  /* ── Selected element bounds for ruler ────────────────────────── */
  const selectedBounds = useMemo(() => {
    if (!selectedElement) return null;
    return {
      x: selectedElement.x,
      y: selectedElement.y,
      width: selectedElement.width,
      height: selectedElement.height,
    };
  }, [selectedElement]);

  /* ── Event delegation handlers (stable) ──────────────────────── */
  const handleStageClick = useCallback(
    (e: React.MouseEvent) => {
      const id = getElementIdFromEvent(e);
      if (id) cbRef.current.onClick(id, e);
    },
    [cbRef],
  );

  const handleStageDblClick = useCallback(
    (e: React.MouseEvent) => {
      const id = getElementIdFromEvent(e);
      if (id) cbRef.current.onDoubleClick(id, e);
    },
    [cbRef],
  );

  const handleStageMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const id = getElementIdFromEvent(e);
      if (id) {
        cbRef.current.onMouseDown(id, e);
        return;
      }
      onCanvasMouseDown?.(e);
    },
    [cbRef, onCanvasMouseDown],
  );

  const handleStageContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const id = getElementIdFromEvent(e);
      if (id) cbRef.current.onContextMenu(id, e);
    },
    [cbRef],
  );

  /* ── Guide drag state & handlers ─────────────────────────────── */
  const [draggingGuide, setDraggingGuide] = useState<DraggingGuide | null>(
    null,
  );

  const handleStagePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingGuide || !onMoveGuide) return;
      const stage = zoom.canvasStageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const scale = zoom.editorScale || 1;
      const rawPosition =
        draggingGuide.axis === "h"
          ? (e.clientY - rect.top) / scale
          : (e.clientX - rect.left) / scale;
      onMoveGuide(draggingGuide.id, rawPosition);
    },
    [draggingGuide, onMoveGuide, zoom.canvasStageRef, zoom.editorScale],
  );

  const handleStagePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingGuide) return;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(
          draggingGuide.pointerId,
        );
      } catch {
        // No-op: capture might already be released.
      }
      setDraggingGuide(null);
    },
    [draggingGuide],
  );

  return {
    elementFindHighlightsMap,
    selectedBounds,
    handleStageClick,
    handleStageDblClick,
    handleStageMouseDown,
    handleStageContextMenu,
    draggingGuide,
    setDraggingGuide,
    handleStagePointerMove,
    handleStagePointerUp,
  };
}
