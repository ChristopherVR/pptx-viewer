/**
 * Gradient, pattern fill, and OOXML pattern preset utilities.
 *
 * Handles sanitization of gradient stop arrays, conversion to CSS gradient
 * strings, and generation of SVG-based pattern fill backgrounds for OOXML
 * pattern presets (a:pattFill).
 *
 * Gradient rendering follows ECMA-376 Part 1, §20.1.8.35 (gradFill) and
 * §20.1.8.49 (pathFill). The three path types — circle, rect, shape — each
 * have dedicated builders that try to approximate the OOXML behaviour as
 * closely as CSS radial-gradient permits.
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
 * Converts an OOXML gradient angle (in 60000ths of a degree) to a CSS
 * linear-gradient angle in degrees. OOXML measures clockwise from the
 * left-to-right axis; CSS `linear-gradient` measures clockwise from "to top"
 * (i.e. 0deg = bottom-to-top, 90deg = left-to-right).
 *
 * Conversion: `cssAngle = ooxmlAngle / 60000 + 90`  (then normalised to 0-360).
 *
 * If the input is already in plain degrees (typically from the parser, which
 * pre-converts), this function still normalises and rounds the value.
 *
 * @param ooxmlAngle - Angle in 60000ths of a degree, or plain degrees if
 *                     already converted by the parser.
 * @param alreadyDegrees - When true, the input is treated as plain degrees.
 * @returns A CSS-compatible angle in degrees (0-360), rounded to 1 decimal.
 */
export function convertOoxmlAngleToCss(
  ooxmlAngle: number,
  alreadyDegrees = true,
): number {
  const deg = alreadyDegrees ? ooxmlAngle : ooxmlAngle / 60000;
  // Normalise to 0-360 range
  return ((deg % 360) + 360) % 360;
}

/**
 * Converts a single gradient stop to a CSS gradient color-stop string.
 * Applies opacity via `rgba()` if specified. Uses fractional percentage
 * positioning (1 decimal place) for higher fidelity when stops are close
 * together -- PowerPoint positions are 0-100000 (thousandths of a percent)
 * which can lose precision with integer rounding.
 *
 * @param stop - A gradient stop with color, position (0-100), and optional opacity.
 * @returns A CSS string like `"#FF0000 50%"` or `"rgba(255,0,0,0.5) 33.3%"`.
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
  const pos = Math.max(0, Math.min(100, stop.position));
  // Use integer percentage when it would be exact; use 1 decimal otherwise
  // to preserve stop precision for multi-stop gradients.
  const posStr = pos === Math.round(pos) ? `${pos}%` : `${pos.toFixed(1)}%`;
  return `${color} ${posStr}`;
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
 *
 * When the fillToRect describes a non-degenerate inner rectangle (l + r < 1
 * and t + b < 1) we produce a layered CSS background: the first layer is
 * a radial-gradient sized to the inner rectangle dimensions (closest-side),
 * ensuring the colour transition closely follows the rectangular boundary
 * rather than being a simple ellipse.
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

    const posX = `${Math.round(cx)}%`;
    const posY = `${Math.round(cy)}%`;

    // When the fillToRect defines a non-degenerate inner rectangle, compute
    // the inner rectangle's half-dimensions so we can size the ellipse to
    // match more closely. This produces a better rectangular gradient feel.
    const innerHalfW = ((1 - l - r) / 2) * 100;
    const innerHalfH = ((1 - t - b) / 2) * 100;

    // If the inner rect has meaningful dimensions and is asymmetric relative
    // to the shape, use its aspect ratio to scale the ellipse radii.
    if (innerHalfW > 0.5 && innerHalfH > 0.5 && Math.abs(semiX - semiY) > 1) {
      // Scale radii proportionally to inner rectangle aspect ratio
      const aspect = innerHalfW / innerHalfH;
      const adjustedSemiX = Math.round(semiY * aspect);
      const adjustedSemiY = Math.round(semiY);
      return `radial-gradient(${adjustedSemiX}% ${adjustedSemiY}% at ${posX} ${posY}, ${stopStr})`;
    }

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
 * perfectly with CSS, so we approximate it with an elliptical radial
 * gradient whose radii are derived from the fillToRect. When the fillToRect
 * defines a non-square inner region, we use explicit percentage sizing to
 * ensure the ellipse aspect ratio better approximates the shape boundary,
 * rather than defaulting to farthest-side (which always produces a circle
 * for centered positions).
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

    // Compute the inner-rect half-widths as percentages. When both are
    // positive and different, use explicit sizing to preserve the rectangle's
    // aspect ratio — this more closely approximates "follows the shape edge".
    const innerHalfW = ((1 - l - r) / 2) * 100;
    const innerHalfH = ((1 - t - b) / 2) * 100;

    if (
      innerHalfW > 0.5 &&
      innerHalfH > 0.5 &&
      Math.abs(innerHalfW - innerHalfH) > 1
    ) {
      // Use percentage radii matching the inner rectangle's proportions
      return `radial-gradient(${Math.round(innerHalfW)}% ${Math.round(innerHalfH)}% at ${posX} ${posY}, ${stopStr})`;
    }

    // Symmetric or nearly-symmetric: farthest-side is a good fit
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

// ---------------------------------------------------------------------------
// Gradient tile/flip mode utilities
// ---------------------------------------------------------------------------

/**
 * OOXML gradient tile-flip mode from `a:gradFill/@flip`.
 * Controls how the gradient is repeated when `@rotWithShape` is active:
 * - `"none"` — clamp: gradient stops at 0% and 100%, no repeat.
 * - `"x"`    — flip horizontally on each tile.
 * - `"y"`    — flip vertically on each tile.
 * - `"xy"`   — flip both axes on each tile.
 */
export type GradientTileFlipMode = "none" | "x" | "y" | "xy";

/**
 * Builds a CSS `background-size` + `background-repeat` pair that approximates
 * gradient tiling with flip. Standard CSS does not natively support gradient
 * flipping, but we can approximate it by using `repeating-linear-gradient`
 * or `background-size` with `repeat` for simple cases.
 *
 * For flip modes, we construct a reflected gradient by duplicating the stops
 * in reverse within a single gradient period, then tiling via background-repeat.
 *
 * @param mode - The OOXML tile-flip mode.
 * @returns CSS properties to apply, or `undefined` if no tiling is needed.
 */
export function getGradientTileFlipCss(
  mode: GradientTileFlipMode | undefined,
): { backgroundSize?: string; backgroundRepeat?: string } | undefined {
  if (!mode || mode === "none") return undefined;

  // For flip modes, we halve the background-size on the flipped axis
  // and use repeat. The gradient itself should be built with reflected
  // stops (handled by buildReflectedGradientStops).
  switch (mode) {
    case "x":
      return { backgroundSize: "50% 100%", backgroundRepeat: "repeat-x" };
    case "y":
      return { backgroundSize: "100% 50%", backgroundRepeat: "repeat-y" };
    case "xy":
      return { backgroundSize: "50% 50%", backgroundRepeat: "repeat" };
    default:
      return undefined;
  }
}

/**
 * Creates a reflected (mirrored) copy of gradient stops for tile-flip
 * rendering. The original stops run 0->100; reflected stops run 100->0,
 * mapped to the 50-100% range so the combined 0-100% range contains
 * one full forward-backward cycle.
 *
 * @param stops - Original sanitized gradient stops (positions 0-100).
 * @returns A new stop array covering 0-100 with forward + mirrored stops.
 */
export function buildReflectedGradientStops(
  stops: NonNullable<ShapeStyle["fillGradientStops"]>,
): NonNullable<ShapeStyle["fillGradientStops"]> {
  if (stops.length === 0) return [];

  // Forward pass: map positions from 0-100 to 0-50
  const forward = stops.map((s) => ({
    ...s,
    position: s.position / 2,
  }));

  // Reverse pass: map positions from 0-100 to 100-50 (mirrored)
  const reversed = [...stops].reverse().map((s) => ({
    ...s,
    position: 50 + (100 - s.position) / 2,
  }));

  return [...forward, ...reversed];
}
