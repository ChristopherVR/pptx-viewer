/**
 * Color, gradient, and pattern utility functions for the PowerPoint viewer/editor.
 *
 * This barrel re-exports everything from the split sub-modules so existing
 * import paths (`./color`) continue to work unchanged.
 */
export {
  createArrayBufferCopy,
  normalizeHexColor,
  clampUnitInterval,
  hexToRgbChannels,
  colorWithOpacity,
  clampCropValue,
  buildShadowCssFromShapeStyle,
  buildInnerShadowCssFromShapeStyle,
} from "./color-core";

export {
  sanitizeGradientStops,
  toCssGradientStop,
  buildCssGradientFromShapeStyle,
  buildRectPathGradient,
  buildShapePathGradient,
  buildPatternFillCss,
  OOXML_PATTERN_PRESETS,
  type OoxmlPatternPreset,
} from "./color-gradient";

export { getPatternSvg } from "./color-patterns";
