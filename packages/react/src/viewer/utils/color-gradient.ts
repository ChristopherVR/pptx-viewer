/**
 * Gradient, pattern fill, and OOXML pattern preset utilities.
 *
 * Handles sanitization of gradient stop arrays, conversion to CSS gradient
 * strings, and generation of SVG-based pattern fill backgrounds for OOXML
 * pattern presets (a:pattFill).
 */
import type { ShapeStyle } from "pptx-viewer-core";
import { DEFAULT_FILL_COLOR } from "../constants";
import {
  normalizeHexColor,
  clampUnitInterval,
  colorWithOpacity,
} from "./color-core";
import { getPatternSvg } from "./color-patterns";

/**
 * Validates, normalizes, and sorts an array of gradient stops.
 * Filters out invalid entries (missing color/position), clamps positions
 * to 0-100, normalizes colors, and sorts by ascending position.
 * @param stops - Raw gradient stop array from shape style.
 * @returns A sanitized, sorted array of gradient stops.
 */
export function sanitizeGradientStops(
  stops: ShapeStyle["fillGradientStops"] | undefined,
): NonNullable<ShapeStyle["fillGradientStops"]> {
  if (!stops || stops.length === 0) return [];
  return stops
    .filter(
      (stop) =>
        typeof stop?.color === "string" &&
        String(stop.color).trim().length > 0 &&
        typeof stop?.position === "number" &&
        Number.isFinite(stop.position),
    )
    .map((stop) => ({
      color: normalizeHexColor(String(stop.color), DEFAULT_FILL_COLOR),
      position: Math.max(0, Math.min(100, stop.position)),
      opacity:
        typeof stop.opacity === "number" && Number.isFinite(stop.opacity)
          ? clampUnitInterval(stop.opacity)
          : undefined,
    }))
    .sort((left, right) => left.position - right.position);
}

/**
 * Converts a single gradient stop to a CSS gradient color-stop string.
 * Applies opacity via `rgba()` if specified, and rounds the position to an integer percentage.
 * @param stop - A gradient stop with color, position (0-100), and optional opacity.
 * @returns A CSS string like `"#FF0000 50%"` or `"rgba(255,0,0,0.5) 50%"`.
 */
export function toCssGradientStop(stop: {
  color: string;
  position: number;
  opacity?: number;
}): string {
  const color =
    typeof stop.opacity === "number"
      ? colorWithOpacity(stop.color, stop.opacity)
      : stop.color;
  return `${color} ${Math.round(Math.max(0, Math.min(100, stop.position)))}%`;
}

/**
 * Builds a CSS radial-gradient for `path="rect"` gradients.
 *
 * OOXML `path="rect"` defines a rectangular gradient that radiates from the
 * fillToRect rectangle outward to the shape edges. We approximate this with
 * a CSS `radial-gradient(ellipse ...)` where the ellipse size and center are
 * derived from the fillToRect LTRB inset values.
 *
 * The fillToRect values (l, t, r, b) define the inner rectangle:
 * - left edge at `l` fraction from left
 * - top edge at `t` fraction from top
 * - right edge at `1-r` fraction from left
 * - bottom edge at `1-b` fraction from top
 *
 * The gradient center is the center of this rectangle, and the ellipse
 * radii are sized so the gradient reaches the shape edges.
 */
export function buildRectPathGradient(
  stops: NonNullable<ShapeStyle["fillGradientStops"]>,
  focalPoint?: ShapeStyle["fillGradientFocalPoint"],
  fillToRect?: ShapeStyle["fillGradientFillToRect"],
): string {
  const stopStr = stops.map(toCssGradientStop).join(", ");

  if (fillToRect) {
    const { l, t, r, b } = fillToRect;
    // Center of the fillToRect
    const cx = ((l + (1 - r)) / 2) * 100;
    const cy = ((t + (1 - b)) / 2) * 100;

    // The gradient extends from the fillToRect edges to the shape boundary.
    // The ellipse semi-axis = max distance from center to shape edge.
    // Horizontal: max(cx, 100 - cx) gives the furthest edge distance.
    // Vertical: max(cy, 100 - cy) gives the furthest edge distance.
    const semiX = Math.max(cx, 100 - cx);
    const semiY = Math.max(cy, 100 - cy);

    // Use closest-side when fillToRect is centered (symmetric),
    // otherwise use explicit sizing to better match the rectangular shape.
    const posX = `${Math.round(cx)}%`;
    const posY = `${Math.round(cy)}%`;

    return `radial-gradient(${Math.round(semiX)}% ${Math.round(semiY)}% at ${posX} ${posY}, ${stopStr})`;
  }

  // Fallback: use focal point if available, otherwise center
  const posX = focalPoint ? `${Math.round(focalPoint.x * 100)}%` : "center";
  const posY = focalPoint ? `${Math.round(focalPoint.y * 100)}%` : "center";
  return `radial-gradient(ellipse at ${posX} ${posY}, ${stopStr})`;
}

/**
 * Builds a CSS gradient approximation for `path="shape"` gradients.
 *
 * OOXML `path="shape"` defines a gradient that follows the shape boundary,
 * radiating inward from the shape edges. This is impossible to replicate
 * perfectly with CSS, so we approximate it with a multi-layer approach:
 * a radial gradient positioned at the fillToRect center. We use
 * `farthest-side` sizing so the gradient extends to the nearest shape edge,
 * giving a better shape-following appearance than a simple circle.
 *
 * For centered shapes (the most common case), this produces a result very
 * close to PowerPoint's rendering.
 */
export function buildShapePathGradient(
  stops: NonNullable<ShapeStyle["fillGradientStops"]>,
  focalPoint?: ShapeStyle["fillGradientFocalPoint"],
  fillToRect?: ShapeStyle["fillGradientFillToRect"],
): string {
  const stopStr = stops.map(toCssGradientStop).join(", ");

  if (fillToRect) {
    const { l, t, r, b } = fillToRect;
    const cx = ((l + (1 - r)) / 2) * 100;
    const cy = ((t + (1 - b)) / 2) * 100;

    const posX = `${Math.round(cx)}%`;
    const posY = `${Math.round(cy)}%`;

    // Use farthest-side so the gradient reaches the furthest shape edge,
    // approximating the "follows-shape-boundary" behaviour.
    return `radial-gradient(farthest-side at ${posX} ${posY}, ${stopStr})`;
  }

  const posX = focalPoint ? `${Math.round(focalPoint.x * 100)}%` : "center";
  const posY = focalPoint ? `${Math.round(focalPoint.y * 100)}%` : "center";
  return `radial-gradient(farthest-side at ${posX} ${posY}, ${stopStr})`;
}

/**
 * Builds a complete CSS `linear-gradient()` or `radial-gradient()` string
 * from a ShapeStyle's gradient properties.
 *
 * For radial gradients, the rendering varies by `fillGradientPathType`:
 * - `"circle"` (default): Simple circular radial gradient at the focal point.
 * - `"rect"`: Elliptical radial gradient sized from the fillToRect rectangle,
 *    approximating the OOXML rectangular path gradient.
 * - `"shape"`: Multi-layer radial gradient using farthest-side sizing,
 *    approximating a gradient that follows the shape boundary.
 *
 * Falls back to `style.fillGradient` if no valid stops are present.
 * @param style - The shape style containing gradient configuration.
 * @returns A CSS gradient string, or `undefined` if not a gradient fill.
 */
export function buildCssGradientFromShapeStyle(
  style: ShapeStyle | undefined,
): string | undefined {
  if (!style || style.fillMode !== "gradient") {
    return undefined;
  }

  const stops = sanitizeGradientStops(style.fillGradientStops);
  if (stops.length === 0) {
    return style.fillGradient;
  }

  const gradientType = style.fillGradientType || "linear";
  if (gradientType === "radial") {
    const pathType = style.fillGradientPathType || "circle";
    const fp = style.fillGradientFocalPoint;
    const ftr = style.fillGradientFillToRect;

    if (pathType === "rect") {
      return buildRectPathGradient(stops, fp, ftr);
    }

    if (pathType === "shape") {
      return buildShapePathGradient(stops, fp, ftr);
    }

    // Default: circle path type
    const posX = fp ? `${Math.round(fp.x * 100)}%` : "center";
    const posY = fp ? `${Math.round(fp.y * 100)}%` : "center";
    return `radial-gradient(circle at ${posX} ${posY}, ${stops.map(toCssGradientStop).join(", ")})`;
  }

  const normalizedAngle =
    typeof style.fillGradientAngle === "number" &&
    Number.isFinite(style.fillGradientAngle)
      ? style.fillGradientAngle
      : 90;
  return `linear-gradient(${Math.round(normalizedAngle)}deg, ${stops
    .map(toCssGradientStop)
    .join(", ")})`;
}

/**
 * Build a CSS background-image for OOXML pattern fills (a:pattFill).
 * Uses inline SVG data URIs to approximate the preset patterns.
 */
export function buildPatternFillCss(
  style: ShapeStyle | undefined,
): { backgroundImage: string; backgroundColor: string } | undefined {
  if (!style || style.fillMode !== "pattern" || !style.fillPatternPreset) {
    return undefined;
  }

  const fg = normalizeHexColor(style.fillColor, "#000000");
  const bg = normalizeHexColor(style.fillPatternBackgroundColor, "#ffffff");
  const preset = style.fillPatternPreset;

  // Generate SVG pattern based on preset
  const svgPattern = getPatternSvg(preset, fg, bg);
  if (!svgPattern) return undefined;

  const encoded = encodeURIComponent(svgPattern);
  return {
    backgroundImage: `url("data:image/svg+xml,${encoded}")`,
    backgroundColor: bg,
  };
}

/**
 * All 52 OOXML pattern fill presets.
 * Reference: ECMA-376 §20.1.10.33 (ST_PresetPatternVal)
 */
export const OOXML_PATTERN_PRESETS = [
  "pct5",
  "pct10",
  "pct20",
  "pct25",
  "pct30",
  "pct40",
  "pct50",
  "pct60",
  "pct70",
  "pct75",
  "pct80",
  "pct90",
  "horz",
  "vert",
  "ltHorz",
  "ltVert",
  "dkHorz",
  "dkVert",
  "narHorz",
  "narVert",
  "wdHorz",
  "wdVert",
  "dashHorz",
  "dashVert",
  "cross",
  "dnDiag",
  "upDiag",
  "ltDnDiag",
  "ltUpDiag",
  "dkDnDiag",
  "dkUpDiag",
  "wdDnDiag",
  "wdUpDiag",
  "dashDnDiag",
  "dashUpDiag",
  "diagCross",
  "smCheck",
  "lgCheck",
  "smGrid",
  "lgGrid",
  "dotGrid",
  "smConfetti",
  "lgConfetti",
  "horzBrick",
  "diagBrick",
  "solidDmnd",
  "openDmnd",
  "dotDmnd",
  "plaid",
  "sphere",
  "weave",
  "divot",
  "shingle",
  "wave",
  "trellis",
  "zigZag",
] as const;

export type OoxmlPatternPreset = (typeof OOXML_PATTERN_PRESETS)[number];
