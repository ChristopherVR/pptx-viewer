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

/**
 * Parse an OOXML colour-choice group node and resolve it to a
 * `#RRGGBB` hex string. Supports all six OOXML colour-choice types:
 *
 * - `a:scrgbClr`  — ScRGB (percentage-based RGB channels)
 * - `a:srgbClr`   — sRGB (6-digit hex)
 * - `a:sysClr`    — Windows system colour (with `lastClr` fallback)
 * - `a:schemeClr`  — Theme scheme colour reference
 * - `a:hslClr`    — HSL colour specification
 * - `a:prstClr`   — Named preset colour (e.g. "red", "cornflowerBlue")
 *
 * After resolving the base colour, any child colour transforms
 * (shade, tint, lumMod, etc.) are applied via {@link applyDrawingColorTransforms}.
 *
 * @param colorNode - The XML node containing a colour-choice child element.
 * @returns The resolved `#RRGGBB` hex colour string, or `undefined` if parsing fails.
 */
export function parseDrawingColorChoice(
  colorNode: XmlObject | undefined,
): string | undefined {
  if (!colorNode) return undefined;

  // ScRGB: percentage-based red/green/blue (each 0-100000 = 0-100%)
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

  // sRGB: standard 6-digit hex colour
  if (colorNode["a:srgbClr"]) {
    const srgb = colorNode["a:srgbClr"] as XmlObject;
    const value = String(srgb["@_val"] || "").trim();
    // Validate exactly 6 hex digits
    if (/^[0-9a-fA-F]{6}$/.test(value)) {
      return applyDrawingColorTransforms(`#${value.toUpperCase()}`, srgb);
    }
  }

  // System colour: uses @_lastClr (cached resolved value) first,
  // then falls back to resolving the @_val system colour name
  if (colorNode["a:sysClr"]) {
    const systemColor = colorNode["a:sysClr"] as XmlObject;
    const lastColor = String(systemColor["@_lastClr"] || "").trim();
    if (/^[0-9a-fA-F]{6}$/.test(lastColor)) {
      return applyDrawingColorTransforms(
        `#${lastColor.toUpperCase()}`,
        systemColor,
      );
    }
    // Fallback: resolve @_val system color name via the lookup table
    const sysVal = String(systemColor["@_val"] || "").trim();
    if (sysVal) {
      const mapped = SYSTEM_COLOR_MAP[sysVal];
      if (mapped) {
        return applyDrawingColorTransforms(mapped, systemColor);
      }
    }
  }

  // Scheme colour: references a named slot from the theme colour scheme
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

  // HSL colour: hue (60000ths of degree), saturation and luminance (percentages)
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

  // Preset colour: named CSS/OOXML colour (e.g. "red", "cornflowerBlue")
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

/**
 * Parse a drawing colour from an XML node, checking both direct
 * colour-choice children and an `a:solidFill` wrapper.
 *
 * This is the primary colour-parsing entry point for most OOXML
 * elements (shapes, lines, text runs) where the colour may be
 * specified either directly or inside a solid fill.
 *
 * @param colorNode - The XML node that may contain colour information.
 * @returns The resolved `#RRGGBB` hex colour string, or `undefined`.
 */
export function parseDrawingColor(
  colorNode: XmlObject | undefined,
): string | undefined {
  if (!colorNode) return undefined;
  // Try direct colour-choice first (e.g. a:srgbClr at the same level)
  const direct = parseDrawingColorChoice(colorNode);
  if (direct) return direct;
  // Fall back to checking inside an a:solidFill wrapper
  if (colorNode["a:solidFill"]) {
    return parseDrawingColorChoice(colorNode["a:solidFill"] as XmlObject);
  }
  return undefined;
}

/**
 * Extract the opacity (alpha) value from an OOXML colour node.
 *
 * Checks all six colour-choice types for `a:alpha`, `a:alphaMod`,
 * and `a:alphaOff` child elements, and combines them:
 *   - `alpha` sets the base opacity (default 1.0 if absent)
 *   - `alphaMod` multiplies the opacity
 *   - `alphaOff` adds an offset to the opacity
 *
 * @param colorNode - The XML node containing a colour-choice child.
 * @returns Opacity in [0, 1], or `undefined` if no alpha attributes are present.
 */
export function parseDrawingColorOpacity(
  colorNode: XmlObject | undefined,
): number | undefined {
  if (!colorNode) return undefined;

  // Find whichever colour-choice type is present
  const colorChoice =
    (colorNode["a:scrgbClr"] as XmlObject | undefined) ||
    (colorNode["a:srgbClr"] as XmlObject | undefined) ||
    (colorNode["a:schemeClr"] as XmlObject | undefined) ||
    (colorNode["a:hslClr"] as XmlObject | undefined) ||
    (colorNode["a:prstClr"] as XmlObject | undefined) ||
    (colorNode["a:sysClr"] as XmlObject | undefined);
  if (!colorChoice) return undefined;

  // Parse the three alpha-related transform values
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

  // Combine: start with absolute alpha (or 1.0), multiply by mod, add offset
  let opacity = alpha ?? 1;
  if (alphaMod !== undefined) {
    opacity *= alphaMod;
  }
  if (alphaOff !== undefined) {
    opacity += alphaOff;
  }
  return clampUnitInterval(opacity);
}
