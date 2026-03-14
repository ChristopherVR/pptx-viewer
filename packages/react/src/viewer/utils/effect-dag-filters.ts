/**
 * Effect DAG filter rendering.
 *
 * Maps parsed `a:effectDag` properties from {@link ShapeStyle} to CSS filter
 * strings, opacity values, SVG filter markup, and blend modes.
 *
 * The effect DAG (Directed Acyclic Graph) is PowerPoint's mechanism for
 * chaining complex image/shape adjustments: grayscale, bi-level threshold,
 * brightness/contrast, hue/saturation/luminance, alpha modulation, tint,
 * duotone, and fill-overlay blending.
 *
 * @module effect-dag-filters
 */

import type { ShapeStyle } from "pptx-viewer-core";

// ── CSS filter generation ───────────────────────────────────────────────

/**
 * Build a CSS `filter` string from effect DAG properties on a {@link ShapeStyle}.
 *
 * Each DAG property maps to one or more CSS filter functions:
 * - `dagGrayscale`   -> `grayscale(1)`
 * - `dagBiLevel`     -> `contrast(1000)` (threshold > 50) or `contrast(0.01)` (threshold <= 50)
 * - `dagLumBrightness` / `dagLumContrast` -> `brightness()` / `contrast()`
 * - `dagHslHue`      -> `hue-rotate(Ndeg)`
 * - `dagHslSaturation` -> `saturate(N)`
 * - `dagHslLuminance` -> `brightness(N)` (approximation)
 * - `dagAlphaModFix`  -> `opacity(N)`
 * - `dagTintHue` / `dagTintAmount` -> `sepia(N) hue-rotate(Ndeg)`
 * - `dagDuotone`     -> `url(#dag-duotone-ID)` (requires companion SVG filter)
 *
 * @param style - The shape style containing DAG properties.
 * @param elementId - Element ID used for SVG filter URL references (duotone).
 * @returns A CSS filter string, or `undefined` if no DAG filters apply.
 */
export function getEffectDagCssFilter(
  style: ShapeStyle | undefined,
  elementId?: string,
): string | undefined {
  if (!style) return undefined;

  const filters: string[] = [];

  // Grayscale
  if (style.dagGrayscale) {
    filters.push("grayscale(1)");
  }

  // Bi-level: 1-bit black/white threshold
  // Values > 50 push everything to white (extreme contrast),
  // values <= 50 push everything to black (near-zero contrast).
  if (typeof style.dagBiLevel === "number") {
    const thresh = Math.max(0, Math.min(100, style.dagBiLevel));
    if (thresh > 50) {
      filters.push("contrast(1000)");
    } else {
      filters.push("contrast(0.01)");
    }
  }

  // Luminance: brightness and contrast adjustments
  if (
    typeof style.dagLumBrightness === "number" ||
    typeof style.dagLumContrast === "number"
  ) {
    const bright = style.dagLumBrightness ?? 0;
    const contrast = style.dagLumContrast ?? 0;
    if (bright !== 0) {
      filters.push(`brightness(${1 + bright / 100})`);
    }
    if (contrast !== 0) {
      filters.push(`contrast(${1 + contrast / 100})`);
    }
  }

  // HSL adjustments: hue rotation, saturation, luminance
  if (typeof style.dagHslHue === "number" && style.dagHslHue !== 0) {
    filters.push(`hue-rotate(${style.dagHslHue}deg)`);
  }
  if (
    typeof style.dagHslSaturation === "number" &&
    style.dagHslSaturation !== 100
  ) {
    filters.push(`saturate(${style.dagHslSaturation / 100})`);
  }
  if (
    typeof style.dagHslLuminance === "number" &&
    style.dagHslLuminance !== 0
  ) {
    // CSS has no direct luminance filter; approximate with brightness
    filters.push(`brightness(${1 + style.dagHslLuminance / 100})`);
  }

  // Alpha modulation: rendered as CSS opacity() filter function
  if (typeof style.dagAlphaModFix === "number") {
    const alpha = Math.max(0, Math.min(1, style.dagAlphaModFix / 100));
    filters.push(`opacity(${alpha})`);
  }

  // Tint: sepia desaturation then hue-rotate to target hue
  if (
    typeof style.dagTintHue === "number" ||
    typeof style.dagTintAmount === "number"
  ) {
    const hue = style.dagTintHue ?? 0;
    const amt = Math.max(0, Math.min(100, style.dagTintAmount ?? 50));
    filters.push(`sepia(${amt / 100}) hue-rotate(${hue}deg)`);
  }

  // Duotone: reference companion SVG filter
  if (style.dagDuotone && elementId) {
    filters.push(`url(#dag-duotone-${elementId})`);
  }

  return filters.length > 0 ? filters.join(" ") : undefined;
}

/**
 * Alias for {@link getEffectDagCssFilter}.
 *
 * Preserved for backward compatibility. The original `getEffectDagFilter`
 * is now identical to the more descriptively named `getEffectDagCssFilter`.
 */
export const getEffectDagFilter = getEffectDagCssFilter;

// ── Opacity ─────────────────────────────────────────────────────────────

/**
 * Extract CSS opacity from the `dagAlphaModFix` property.
 *
 * Returns a value in 0-1 range suitable for CSS `opacity`, or `undefined`
 * if no alpha modulation is set.
 *
 * @param style - The shape style containing DAG properties.
 * @returns Opacity value (0-1), or `undefined`.
 */
export function getEffectDagOpacity(
  style: ShapeStyle | undefined,
): number | undefined {
  if (!style || typeof style.dagAlphaModFix !== "number") return undefined;
  return Math.max(0, Math.min(1, style.dagAlphaModFix / 100));
}

// ── Blend mode ──────────────────────────────────────────────────────────

/**
 * Map the `dagFillOverlayBlend` property to a CSS `mix-blend-mode` value.
 *
 * @param blend - The OOXML blend mode attribute.
 * @returns CSS mix-blend-mode value, or `undefined` for "over" (normal).
 */
export function getEffectDagBlendMode(
  blend: ShapeStyle["dagFillOverlayBlend"],
): string | undefined {
  if (!blend) return undefined;
  switch (blend) {
    case "mult":
      return "multiply";
    case "screen":
      return "screen";
    case "darken":
      return "darken";
    case "lighten":
      return "lighten";
    case "over":
    default:
      return undefined;
  }
}

// ── Duotone SVG filter markup ───────────────────────────────────────────

/**
 * Parse a hex colour string to normalised 0-1 RGB components.
 */
function hexToRgbUnit(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return {
    r: Number.isFinite(r) ? r : 0,
    g: Number.isFinite(g) ? g : 0,
    b: Number.isFinite(b) ? b : 0,
  };
}

/**
 * Generate an SVG `<filter>` markup string for a duotone colour mapping.
 *
 * The filter converts to grayscale (BT.601 luminance weights) then remaps
 * luminance from color1 (shadows) to color2 (highlights) using an
 * feComponentTransfer with linear ramps.
 *
 * This is useful for environments where React JSX rendering is not available
 * (e.g. tests, server-side). For React rendering, use
 * `renderDagDuotoneSvgFilter` from `shape-visual-filters.tsx`.
 *
 * @param filterId - The SVG filter ID.
 * @param color1 - Shadow colour (hex).
 * @param color2 - Highlight colour (hex).
 * @returns SVG markup string containing the filter definition.
 */
export function getDuotoneSvgFilterMarkup(
  filterId: string,
  color1: string,
  color2: string,
): string {
  const c1 = hexToRgbUnit(color1);
  const c2 = hexToRgbUnit(color2);

  const grayscaleMatrix = [
    0.2126, 0.7152, 0.0722, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
    0.2126, 0.7152, 0.0722, 0, 0,
    0, 0, 0, 1, 0,
  ].join(" ");

  const slopeR = c2.r - c1.r;
  const slopeG = c2.g - c1.g;
  const slopeB = c2.b - c1.b;

  return [
    `<svg width="0" height="0" style="position:absolute;overflow:hidden" aria-hidden="true">`,
    `<defs>`,
    `<filter id="${filterId}" color-interpolation-filters="sRGB">`,
    `<feColorMatrix type="matrix" values="${grayscaleMatrix}"/>`,
    `<feComponentTransfer>`,
    `<feFuncR type="linear" slope="${slopeR}" intercept="${c1.r}"/>`,
    `<feFuncG type="linear" slope="${slopeG}" intercept="${c1.g}"/>`,
    `<feFuncB type="linear" slope="${slopeB}" intercept="${c1.b}"/>`,
    `</feComponentTransfer>`,
    `</filter>`,
    `</defs>`,
    `</svg>`,
  ].join("");
}

// ── Combined helper ─────────────────────────────────────────────────────

/**
 * Check whether a {@link ShapeStyle} has any active effect DAG properties.
 *
 * Useful for short-circuiting rendering logic when no DAG effects are present.
 */
export function hasEffectDagProperties(
  style: ShapeStyle | undefined,
): boolean {
  if (!style) return false;
  return Boolean(
    style.dagGrayscale ||
      typeof style.dagBiLevel === "number" ||
      typeof style.dagLumBrightness === "number" ||
      typeof style.dagLumContrast === "number" ||
      typeof style.dagHslHue === "number" ||
      typeof style.dagHslSaturation === "number" ||
      typeof style.dagHslLuminance === "number" ||
      typeof style.dagAlphaModFix === "number" ||
      typeof style.dagTintHue === "number" ||
      typeof style.dagTintAmount === "number" ||
      style.dagDuotone ||
      style.dagFillOverlayBlend,
  );
}
