/**
 * Ink rendering utilities for pressure-sensitive strokes and replay animation.
 *
 * Pressure sensitivity is approximated by splitting an SVG path into short
 * sub-segments, each rendered as a filled circle at that point's coordinates.
 * The radius of each circle varies according to the corresponding entry in the
 * `inkWidths` array.
 *
 * Replay animation uses SVG `stroke-dasharray` / `stroke-dashoffset` to
 * progressively reveal each stroke with a sequential delay.
 *
 * @module ink-rendering
 */

import type { InkPptxElement, ContentPartInkStroke } from "pptx-viewer-core";

// ==========================================================================
// SVG path point extraction
// ==========================================================================

/**
 * A 2D point extracted from an SVG path string.
 */
export interface PathPoint {
  x: number;
  y: number;
}

/**
 * Parse an SVG path `d` string and extract coordinate points.
 *
 * Supports M/m, L/l, C/c, Q/q, Z/z commands. Curves are sampled
 * at their control points and endpoints (not interpolated) for
 * lightweight processing. This is sufficient for pressure-width
 * rendering where each extracted point gets a circle overlay.
 */
export function extractPathPoints(d: string): PathPoint[] {
  const points: PathPoint[] = [];
  // Match all numeric pairs following SVG path commands
  const numberRegex = /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi;
  const numbers: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = numberRegex.exec(d)) !== null) {
    numbers.push(parseFloat(match[0]));
  }

  for (let i = 0; i < numbers.length - 1; i += 2) {
    points.push({ x: numbers[i], y: numbers[i + 1] });
  }

  return points;
}

// ==========================================================================
// Pressure-sensitive circle generation
// ==========================================================================

/**
 * Configuration for pressure-sensitive rendering.
 */
export interface PressureConfig {
  /** Minimum radius for the thinnest point. Default 0.5. */
  minRadius?: number;
  /** Maximum radius for the widest point. Default is the stroke width. */
  maxRadius?: number;
  /** Base stroke width used as a scaling reference. */
  baseWidth: number;
}

/**
 * A circle representing a single pressure point on an ink stroke.
 */
export interface PressureCircle {
  cx: number;
  cy: number;
  r: number;
}

/**
 * Interpolate a width value for a point along the stroke path.
 *
 * Given an array of width samples, linearly interpolate the width
 * at `t` where `t` is the normalised position along the path (0 to 1).
 */
export function interpolateWidth(
  widths: number[],
  t: number,
): number {
  if (widths.length === 0) return 1;
  if (widths.length === 1) return widths[0];

  const clampedT = Math.max(0, Math.min(1, t));
  const index = clampedT * (widths.length - 1);
  const lower = Math.floor(index);
  const upper = Math.min(lower + 1, widths.length - 1);
  const frac = index - lower;

  return widths[lower] * (1 - frac) + widths[upper] * frac;
}

/**
 * Generate pressure circles for a set of path points with per-point
 * width data.
 *
 * Each extracted point gets a circle whose radius reflects the
 * interpolated width at that position. When `widths` contains fewer
 * entries than `points`, values are interpolated linearly.
 */
export function generatePressureCircles(
  points: PathPoint[],
  widths: number[],
  config: PressureConfig,
): PressureCircle[] {
  if (points.length === 0) return [];

  const minR = config.minRadius ?? 0.5;
  const maxR = config.maxRadius ?? config.baseWidth;

  return points.map((pt, i) => {
    const t = points.length === 1 ? 0.5 : i / (points.length - 1);
    const w = interpolateWidth(widths, t);
    // Scale radius based on the ratio of the interpolated width to
    // the base width, clamped between minR and maxR.
    const ratio = config.baseWidth > 0 ? w / config.baseWidth : 1;
    const r = Math.max(minR, Math.min(maxR, (config.baseWidth / 2) * ratio));
    return { cx: pt.x, cy: pt.y, r };
  });
}

/**
 * Determine whether an ink element has meaningful pressure data that
 * differs from uniform width (i.e., the widths array has variation).
 */
export function hasPressureVariation(widths: number[]): boolean {
  if (widths.length <= 1) return false;
  const first = widths[0];
  return widths.some((w) => Math.abs(w - first) > 0.01);
}

// ==========================================================================
// Ink replay animation
// ==========================================================================

/**
 * Configuration for ink replay animation.
 */
export interface InkReplayConfig {
  /** Duration of each stroke's reveal in milliseconds. Default 600. */
  strokeDurationMs?: number;
  /** Delay between consecutive strokes in milliseconds. Default 200. */
  strokeDelayMs?: number;
  /** Easing function. Default "ease-in-out". */
  easing?: string;
}

/**
 * CSS properties for a single ink stroke's replay animation.
 */
export interface InkStrokeAnimationStyle {
  /** Estimated path length for stroke-dasharray. */
  pathLength: number;
  /** Animation delay for this stroke. */
  animationDelay: string;
  /** Animation duration for this stroke. */
  animationDuration: string;
  /** The CSS animation shorthand value. */
  animation: string;
  /** Initial stroke-dasharray value. */
  strokeDasharray: string;
  /** Initial stroke-dashoffset value. */
  strokeDashoffset: string;
}

/**
 * Estimate the length of an SVG path from its point list.
 *
 * This uses the simple Euclidean distance between consecutive points
 * as an approximation. For precise measurement, `SVGPathElement.getTotalLength()`
 * should be used, but this works well for animation setup.
 */
export function estimatePathLength(points: PathPoint[]): number {
  if (points.length < 2) return 0;
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

/**
 * Name for the CSS @keyframes rule used by ink replay.
 */
export const INK_REPLAY_KEYFRAME_NAME = "fuzor-ink-replay";

/**
 * CSS @keyframes definition for ink stroke replay.
 *
 * Uses `stroke-dashoffset` to progressively reveal the stroke
 * from its start to its end.
 */
export const INK_REPLAY_KEYFRAMES = `@keyframes ${INK_REPLAY_KEYFRAME_NAME} {
  from { stroke-dashoffset: var(--ink-path-length); }
  to { stroke-dashoffset: 0; }
}`;

/**
 * Generate animation style properties for a single ink stroke
 * in a replay sequence.
 *
 * @param strokeIndex - Zero-based index of the stroke in the sequence.
 * @param pathLength - Estimated or measured length of the stroke path.
 * @param config - Replay animation configuration.
 */
export function getInkStrokeReplayStyle(
  strokeIndex: number,
  pathLength: number,
  config: InkReplayConfig = {},
): InkStrokeAnimationStyle {
  const duration = config.strokeDurationMs ?? 600;
  const delay = config.strokeDelayMs ?? 200;
  const easing = config.easing ?? "ease-in-out";

  const totalDelay = strokeIndex * (duration + delay);
  const len = Math.max(pathLength, 1);

  return {
    pathLength: len,
    animationDelay: `${totalDelay}ms`,
    animationDuration: `${duration}ms`,
    animation: `${INK_REPLAY_KEYFRAME_NAME} ${duration}ms ${easing} ${totalDelay}ms forwards`,
    strokeDasharray: `${len}`,
    strokeDashoffset: `${len}`,
  };
}

/**
 * Compute replay animation styles for all strokes in an ink element.
 *
 * Returns an array with one entry per `inkPaths` item. Each entry
 * contains the CSS properties to apply to the corresponding `<path>`.
 */
export function getInkReplayStyles(
  el: InkPptxElement,
  config: InkReplayConfig = {},
): InkStrokeAnimationStyle[] {
  return el.inkPaths.map((d, i) => {
    const points = extractPathPoints(d);
    const pathLen = estimatePathLength(points);
    return getInkStrokeReplayStyle(i, pathLen, config);
  });
}

/**
 * Compute replay animation styles for content part ink strokes.
 */
export function getContentPartReplayStyles(
  strokes: ContentPartInkStroke[],
  config: InkReplayConfig = {},
): InkStrokeAnimationStyle[] {
  return strokes.map((stroke, i) => {
    const points = extractPathPoints(stroke.path);
    const pathLen = estimatePathLength(points);
    return getInkStrokeReplayStyle(i, pathLen, config);
  });
}

// ==========================================================================
// Total replay duration
// ==========================================================================

/**
 * Calculate the total duration of an ink replay animation in milliseconds.
 *
 * @param strokeCount - Number of strokes in the element.
 * @param config - Replay animation configuration.
 */
export function getTotalReplayDuration(
  strokeCount: number,
  config: InkReplayConfig = {},
): number {
  if (strokeCount <= 0) return 0;
  const duration = config.strokeDurationMs ?? 600;
  const delay = config.strokeDelayMs ?? 200;
  // Last stroke starts at (strokeCount-1)*(duration+delay) and runs for duration ms.
  return (strokeCount - 1) * (duration + delay) + duration;
}

// ==========================================================================
// Opacity helpers
// ==========================================================================

/**
 * Resolve the effective opacity for an ink stroke path.
 *
 * Falls back to 1 if no opacity array is present or the index is out of range.
 * Clamps values to the [0, 1] range.
 */
export function resolveInkOpacity(
  opacities: number[] | undefined,
  index: number,
): number {
  if (!opacities || index >= opacities.length) return 1;
  return Math.max(0, Math.min(1, opacities[index]));
}

/**
 * Resolve the effective stroke color for an ink path.
 */
export function resolveInkColor(
  colors: string[] | undefined,
  index: number,
  fallback = "#000",
): string {
  if (!colors || index >= colors.length) return fallback;
  return colors[index] || fallback;
}

/**
 * Resolve the effective stroke width for an ink path.
 */
export function resolveInkWidth(
  widths: number[] | undefined,
  index: number,
  fallback = 3,
): number {
  if (!widths || index >= widths.length) return fallback;
  return widths[index] > 0 ? widths[index] : fallback;
}
