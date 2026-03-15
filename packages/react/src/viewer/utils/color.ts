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
  buildMultiLayerShadowCss,
  buildGlowBoxShadow,
  buildReflectionCss,
} from "./color-core";

export {
  sanitizeGradientStops,
  toCssGradientStop,
  convertOoxmlAngleToCss,
  buildCssGradientFromShapeStyle,
  buildRectPathGradient,
  buildShapePathGradient,
  buildPatternFillCss,
  getGradientTileFlipCss,
  buildReflectedGradientStops,
  OOXML_PATTERN_PRESETS,
  type OoxmlPatternPreset,
  type GradientTileFlipMode,
} from "./color-gradient";

export { getPatternSvg } from "./color-patterns";
