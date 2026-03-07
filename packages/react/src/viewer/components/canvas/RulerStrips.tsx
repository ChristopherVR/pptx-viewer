/**
 * RulerStrips — Horizontal and vertical SVG ruler sub-components.
 *
 * Pure presentation components that render tick marks and optional
 * element-position highlight ranges. Extracted from Ruler.tsx to
 * keep each file under 300 lines.
 */
import React from "react";
import type { Tick } from "./ruler-utils";
import { RULER_THICKNESS, RULER_FONT_SIZE } from "./ruler-utils";

/* ------------------------------------------------------------------ */
/*  Shared prop shapes                                                */
/* ------------------------------------------------------------------ */

export interface RulerHighlight {
  start: number;
  end: number;
}

interface HorizontalRulerProps {
  ticks: Tick[];
  widthPx: number;
  highlight?: RulerHighlight | null;
}

interface VerticalRulerProps {
  ticks: Tick[];
  heightPx: number;
  highlight?: RulerHighlight | null;
}

/* ------------------------------------------------------------------ */
/*  HorizontalRuler                                                   */
/* ------------------------------------------------------------------ */

export const HorizontalRuler = React.memo(function HorizontalRuler({
  ticks,
  widthPx,
  highlight,
}: HorizontalRulerProps) {
  return (
    <svg
      width={widthPx}
      height={RULER_THICKNESS}
      className="block select-none"
      aria-hidden="true"
    >
      {/* Background */}
      <rect
        width={widthPx}
        height={RULER_THICKNESS}
        className="fill-gray-100 dark:fill-gray-800"
      />
      {/* Bottom border */}
      <line
        x1={0}
        y1={RULER_THICKNESS - 0.5}
        x2={widthPx}
        y2={RULER_THICKNESS - 0.5}
        className="stroke-border"
        strokeWidth={1}
      />
      {/* Selected element highlight */}
      {highlight && (
        <rect
          x={highlight.start}
          y={0}
          width={Math.max(highlight.end - highlight.start, 1)}
          height={RULER_THICKNESS}
          className="fill-primary/20"
        />
      )}
      {/* Tick marks */}
      {ticks.map((tick, i) => {
        const tickHeight = tick.isMajor
          ? RULER_THICKNESS * 0.6
          : RULER_THICKNESS * 0.3;
        return (
          <g key={i}>
            <line
              x1={tick.position}
              y1={RULER_THICKNESS}
              x2={tick.position}
              y2={RULER_THICKNESS - tickHeight}
              className="stroke-gray-400 dark:stroke-gray-500"
              strokeWidth={tick.isMajor ? 1 : 0.5}
            />
            {tick.label && (
              <text
                x={tick.position + 2}
                y={RULER_FONT_SIZE + 1}
                fontSize={RULER_FONT_SIZE}
                className="fill-gray-500 dark:fill-gray-400"
                style={{ fontFamily: "system-ui, sans-serif" }}
              >
                {tick.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
});

/* ------------------------------------------------------------------ */
/*  VerticalRuler                                                     */
/* ------------------------------------------------------------------ */

export const VerticalRuler = React.memo(function VerticalRuler({
  ticks,
  heightPx,
  highlight,
}: VerticalRulerProps) {
  return (
    <svg
      width={RULER_THICKNESS}
      height={heightPx}
      className="block select-none"
      aria-hidden="true"
    >
      {/* Background */}
      <rect
        width={RULER_THICKNESS}
        height={heightPx}
        className="fill-gray-100 dark:fill-gray-800"
      />
      {/* Right border */}
      <line
        x1={RULER_THICKNESS - 0.5}
        y1={0}
        x2={RULER_THICKNESS - 0.5}
        y2={heightPx}
        className="stroke-border"
        strokeWidth={1}
      />
      {/* Selected element highlight */}
      {highlight && (
        <rect
          x={0}
          y={highlight.start}
          width={RULER_THICKNESS}
          height={Math.max(highlight.end - highlight.start, 1)}
          className="fill-primary/20"
        />
      )}
      {/* Tick marks */}
      {ticks.map((tick, i) => {
        const tickWidth = tick.isMajor
          ? RULER_THICKNESS * 0.6
          : RULER_THICKNESS * 0.3;
        return (
          <g key={i}>
            <line
              x1={RULER_THICKNESS}
              y1={tick.position}
              x2={RULER_THICKNESS - tickWidth}
              y2={tick.position}
              className="stroke-gray-400 dark:stroke-gray-500"
              strokeWidth={tick.isMajor ? 1 : 0.5}
            />
            {tick.label && (
              <text
                x={2}
                y={tick.position + RULER_FONT_SIZE + 2}
                fontSize={RULER_FONT_SIZE}
                className="fill-gray-500 dark:fill-gray-400"
                style={{ fontFamily: "system-ui, sans-serif" }}
              >
                {tick.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
});
