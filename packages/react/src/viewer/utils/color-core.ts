/**
 * Core color utility functions for the PowerPoint viewer/editor.
 */
import type { ShapeStyle } from "pptx-viewer-core";
import { DEFAULT_TEXT_COLOR } from "../constants";

export function createArrayBufferCopy(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

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

export function clampUnitInterval(value: number): number {
  return Math.min(1, Math.max(0, value));
}

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

export function colorWithOpacity(
  color: string,
  opacity: number | undefined,
): string {
  if (opacity === undefined) return color;
  const rgb = hexToRgbChannels(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clampUnitInterval(opacity)})`;
}

export function clampCropValue(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(0.95, value));
}

/* ------------------------------------------------------------------ */
/*  Shadow CSS builders                                                */
/* ------------------------------------------------------------------ */

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
