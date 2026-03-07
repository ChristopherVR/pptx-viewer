/**
 * SVG overlay for drawing ink strokes on the slide canvas.
 */
import React from "react";
import type { DrawingTool } from "../../types-ui";
import type { CanvasSize } from "../../types";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface DrawingOverlaySvgProps {
  canvasSize: CanvasSize;
  activeTool: DrawingTool;
  drawingColor: string;
  drawingWidth: number;
  isStrokeActive: boolean;
  liveStrokeD: string;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function DrawingOverlaySvg({
  canvasSize,
  activeTool,
  drawingColor,
  drawingWidth,
  isStrokeActive,
  liveStrokeD,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: DrawingOverlaySvgProps) {
  return (
    <svg
      className="absolute inset-0 z-[60]"
      style={{
        width: canvasSize.width,
        height: canvasSize.height,
        cursor: "crosshair",
        touchAction: "none",
      }}
      viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Live stroke preview */}
      {isStrokeActive && liveStrokeD && (
        <path
          d={liveStrokeD}
          fill="none"
          stroke={drawingColor}
          strokeWidth={drawingWidth}
          strokeOpacity={activeTool === "highlighter" ? 0.4 : 1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
