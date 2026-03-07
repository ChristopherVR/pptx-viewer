/**
 * OOXML drawing colour transforms — all 26 transform operations.
 *
 * Applies structural, shade/tint, HSL, and direct RGB channel transforms
 * to a base colour as specified in the OOXML spec.
 */

import type { XmlObject } from "../types";
import {
  clampUnitInterval,
  hexToRgbChannels,
  rgbToHsl,
  hslToRgb,
  toHex,
  parseDrawingPercent,
  parseDrawingFraction,
  parseDrawingHueDegrees,
} from "./color-primitives";

// ---------------------------------------------------------------------------
// Colour transforms — all 26 OOXML drawing colour transforms
// ---------------------------------------------------------------------------

/**
 * Apply every OOXML colour transform found on {@link colorNode} to
 * {@link baseColor} and return the resulting `#RRGGBB` hex string.
 *
 * Transform application order:
 *   1. Structural — `comp`, `inv`, `gray`
 *   2. RGB‑space mixing — `shade`, `tint`
 *   3. HSL transforms — `hue`/`hueMod`/`hueOff`, `sat`/`satMod`/`satOff`,
 *      `lum`/`lumMod`/`lumOff`  (single RGB↔HSL round‑trip)
 *   4. Direct RGB channels — `red`/`redMod`/`redOff`, `green`/…, `blue`/…
 */
export function applyDrawingColorTransforms(
  baseColor: string,
  colorNode: XmlObject,
): string {
  const rgb = hexToRgbChannels(baseColor);
  if (!rgb) return baseColor;

  let r = rgb.r;
  let g = rgb.g;
  let b = rgb.b;

  /** Shorthand: read the `@_val` attribute from a child element. */
  const getVal = (key: string): unknown =>
    (colorNode[key] as XmlObject | undefined)?.["@_val"];

  // ── 1. Structural transforms ─────────────────────────────────────────

  if (colorNode["a:comp"] !== undefined) {
    const hsl = rgbToHsl(r, g, b);
    hsl.h = (hsl.h + 180) % 360;
    const out = hslToRgb(hsl.h, hsl.s, hsl.l);
    r = out.r;
    g = out.g;
    b = out.b;
  }

  if (colorNode["a:inv"] !== undefined) {
    r = 255 - r;
    g = 255 - g;
    b = 255 - b;
  }

  if (colorNode["a:gray"] !== undefined) {
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    r = gray;
    g = gray;
    b = gray;
  }

  // ── 2. Shade & tint (RGB‑space mixing with black / white) ────────────

  const shade = parseDrawingPercent(getVal("a:shade"));
  if (shade !== undefined) {
    r *= shade;
    g *= shade;
    b *= shade;
  }

  const tint = parseDrawingPercent(getVal("a:tint"));
  if (tint !== undefined) {
    r = r + (255 - r) * tint;
    g = g + (255 - g) * tint;
    b = b + (255 - b) * tint;
  }

  // ── 3. HSL transforms (single conversion round‑trip) ─────────────────

  const hslKeys = [
    "a:hue",
    "a:hueMod",
    "a:hueOff",
    "a:sat",
    "a:satMod",
    "a:satOff",
    "a:lum",
    "a:lumMod",
    "a:lumOff",
  ];
  const hasHsl = hslKeys.some((k) => colorNode[k] !== undefined);

  if (hasHsl) {
    const hsl = rgbToHsl(r, g, b);

    // Hue ─────────────────────────────────────────────────────────────
    const hueAbs = parseDrawingHueDegrees(getVal("a:hue"));
    if (hueAbs !== undefined) {
      hsl.h = ((hueAbs % 360) + 360) % 360;
    }
    const hueMod = parseDrawingFraction(getVal("a:hueMod"));
    if (hueMod !== undefined) {
      hsl.h = (((hsl.h * hueMod) % 360) + 360) % 360;
    }
    const hueOff = parseDrawingHueDegrees(getVal("a:hueOff"));
    if (hueOff !== undefined) {
      hsl.h = (((hsl.h + hueOff) % 360) + 360) % 360;
    }

    // Saturation ──────────────────────────────────────────────────────
    const satAbs = parseDrawingFraction(getVal("a:sat"));
    if (satAbs !== undefined) {
      hsl.s = clampUnitInterval(satAbs);
    }
    const satMod = parseDrawingFraction(getVal("a:satMod"));
    if (satMod !== undefined) {
      hsl.s = clampUnitInterval(hsl.s * satMod);
    }
    const satOff = parseDrawingFraction(getVal("a:satOff"));
    if (satOff !== undefined) {
      hsl.s = clampUnitInterval(hsl.s + satOff);
    }

    // Luminance ───────────────────────────────────────────────────────
    const lumAbs = parseDrawingFraction(getVal("a:lum"));
    if (lumAbs !== undefined) {
      hsl.l = clampUnitInterval(lumAbs);
    }
    const lumMod = parseDrawingFraction(getVal("a:lumMod"));
    if (lumMod !== undefined) {
      hsl.l = clampUnitInterval(hsl.l * lumMod);
    }
    const lumOff = parseDrawingFraction(getVal("a:lumOff"));
    if (lumOff !== undefined) {
      hsl.l = clampUnitInterval(hsl.l + lumOff);
    }

    const out = hslToRgb(hsl.h, hsl.s, hsl.l);
    r = out.r;
    g = out.g;
    b = out.b;
  }

  // ── 4. Direct RGB channel transforms ─────────────────────────────────

  // Red channel
  const redAbs = parseDrawingFraction(getVal("a:red"));
  if (redAbs !== undefined) {
    r = Math.round(clampUnitInterval(redAbs) * 255);
  }
  const redMod = parseDrawingFraction(getVal("a:redMod"));
  if (redMod !== undefined) {
    r = Math.min(255, Math.max(0, Math.round(r * redMod)));
  }
  const redOff = parseDrawingFraction(getVal("a:redOff"));
  if (redOff !== undefined) {
    r = Math.min(255, Math.max(0, Math.round(r + 255 * redOff)));
  }

  // Green channel
  const greenAbs = parseDrawingFraction(getVal("a:green"));
  if (greenAbs !== undefined) {
    g = Math.round(clampUnitInterval(greenAbs) * 255);
  }
  const greenMod = parseDrawingFraction(getVal("a:greenMod"));
  if (greenMod !== undefined) {
    g = Math.min(255, Math.max(0, Math.round(g * greenMod)));
  }
  const greenOff = parseDrawingFraction(getVal("a:greenOff"));
  if (greenOff !== undefined) {
    g = Math.min(255, Math.max(0, Math.round(g + 255 * greenOff)));
  }

  // Blue channel
  const blueAbs = parseDrawingFraction(getVal("a:blue"));
  if (blueAbs !== undefined) {
    b = Math.round(clampUnitInterval(blueAbs) * 255);
  }
  const blueMod = parseDrawingFraction(getVal("a:blueMod"));
  if (blueMod !== undefined) {
    b = Math.min(255, Math.max(0, Math.round(b * blueMod)));
  }
  const blueOff = parseDrawingFraction(getVal("a:blueOff"));
  if (blueOff !== undefined) {
    b = Math.min(255, Math.max(0, Math.round(b + 255 * blueOff)));
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
