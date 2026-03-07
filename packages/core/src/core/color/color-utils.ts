/**
 * Framework-agnostic colour utilities for the PPTX editor.
 *
 * Primitives (hex/rgb, HSL, clamping) live in `./color-primitives.ts`;
 * transforms live in `./color-transforms.ts`.
 * This file provides the high-level colour-parsing API and re-exports
 * everything for backward compatibility.
 */
import type { XmlObject } from "../types";
import {
  DEFAULT_SCHEME_COLOR_MAP,
  PRESET_COLOR_MAP,
  SYSTEM_COLOR_MAP,
} from "../constants";
import {
  clampUnitInterval,
  parseDrawingPercent,
  parseDrawingHueDegrees,
  toHex,
  hslToRgb,
} from "./color-primitives";
import { applyDrawingColorTransforms } from "./color-transforms";

// Re-export primitives and transforms for backward compatibility.
export {
  clampUnitInterval,
  normalizeHexColor,
  hexToRgbChannels,
  colorWithOpacity,
  parseDrawingPercent,
  parseDrawingFraction,
  parseDrawingHueDegrees,
  rgbToHsl,
  hslToRgb,
  toHex,
} from "./color-primitives";
export type { HslColor } from "./color-primitives";
export { applyDrawingColorTransforms } from "./color-transforms";

// ---------------------------------------------------------------------------
// High-level colour parsing from OpenXML colour-choice nodes
// ---------------------------------------------------------------------------

export function parseDrawingColorChoice(
  colorNode: XmlObject | undefined,
): string | undefined {
  if (!colorNode) return undefined;

  if (colorNode["a:scrgbClr"]) {
    const scrgb = colorNode["a:scrgbClr"] as XmlObject;
    const red = parseDrawingPercent(scrgb["@_r"]);
    const green = parseDrawingPercent(scrgb["@_g"]);
    const blue = parseDrawingPercent(scrgb["@_b"]);
    if (red !== undefined && green !== undefined && blue !== undefined) {
      const base = `#${toHex(red * 255)}${toHex(green * 255)}${toHex(blue * 255)}`;
      return applyDrawingColorTransforms(base, scrgb);
    }
  }

  if (colorNode["a:srgbClr"]) {
    const srgb = colorNode["a:srgbClr"] as XmlObject;
    const value = String(srgb["@_val"] || "").trim();
    if (/^[0-9a-fA-F]{6}$/.test(value)) {
      return applyDrawingColorTransforms(`#${value.toUpperCase()}`, srgb);
    }
  }

  if (colorNode["a:sysClr"]) {
    const systemColor = colorNode["a:sysClr"] as XmlObject;
    const lastColor = String(systemColor["@_lastClr"] || "").trim();
    if (/^[0-9a-fA-F]{6}$/.test(lastColor)) {
      return applyDrawingColorTransforms(
        `#${lastColor.toUpperCase()}`,
        systemColor,
      );
    }
    // Fallback: resolve @_val system color name
    const sysVal = String(systemColor["@_val"] || "").trim();
    if (sysVal) {
      const mapped = SYSTEM_COLOR_MAP[sysVal];
      if (mapped) {
        return applyDrawingColorTransforms(mapped, systemColor);
      }
    }
  }

  if (colorNode["a:schemeClr"]) {
    const schemeColor = colorNode["a:schemeClr"] as XmlObject;
    const schemeValue = String(schemeColor["@_val"] || "")
      .trim()
      .toLowerCase();
    if (!schemeValue) return undefined;
    const base = DEFAULT_SCHEME_COLOR_MAP[schemeValue];
    if (!base) return undefined;
    return applyDrawingColorTransforms(base, schemeColor);
  }

  // OOXML_PARITY: a:hslClr now supported
  if (colorNode["a:hslClr"]) {
    const hslNode = colorNode["a:hslClr"] as XmlObject;
    const hue = parseDrawingHueDegrees(hslNode["@_hue"]);
    const sat = parseDrawingPercent(hslNode["@_sat"]);
    const lum = parseDrawingPercent(hslNode["@_lum"]);
    if (hue !== undefined && sat !== undefined && lum !== undefined) {
      const rgb = hslToRgb(hue, sat, lum);
      const base = `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
      return applyDrawingColorTransforms(base, hslNode);
    }
  }

  if (colorNode["a:prstClr"]) {
    const preset = String(
      (colorNode["a:prstClr"] as XmlObject | undefined)?.["@_val"] || "",
    ).toLowerCase();
    const mapped = PRESET_COLOR_MAP[preset];
    if (!mapped) return undefined;
    return applyDrawingColorTransforms(
      mapped,
      colorNode["a:prstClr"] as XmlObject,
    );
  }

  return undefined;
}

export function parseDrawingColor(
  colorNode: XmlObject | undefined,
): string | undefined {
  if (!colorNode) return undefined;
  const direct = parseDrawingColorChoice(colorNode);
  if (direct) return direct;
  if (colorNode["a:solidFill"]) {
    return parseDrawingColorChoice(colorNode["a:solidFill"] as XmlObject);
  }
  return undefined;
}

export function parseDrawingColorOpacity(
  colorNode: XmlObject | undefined,
): number | undefined {
  if (!colorNode) return undefined;
  const colorChoice =
    (colorNode["a:scrgbClr"] as XmlObject | undefined) ||
    (colorNode["a:srgbClr"] as XmlObject | undefined) ||
    (colorNode["a:schemeClr"] as XmlObject | undefined) ||
    (colorNode["a:hslClr"] as XmlObject | undefined) ||
    (colorNode["a:prstClr"] as XmlObject | undefined) ||
    (colorNode["a:sysClr"] as XmlObject | undefined);
  if (!colorChoice) return undefined;

  const alpha = parseDrawingPercent(
    (colorChoice["a:alpha"] as XmlObject | undefined)?.["@_val"],
  );
  const alphaMod = parseDrawingPercent(
    (colorChoice["a:alphaMod"] as XmlObject | undefined)?.["@_val"],
  );
  const alphaOff = parseDrawingPercent(
    (colorChoice["a:alphaOff"] as XmlObject | undefined)?.["@_val"],
  );
  if (alpha === undefined && alphaMod === undefined && alphaOff === undefined) {
    return undefined;
  }

  let opacity = alpha ?? 1;
  if (alphaMod !== undefined) {
    opacity *= alphaMod;
  }
  if (alphaOff !== undefined) {
    opacity += alphaOff;
  }
  return clampUnitInterval(opacity);
}
