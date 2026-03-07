import React from "react";

import type { PptxElement } from "../../core";
import {
  hasShapeProperties,
  isImageLikeElement,
} from "../../core";
import { normalizeHexColor, colorWithOpacity } from "./color";

// ── Duotone SVG filter helpers ──────────────────────────────────────────

/** Generate a stable filter ID for a duotone effect on an element. */
export function getDuotoneFilterId(elementId: string): string {
  return `duotone-${elementId}`;
}

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
 * Render an inline SVG `<filter>` element implementing a duotone colour mapping.
 * The filter converts the image to grayscale then remaps luminance from color1 (shadows)
 * to color2 (highlights) using an feComponentTransfer with linear ramps.
 *
 * This must be placed inside an `<svg>` element with `width=0 height=0`
 * so it is invisible but referenceable via CSS `filter: url(#id)`.
 */
export function renderDuotoneSvgFilter(
  elementId: string,
  color1: string,
  color2: string,
): React.ReactNode {
  const filterId = getDuotoneFilterId(elementId);
  const c1 = hexToRgbUnit(color1);
  const c2 = hexToRgbUnit(color2);

  // feColorMatrix values to convert to luminance (standard BT.601 weights)
  const grayscaleMatrix = [
    0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152,
    0.0722, 0, 0, 0, 0, 0, 1, 0,
  ].join(" ");

  return (
    <svg
      width={0}
      height={0}
      style={{ position: "absolute", overflow: "hidden" }}
      aria-hidden="true"
    >
      <defs>
        <filter id={filterId} colorInterpolationFilters="sRGB">
          {/* Step 1: convert to grayscale luminance */}
          <feColorMatrix type="matrix" values={grayscaleMatrix} />
          {/* Step 2: remap luminance 0-1 from color1 to color2 */}
          <feComponentTransfer>
            <feFuncR type="linear" slope={c2.r - c1.r} intercept={c1.r} />
            <feFuncG type="linear" slope={c2.g - c1.g} intercept={c1.g} />
            <feFuncB type="linear" slope={c2.b - c1.b} intercept={c1.b} />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}

/**
 * Check if an element has a duotone image effect that needs an SVG filter definition.
 */
export function hasDuotoneEffect(element: PptxElement): boolean {
  if (!isImageLikeElement(element)) return false;
  return Boolean(element.imageEffects?.duotone);
}

/**
 * Get the duotone colour pair from an element, if present.
 */
export function getDuotoneColors(
  element: PptxElement,
): { color1: string; color2: string } | undefined {
  if (!isImageLikeElement(element)) return undefined;
  return element.imageEffects?.duotone;
}

// ── Line effects CSS helpers ────────────────────────────────────────────

/**
 * Build a CSS box-shadow string for line-level shadow effects (`a:ln/a:effectLst/a:outerShdw`).
 * Returns undefined if no line shadow is defined on the element.
 */
export function buildLineShadowCss(element: PptxElement): string | undefined {
  if (!hasShapeProperties(element)) return undefined;
  const ss = element.shapeStyle;
  if (!ss?.lineShadowColor || ss.lineShadowColor === "transparent")
    return undefined;

  const offsetX =
    typeof ss.lineShadowOffsetX === "number" ? ss.lineShadowOffsetX : 2;
  const offsetY =
    typeof ss.lineShadowOffsetY === "number" ? ss.lineShadowOffsetY : 2;
  const blur =
    typeof ss.lineShadowBlur === "number" ? Math.max(0, ss.lineShadowBlur) : 4;
  const opacity =
    typeof ss.lineShadowOpacity === "number"
      ? Math.max(0, Math.min(1, ss.lineShadowOpacity))
      : 0.35;

  return `${Math.round(offsetX)}px ${Math.round(offsetY)}px ${Math.round(blur)}px ${colorWithOpacity(
    normalizeHexColor(ss.lineShadowColor, "#000000"),
    opacity,
  )}`;
}

/**
 * Build a CSS filter string for line-level glow effects (`a:ln/a:effectLst/a:glow`).
 * Returns undefined if no line glow is defined on the element.
 */
export function buildLineGlowFilter(element: PptxElement): string | undefined {
  if (!hasShapeProperties(element)) return undefined;
  const ss = element.shapeStyle;
  if (
    !ss?.lineGlowColor ||
    ss.lineGlowColor === "transparent" ||
    !ss.lineGlowRadius
  )
    return undefined;

  const glowOpacity =
    typeof ss.lineGlowOpacity === "number" ? ss.lineGlowOpacity : 0.75;
  const glowRad = Math.round(Math.max(0, ss.lineGlowRadius));
  const glowCol = colorWithOpacity(
    normalizeHexColor(ss.lineGlowColor, "#ffff00"),
    glowOpacity,
  );
  return `drop-shadow(0 0 ${glowRad}px ${glowCol})`;
}

// ── DAG effect helpers ──────────────────────────────────────────────────

/** Map OOXML blend mode attribute to CSS mix-blend-mode value. */
export function mapDagBlendModeToCss(
  blend: "over" | "mult" | "screen" | "darken" | "lighten" | undefined,
): React.CSSProperties["mixBlendMode"] {
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
    default:
      return undefined;
  }
}

/** Generate a stable filter ID for a DAG duotone effect on an element. */
export function getDagDuotoneFilterId(elementId: string): string {
  return `dag-duotone-${elementId}`;
}

/** Check if an element has a DAG-based duotone effect that needs an SVG filter. */
export function hasDagDuotoneEffect(element: PptxElement): boolean {
  if (!hasShapeProperties(element)) return false;
  return Boolean(element.shapeStyle?.dagDuotone);
}

/**
 * Render an inline SVG `<filter>` for a DAG duotone effect.
 * Works identically to the image duotone filter but keyed by the DAG filter ID.
 */
export function renderDagDuotoneSvgFilter(
  elementId: string,
  color1: string,
  color2: string,
): React.ReactNode {
  const filterId = getDagDuotoneFilterId(elementId);
  const c1 = hexToRgbUnit(color1);
  const c2 = hexToRgbUnit(color2);

  const grayscaleMatrix = [
    0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152,
    0.0722, 0, 0, 0, 0, 0, 1, 0,
  ].join(" ");

  return (
    <svg
      width={0}
      height={0}
      style={{ position: "absolute", overflow: "hidden" }}
      aria-hidden="true"
    >
      <defs>
        <filter id={filterId} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={grayscaleMatrix} />
          <feComponentTransfer>
            <feFuncR type="linear" slope={c2.r - c1.r} intercept={c1.r} />
            <feFuncG type="linear" slope={c2.g - c1.g} intercept={c1.g} />
            <feFuncB type="linear" slope={c2.b - c1.b} intercept={c1.b} />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}
