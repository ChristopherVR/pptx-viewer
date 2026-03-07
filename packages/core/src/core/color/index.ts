/**
 * Barrel export for the colour module.
 *
 * Re-exports all public colour primitives, transforms, and high-level
 * OOXML colour-parsing utilities from their respective sub-modules.
 *
 * @module color
 */
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
  applyDrawingColorTransforms,
  parseDrawingColorChoice,
  parseDrawingColor,
  parseDrawingColorOpacity,
} from "./color-utils";

export type { HslColor } from "./color-utils";
