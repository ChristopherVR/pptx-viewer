/**
 * Gradient + pattern fill CSS builders.
 *
 * Thin re-export shim. The implementation now lives in the framework-agnostic
 * `pptx-viewer-shared` package (`render/fill-style.ts`), consumed identically
 * by the React, Vue, and Angular bindings. This file preserves the historical
 * `./color-gradient` import surface so existing consumers and colocated tests
 * keep importing the same symbols unchanged.
 *
 * Gradient rendering follows ECMA-376 Part 1, §20.1.8.35 (gradFill) and
 * §20.1.8.49 (pathFill). Pattern presets follow §20.1.10.33 (ST_PresetPatternVal).
 */
export {
	sanitizeGradientStops,
	convertOoxmlAngleToCss,
	toCssGradientStop,
	computeGradientCenter,
	buildCirclePathGradient,
	buildRectPathGradient,
	buildShapePathGradient,
	buildCssGradientFromShapeStyle,
	buildPatternFillCss,
	getGradientTileFlipCss,
	buildReflectedGradientStops,
	OOXML_PATTERN_PRESETS,
	type OoxmlPatternPreset,
	type GradientTileFlipMode,
} from 'pptx-viewer-shared';
