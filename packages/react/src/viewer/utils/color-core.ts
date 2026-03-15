/**
 * Core color utility functions for the PowerPoint viewer/editor.
 *
 * Provides low-level primitives for hex-colour normalisation, opacity blending,
 * clamping, and CSS shadow generation from OOXML shape styles.
 */
import type { ShapeStyle } from "pptx-viewer-core";
import { DEFAULT_TEXT_COLOR } from "../constants";

/**
 * Creates a detached copy of a `Uint8Array` as an `ArrayBuffer`.
 * Useful for transferring binary data without shared-memory side-effects.
 * @param bytes - The source byte array.
 * @returns A new `ArrayBuffer` containing a copy of the data.
 */
export function createArrayBufferCopy(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

/**
 * Normalizes an arbitrary colour string to a 6-digit hex value (`#RRGGBB`).
 * Returns the fallback colour when the input is missing, "transparent", or invalid.
 * @param value - Raw colour string (with or without leading `#`).
 * @param fallback - Fallback hex colour (defaults to `DEFAULT_TEXT_COLOR`).
 * @returns A valid 7-character hex colour string.
 */
export function normalizeHexColor(
  value: string | undefined,
  fallback: string = DEFAULT_TEXT_COLOR,
): string {
  if (!value || value === "transparent") {
    return fallback;
  }
  const candidate = value.startsWith("#") ? value : `#${value}`;
  return /^#[0-9A-Fa-f]{6}$/.test(candidate) ? candidate : fallback;
}

/**
 * Clamps a numeric value to the [0, 1] range.
 * @param value - The number to clamp.
 * @returns A value between 0 and 1 inclusive.
 */
export function clampUnitInterval(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Parses a 6-digit hex colour string into its individual R, G, B channels (0-255).
 * @param color - A hex colour string (e.g. "#FF8800" or "FF8800").
 * @returns An object with `r`, `g`, `b` properties, or `null` if parsing fails.
 */
export function hexToRgbChannels(
  color: string,
): { r: number; g: number; b: number } | null {
  const normalized = color.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

/**
 * Converts a hex colour to an `rgba()` CSS string with the given opacity.
 * If `opacity` is `undefined`, the original hex colour is returned unchanged.
 * @param color - A hex colour string.
 * @param opacity - Opacity value (0-1), or `undefined` to skip blending.
 * @returns A CSS colour string (hex or `rgba()`).
 */
export function colorWithOpacity(
  color: string,
  opacity: number | undefined,
): string {
  if (opacity === undefined) return color;
  const rgb = hexToRgbChannels(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clampUnitInterval(opacity)})`;
}

/**
 * Clamps an image crop value (fractional 0-1) to a safe range.
 * Returns 0 for non-finite or missing values, and caps at 0.95 to
 * prevent the image from being fully cropped away.
 * @param value - The crop fraction.
 * @returns A clamped crop value between 0 and 0.95.
 */
export function clampCropValue(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(0.95, value));
}

/* ------------------------------------------------------------------ */
/*  Shadow CSS builders                                                */
/* ------------------------------------------------------------------ */

/**
 * Builds a CSS `box-shadow` string from the outer shadow properties on a ShapeStyle.
 * Supports both angle/distance and direct x/y offset modes.
 * Returns `undefined` if no shadow is defined.
 * @param style - The shape style containing shadow properties.
 * @returns A CSS box-shadow value string, or `undefined`.
 */
export function buildShadowCssFromShapeStyle(
  style: ShapeStyle | undefined,
): string | undefined {
  if (!style?.shadowColor || style.shadowColor === "transparent") {
    return undefined;
  }

  // Calculate offsets from angle/distance if available, otherwise use direct offsets
  let offsetX: number;
  let offsetY: number;

  if (
    typeof style.shadowAngle === "number" &&
    typeof style.shadowDistance === "number"
  ) {
    // Calculate offsets from angle and distance
    const angleRad = (style.shadowAngle * Math.PI) / 180;
    offsetX = Math.cos(angleRad) * style.shadowDistance;
    offsetY = Math.sin(angleRad) * style.shadowDistance;
  } else {
    // Use direct offsets (legacy path)
    offsetX =
      typeof style.shadowOffsetX === "number" &&
      Number.isFinite(style.shadowOffsetX)
        ? style.shadowOffsetX
        : 4;
    offsetY =
      typeof style.shadowOffsetY === "number" &&
      Number.isFinite(style.shadowOffsetY)
        ? style.shadowOffsetY
        : 4;
  }

  const blur =
    typeof style.shadowBlur === "number" && Number.isFinite(style.shadowBlur)
      ? Math.max(0, style.shadowBlur)
      : 6;
  const opacity =
    typeof style.shadowOpacity === "number" &&
    Number.isFinite(style.shadowOpacity)
      ? clampUnitInterval(style.shadowOpacity)
      : 0.35;
  return `${Math.round(offsetX)}px ${Math.round(offsetY)}px ${Math.round(blur)}px ${colorWithOpacity(
    normalizeHexColor(style.shadowColor, "#000000"),
    opacity,
  )}`;
}

/**
 * Build a CSS `inset` box-shadow string from inner shadow properties on a ShapeStyle.
 * Returns `undefined` if no inner shadow is defined.
 */
export function buildInnerShadowCssFromShapeStyle(
  style: ShapeStyle | undefined,
): string | undefined {
  if (!style?.innerShadowColor || style.innerShadowColor === "transparent") {
    return undefined;
  }
  const offsetX =
    typeof style.innerShadowOffsetX === "number" &&
    Number.isFinite(style.innerShadowOffsetX)
      ? style.innerShadowOffsetX
      : 0;
  const offsetY =
    typeof style.innerShadowOffsetY === "number" &&
    Number.isFinite(style.innerShadowOffsetY)
      ? style.innerShadowOffsetY
      : 0;
  const blur =
    typeof style.innerShadowBlur === "number" &&
    Number.isFinite(style.innerShadowBlur)
      ? Math.max(0, style.innerShadowBlur)
      : 6;
  const opacity =
    typeof style.innerShadowOpacity === "number" &&
    Number.isFinite(style.innerShadowOpacity)
      ? clampUnitInterval(style.innerShadowOpacity)
      : 0.5;
  return `inset ${Math.round(offsetX)}px ${Math.round(offsetY)}px ${Math.round(blur)}px ${colorWithOpacity(
    normalizeHexColor(style.innerShadowColor, "#000000"),
    opacity,
  )}`;
}

/* ------------------------------------------------------------------ */
/*  Multi-layer shadow & glow CSS builders                             */
/* ------------------------------------------------------------------ */

/**
 * Builds CSS `box-shadow` strings for all shadow layers in a ShapeStyle's
 * `shadows` array. PowerPoint supports multiple simultaneous outer shadows
 * (e.g. perspective shadows, or shadow + glow combined in one effect list).
 *
 * Each shadow layer is rendered as a separate comma-separated `box-shadow`
 * value with its own offset, blur, and colour. This is more faithful than
 * the single-shadow `buildShadowCssFromShapeStyle` for presentations that
 * define compound shadow effects.
 *
 * @param style - The shape style containing the `shadows` array.
 * @returns A CSS box-shadow string with all layers, or `undefined` if empty.
 */
export function buildMultiLayerShadowCss(
  style: ShapeStyle | undefined,
): string | undefined {
  if (!style?.shadows || style.shadows.length === 0) return undefined;

  const parts: string[] = [];
  for (const shadow of style.shadows) {
    if (!shadow.color || shadow.color === "transparent") continue;

    const angleRad = ((shadow.angle ?? 0) * Math.PI) / 180;
    const dist = shadow.distance ?? 0;
    const offsetX = Math.round(Math.cos(angleRad) * dist);
    const offsetY = Math.round(Math.sin(angleRad) * dist);
    const blur = Math.round(Math.max(0, shadow.blur ?? 6));
    const opacity = clampUnitInterval(shadow.opacity ?? 0.35);
    const color = colorWithOpacity(
      normalizeHexColor(shadow.color, "#000000"),
      opacity,
    );
    parts.push(`${offsetX}px ${offsetY}px ${blur}px ${color}`);
  }

  return parts.length > 0 ? parts.join(", ") : undefined;
}

/**
 * Builds a high-fidelity CSS `box-shadow` for a glow effect by using
 * multiple layered shadows at increasing blur radii with decreasing
 * opacity. This produces a softer, more diffused glow than a single
 * `drop-shadow` filter and matches PowerPoint's rendering more closely.
 *
 * The glow is rendered as 3 concentric shadow layers:
 * 1. Inner layer: 33% of radius, full opacity
 * 2. Middle layer: 66% of radius, 60% opacity
 * 3. Outer layer: full radius, 30% opacity
 *
 * @param color   - Glow colour (hex).
 * @param radius  - Glow radius in pixels.
 * @param opacity - Glow opacity (0-1).
 * @returns A CSS box-shadow string with layered glow, or `undefined`.
 */
export function buildGlowBoxShadow(
  color: string | undefined,
  radius: number | undefined,
  opacity: number | undefined,
): string | undefined {
  if (!color || color === "transparent" || !radius || radius <= 0) {
    return undefined;
  }

  const baseOpacity = typeof opacity === "number" ? clampUnitInterval(opacity) : 0.75;
  const normalizedColor = normalizeHexColor(color, "#ffff00");

  // Layer 1: tight inner glow
  const r1 = Math.round(radius * 0.33);
  const c1 = colorWithOpacity(normalizedColor, baseOpacity);

  // Layer 2: mid glow
  const r2 = Math.round(radius * 0.66);
  const c2 = colorWithOpacity(normalizedColor, baseOpacity * 0.6);

  // Layer 3: outer diffuse glow
  const r3 = Math.round(radius);
  const c3 = colorWithOpacity(normalizedColor, baseOpacity * 0.3);

  return `0 0 ${r1}px ${c1}, 0 0 ${r2}px ${c2}, 0 0 ${r3}px ${c3}`;
}

/**
 * Builds a CSS reflection string with blur support. PowerPoint reflections
 * include a blur radius that softens the reflected image. We include the
 * blur as part of the `-webkit-box-reflect` gradient mask — the blur
 * effectively reduces the mask sharpness by widening the fade zone.
 *
 * @param distance      - Gap between shape bottom and reflection top, in px.
 * @param startOpacity  - Opacity at the top of the reflection (0-1).
 * @param endOpacity    - Opacity at the bottom of the reflection (0-1).
 * @param fadeLength    - Length of the fade zone in px.
 * @param blurRadius    - Reflection blur radius in px (default 0).
 * @returns A CSS value for `-webkit-box-reflect`, or `undefined`.
 */
export function buildReflectionCss(
  distance: number,
  startOpacity: number,
  endOpacity: number,
  fadeLength: number,
  blurRadius: number = 0,
): string {
  // The blur extends the fade zone — we widen the gradient to compensate
  const effectiveFadeLength = fadeLength + blurRadius * 2;
  // Midpoint opacity accounts for blur diffusion
  const midOpacity = (startOpacity + endOpacity) / 2;
  const midPoint = Math.round(effectiveFadeLength * 0.5);

  if (blurRadius > 0) {
    // Three-stop gradient for a smoother blur-like fade
    return (
      `below ${Math.round(distance)}px linear-gradient(to bottom, ` +
      `rgba(255,255,255,${startOpacity}), ` +
      `rgba(255,255,255,${midOpacity}) ${midPoint}px, ` +
      `rgba(255,255,255,${endOpacity}) ${effectiveFadeLength}px)`
    );
  }

  // Standard two-stop gradient (no blur)
  return `below ${Math.round(distance)}px linear-gradient(to bottom, rgba(255,255,255,${startOpacity}), rgba(255,255,255,${endOpacity}) ${fadeLength}px)`;
}
