/**
 * GridOverlay — Renders a dotted grid pattern over the slide canvas.
 *
 * Uses an SVG <pattern> element to render a subtle dot grid that matches
 * PowerPoint's built-in grid display. The grid spacing can be configured
 * via the `gridSpacingPx` prop (defaults to the GRID_SIZE constant).
 */
import { useMemo } from "react";

import { GRID_SIZE } from "../../constants";
import type { CanvasSize } from "../../types";

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

export interface GridOverlayProps {
  canvasSize: CanvasSize;
  /** Grid spacing in CSS pixels. Defaults to GRID_SIZE (8). */
  gridSpacingPx?: number;
  /** Whether the grid is visible. */
  visible: boolean;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function GridOverlay({
  canvasSize,
  gridSpacingPx = GRID_SIZE,
  visible,
}: GridOverlayProps) {
  const spacing = Math.max(gridSpacingPx, 2);

  // Unique pattern ID to avoid collisions when multiple viewers exist
  const patternId = useMemo(
    () => `grid-dot-pattern-${Math.random().toString(36).slice(2, 8)}`,
    [],
  );

  if (!visible) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-[2]"
      width={canvasSize.width}
      height={canvasSize.height}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id={patternId}
          width={spacing}
          height={spacing}
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx={spacing / 2}
            cy={spacing / 2}
            r={0.6}
            fill="rgba(156, 163, 175, 0.55)"
          />
        </pattern>
      </defs>
      <rect
        width={canvasSize.width}
        height={canvasSize.height}
        fill={`url(#${patternId})`}
      />
    </svg>
  );
}
