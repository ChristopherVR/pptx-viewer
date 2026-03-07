import { useCallback, useMemo, useState } from "react";
import React from "react";
import type {
  InkPptxElement,
  PptxSlide,
  ShapePptxElement,
  CustomGeometrySegment,
} from "pptx-viewer-core";
import type { DrawingTool } from "../../types-ui";
import type { ZoomViewport } from "./canvas-types";

/* ------------------------------------------------------------------ */
/*  Return type                                                        */
/* ------------------------------------------------------------------ */

export interface DrawingOverlayState {
  isDrawing: boolean;
  isStrokeActive: boolean;
  liveStrokeD: string;
  currentStrokePoints: Array<{ x: number; y: number }>;
  handleDrawPointerDown: (e: React.PointerEvent) => void;
  handleDrawPointerMove: (e: React.PointerEvent) => void;
  handleDrawPointerUp: (e: React.PointerEvent) => void;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useDrawingOverlay({
  activeTool,
  activeSlide,
  zoom,
  drawingColor,
  drawingWidth,
  isDrawingRef,
  onAddInkElement,
  onAddFreeformShape,
}: {
  activeTool: DrawingTool;
  activeSlide: PptxSlide | undefined;
  zoom: ZoomViewport;
  drawingColor: string;
  drawingWidth: number;
  isDrawingRef?: React.RefObject<boolean>;
  onAddInkElement?: (ink: InkPptxElement) => void;
  onAddFreeformShape?: (shape: ShapePptxElement) => void;
}): DrawingOverlayState {
  const isDrawing = activeTool !== "select";
  const [currentStrokePoints, setCurrentStrokePoints] = useState<
    Array<{ x: number; y: number }>
  >([]);
  const [isStrokeActive, setIsStrokeActive] = useState(false);

  /** Convert pointer position to canvas-local coordinates. */
  const pointerToCanvasCoords = useCallback(
    (e: React.PointerEvent): { x: number; y: number } | null => {
      const stage = zoom.canvasStageRef.current;
      if (!stage) return null;
      const rect = stage.getBoundingClientRect();
      const scale = zoom.editorScale || 1;
      return {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
      };
    },
    [zoom.canvasStageRef, zoom.editorScale],
  );

  /** Build an SVG path `d` string from an array of {x,y} points. */
  const buildPathD = useCallback(
    (pts: Array<{ x: number; y: number }>): string => {
      if (pts.length === 0) return "";
      const parts = [`M ${pts[0].x} ${pts[0].y}`];
      for (let i = 1; i < pts.length; i++) {
        parts.push(`L ${pts[i].x} ${pts[i].y}`);
      }
      return parts.join(" ");
    },
    [],
  );

  const handleDrawPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (activeTool === "select") return;
      // Eraser: find and remove ink elements near click point
      if (activeTool === "eraser" && activeSlide) {
        const pt = pointerToCanvasCoords(e);
        if (!pt) return;
        const HIT_RADIUS = 15;
        for (const el of [...activeSlide.elements].reverse()) {
          if (el.type !== "ink") continue;
          if (
            pt.x >= el.x - HIT_RADIUS &&
            pt.x <= el.x + el.width + HIT_RADIUS &&
            pt.y >= el.y - HIT_RADIUS &&
            pt.y <= el.y + el.height + HIT_RADIUS
          ) {
            break;
          }
        }
        return;
      }
      // Pen / Highlighter: start stroke
      const pt = pointerToCanvasCoords(e);
      if (!pt) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setCurrentStrokePoints([pt]);
      setIsStrokeActive(true);
      if (isDrawingRef) {
        (isDrawingRef as React.MutableRefObject<boolean>).current = true;
      }
    },
    [activeTool, activeSlide, pointerToCanvasCoords, isDrawingRef],
  );

  const handleDrawPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isStrokeActive || activeTool === "select" || activeTool === "eraser")
        return;
      const pt = pointerToCanvasCoords(e);
      if (!pt) return;
      setCurrentStrokePoints((prev) => [...prev, pt]);
    },
    [isStrokeActive, activeTool, pointerToCanvasCoords],
  );

  const handleDrawPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isStrokeActive || activeTool === "select" || activeTool === "eraser")
        return;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setIsStrokeActive(false);
      if (isDrawingRef) {
        (isDrawingRef as React.MutableRefObject<boolean>).current = false;
      }
      if (currentStrokePoints.length < 2) {
        setCurrentStrokePoints([]);
        return;
      }
      // Compute bounding box
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const pt of currentStrokePoints) {
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      }
      const PAD = drawingWidth;
      minX -= PAD;
      minY -= PAD;
      maxX += PAD;
      maxY += PAD;
      const w = Math.max(maxX - minX, 1);
      const h = Math.max(maxY - minY, 1);
      const relPoints = currentStrokePoints.map((pt) => ({
        x: pt.x - minX,
        y: pt.y - minY,
      }));

      if (activeTool === "freeform") {
        const COORD_SCALE = 100;
        const pathW = Math.round(w * COORD_SCALE);
        const pathH = Math.round(h * COORD_SCALE);
        const segments: CustomGeometrySegment[] = [];
        for (let i = 0; i < relPoints.length; i++) {
          const scaledPt = {
            x: Math.round(relPoints[i].x * COORD_SCALE),
            y: Math.round(relPoints[i].y * COORD_SCALE),
          };
          segments.push(
            i === 0
              ? { type: "moveTo", pt: scaledPt }
              : { type: "lineTo", pt: scaledPt },
          );
        }
        const freeformShape: ShapePptxElement = {
          id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: "shape",
          x: minX,
          y: minY,
          width: w,
          height: h,
          shapeType: "custom",
          shapeStyle: {
            fillColor: drawingColor,
            strokeColor: drawingColor,
            strokeWidth: drawingWidth,
          },
          customGeometryPaths: [{ width: pathW, height: pathH, segments }],
        };
        onAddFreeformShape?.(freeformShape);
      } else {
        const pathD = buildPathD(relPoints);
        const isHighlighter = activeTool === "highlighter";
        const ink: InkPptxElement = {
          id: `ink-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: "ink",
          x: minX,
          y: minY,
          width: w,
          height: h,
          inkPaths: [pathD],
          inkColors: [drawingColor],
          inkWidths: [drawingWidth],
          inkOpacities: [isHighlighter ? 0.4 : 1],
          inkTool: isHighlighter ? "highlighter" : "pen",
        };
        onAddInkElement?.(ink);
      }
      setCurrentStrokePoints([]);
    },
    [
      isStrokeActive,
      activeTool,
      currentStrokePoints,
      drawingColor,
      drawingWidth,
      isDrawingRef,
      onAddInkElement,
      onAddFreeformShape,
      buildPathD,
    ],
  );

  /** The in-progress stroke path for the live preview. */
  const liveStrokeD = useMemo(
    () => (isStrokeActive ? buildPathD(currentStrokePoints) : ""),
    [isStrokeActive, currentStrokePoints, buildPathD],
  );

  return {
    isDrawing,
    isStrokeActive,
    liveStrokeD,
    currentStrokePoints,
    handleDrawPointerDown,
    handleDrawPointerMove,
    handleDrawPointerUp,
  };
}
