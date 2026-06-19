/**
 * Gradient fill CSS builders.
 *
 * Thin re-export shim. The implementation now lives in the framework-agnostic
 * `pptx-viewer-shared` package (`render/fill-style.ts`), vendored into this
 * library via `../internal/shared`. This file preserves the historical
 * `./color-gradient` import surface so existing consumers and colocated tests
 * keep importing the same symbols unchanged.
 *
 * Gradient rendering follows ECMA-376 Part 1, §20.1.8.35 (gradFill) and
 * §20.1.8.49 (pathFill).
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
} from '../internal/shared';
