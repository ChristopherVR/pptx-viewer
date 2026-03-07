/**
 * PresentationAnnotationOverlay
 *
 * Transparent SVG overlay rendered on top of the slide during presentation
 * mode. Captures pointer events for pen/highlighter/eraser tools and
 * displays the laser pointer dot.
 */
import React, { useCallback, useRef } from "react";

import type {
  AnnotationStroke,
  LaserPosition,
  PresentationTool,
} from "../hooks/usePresentationAnnotations";
import type { CanvasSize } from "../types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PresentationAnnotationOverlayProps {
  canvasSize: CanvasSize;
  editorScale: number;
  presentationTool: PresentationTool;
  annotationStrokes: AnnotationStroke[];
  currentStroke: AnnotationStroke | null;
  laserPosition: LaserPosition | null;
  onPointerDown: (x: number, y: number) => void;
  onPointerMove: (x: number, y: number) => void;
  onPointerUp: () => void;
  onLaserMove: (x: number, y: number) => void;
  onLaserLeave: () => void;
  onEraseAtPoint: (x: number, y: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPathD(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  const first = points[0];
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    d += ` L ${pt.x} ${pt.y}`;
  }
  return d;
}

function getCursorForTool(tool: PresentationTool): string {
  switch (tool) {
    case "laser":
      return "none";
    case "pen":
      return "crosshair";
    case "highlighter":
      return "crosshair";
    case "eraser":
      return "crosshair";
    default:
      return "default";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresentationAnnotationOverlay({
  canvasSize,
  editorScale,
  presentationTool,
  annotationStrokes,
  currentStroke,
  laserPosition,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onLaserMove,
  onLaserLeave,
  onEraseAtPoint,
}: PresentationAnnotationOverlayProps): React.ReactElement | null {
  const svgRef = useRef<SVGSVGElement>(null);
  const isErasingRef = useRef(false);

  const toSlideCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const x = (clientX - rect.left) / editorScale;
      const y = (clientY - rect.top) / editorScale;
      return { x, y };
    },
    [editorScale],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (presentationTool === "none") return;
      e.preventDefault();
      e.stopPropagation();
      const coords = toSlideCoords(e.clientX, e.clientY);
      if (!coords) return;

      if (presentationTool === "eraser") {
        isErasingRef.current = true;
        onEraseAtPoint(coords.x, coords.y);
        return;
      }
      if (presentationTool === "pen" || presentationTool === "highlighter") {
        onPointerDown(coords.x, coords.y);
      }
    },
    [presentationTool, toSlideCoords, onPointerDown, onEraseAtPoint],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (presentationTool === "none") return;
      const coords = toSlideCoords(e.clientX, e.clientY);
      if (!coords) return;

      if (presentationTool === "laser") {
        onLaserMove(coords.x, coords.y);
        return;
      }
      if (presentationTool === "eraser" && isErasingRef.current) {
        onEraseAtPoint(coords.x, coords.y);
        return;
      }
      if (presentationTool === "pen" || presentationTool === "highlighter") {
        onPointerMove(coords.x, coords.y);
      }
    },
    [
      presentationTool,
      toSlideCoords,
      onPointerMove,
      onLaserMove,
      onEraseAtPoint,
    ],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (presentationTool === "none") return;
      e.preventDefault();
      if (presentationTool === "eraser") {
        isErasingRef.current = false;
        return;
      }
      onPointerUp();
    },
    [presentationTool, onPointerUp],
  );

  const handlePointerLeave = useCallback(() => {
    if (presentationTool === "laser") {
      onLaserLeave();
    }
    if (presentationTool === "eraser") {
      isErasingRef.current = false;
    }
    onPointerUp();
  }, [presentationTool, onLaserLeave, onPointerUp]);

  if (presentationTool === "none") return null;

  const allStrokes = currentStroke
    ? [...annotationStrokes, currentStroke]
    : annotationStrokes;

  return (
    <div
      className="absolute inset-0"
      style={{
        zIndex: 60,
        cursor: getCursorForTool(presentationTool),
        pointerEvents: "auto",
      }}
    >
      <svg
        ref={svgRef}
        className="absolute"
        style={{
          width: canvasSize.width,
          height: canvasSize.height,
          transformOrigin: "top left",
          transform: `scale(${editorScale})`,
        }}
        viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        {allStrokes.map((stroke) => (
          <path
            key={stroke.id}
            d={buildPathD(stroke.points)}
            fill="none"
            stroke={stroke.color}
            strokeWidth={stroke.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={stroke.opacity}
          />
        ))}
      </svg>

      {/* Laser pointer dot */}
      {presentationTool === "laser" && laserPosition && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 24,
            height: 24,
            left: laserPosition.x * editorScale - 12,
            top: laserPosition.y * editorScale - 12,
            backgroundColor: "rgba(255, 0, 0, 0.85)",
            boxShadow:
              "0 0 12px 6px rgba(255, 0, 0, 0.5), 0 0 24px 12px rgba(255, 0, 0, 0.25)",
            filter: "drop-shadow(0 0 8px rgba(255, 0, 0, 0.7))",
            zIndex: 70,
          }}
        />
      )}
    </div>
  );
}
