import type { SupportedShapeType } from '../constants';
/**
 * Framework-agnostic shape geometry utilities.
 *
 * Maps OpenXML preset geometry names to supported shape types,
 * generates CSS clip-paths, and calculates round-rect radii.
 */
import type { PptxElementWithShapeStyle } from '../types';
import { getAdjustmentAwareClipPath } from './adjustment-aware-shapes';
import { getCloudCalloutClipPath, getCloudClipPath } from './cloud-bezier-paths';
import { evaluatePresetShape } from './preset-shape-evaluator';
import { PRESET_SHAPE_CLIP_PATHS, getPresetShapeClipPath } from './preset-shape-paths';

// ---------------------------------------------------------------------------
// Shape type mapping
// ---------------------------------------------------------------------------

/**
 * Map an OpenXML preset geometry name to a supported internal shape type.
 *
 * Unknown shapes that have a known clip-path in the preset library are
 * mapped to `"rect"` so clip-path rendering handles their visual appearance.
 *
 * @param shapeType - The OpenXML `prst` attribute value (e.g. `"roundRect"`, `"ellipse"`).
 * @returns The normalised {@link SupportedShapeType} to use for rendering.
 */
export function getShapeType(shapeType: string | undefined): SupportedShapeType {
	if (!shapeType) {
		return 'rect';
	}
	const normalized = shapeType.toLowerCase();
	if (normalized === 'rect') {
		return 'rect';
	}
	if (normalized === 'roundrect') {
		return 'roundRect';
	}
	if (normalized === 'ellipse' || normalized === 'oval') {
		return 'ellipse';
	}
	if (normalized === 'cylinder' || normalized === 'can') {
		return 'cylinder';
	}
	if (normalized === 'triangle') {
		return 'triangle';
	}
	if (normalized === 'diamond') {
		return 'diamond';
	}
	if (normalized === 'line' || normalized === 'lineinv') {
		return 'line';
	}
	if (normalized === 'rtarrow' || normalized === 'rightarrow') {
		return 'rtArrow';
	}
	if (normalized === 'leftarrow') {
		return 'leftArrow';
	}
	if (normalized === 'uparrow') {
		return 'upArrow';
	}
	if (normalized === 'downarrow') {
		return 'downArrow';
	}
	if (normalized.includes('connector')) {
		return 'connector';
	}
	// If the shape has a known clip-path in the preset library, treat it as a rect
	// (clip-path rendering will handle the visual appearance)
	if (PRESET_SHAPE_CLIP_PATHS[normalized] !== undefined) {
		return 'rect';
	}
	return 'rect';
}

// ---------------------------------------------------------------------------
// CSS clip-path for shapes — delegates to comprehensive preset library
// ---------------------------------------------------------------------------

/**
 * Retrieve the CSS `clip-path` value for a given OpenXML preset geometry name.
 *
 * Delegates to the comprehensive preset library. Returns `undefined` when
 * the shape does not require clipping (e.g. plain rectangles) or when the
 * shape requires more complex SVG rendering.
 *
 * @param shapeType - The OpenXML preset geometry name.
 * @returns A CSS `clip-path` string, or `undefined` if no clipping is needed.
 */
export function getShapeClipPath(shapeType: string | undefined): string | undefined {
	return getPresetShapeClipPath(shapeType);
}

/**
 * Like {@link getShapeClipPath} but consults the adjustment-aware table
 * first. Falls back to the static preset clip-path when the shape isn't
 * in the adjustment-aware table or no adjustments are supplied.
 *
 * Use this entry point from renderers that have access to the element's
 * `shapeAdjustments` and dimensions; the result varies with adjustments
 * for shapes like `pie`, `donut`, `wedgeRectCallout`, etc.
 *
 * @param shapeType   The OOXML preset geometry name.
 * @param width       Element width in pixels.
 * @param height      Element height in pixels.
 * @param adjustments Optional adjustment record (`adj`, `adj1`, `adj2`, …).
 * @returns A CSS `clip-path` value, or `undefined` if no clipping is needed.
 */
export function getAdjustmentAwareShapeClipPath(
	shapeType: string | undefined,
	width: number,
	height: number,
	adjustments?: Record<string, number>,
): string | undefined {
	if (!shapeType) {
		return undefined;
	}
	const dynamic = getAdjustmentAwareClipPath(shapeType, width, height, adjustments);
	if (dynamic !== undefined) {
		return dynamic;
	}
	return getPresetShapeClipPath(shapeType);
}

/**
 * Return a high-DPI cubic-Bezier `clip-path: path('…')` expression for
 * `cloud` / `cloudCallout` shapes when actual pixel dimensions are known.
 *
 * Static polygon entries in {@link PRESET_SHAPE_CLIP_PATHS} remain the
 * lookup-table fallback for non-renderer consumers (e.g. shape pickers,
 * SSR previews) that don't yet know the element's pixel size. Renderers
 * that have measured the element should prefer this helper -- it produces
 * smooth Bezier lobes that stay sharp at any DPI / zoom.
 *
 * @param shapeType - The OOXML preset geometry name. Case-insensitive.
 * @param width - Element width in pixels (must be > 0).
 * @param height - Element height in pixels (must be > 0).
 * @returns A CSS `path('M…Z')` expression for cloud/cloudCallout, or
 *          `undefined` for any other shape (callers should fall back to
 *          {@link getShapeClipPath}).
 */
export function getCloudPathForRendering(
	shapeType: string | undefined,
	width: number,
	height: number,
): string | undefined {
	if (!shapeType) {
		return undefined;
	}
	const normalized = shapeType.toLowerCase();
	if (normalized === 'cloud') {
		return getCloudClipPath(width, height);
	}
	if (normalized === 'cloudcallout') {
		return getCloudCalloutClipPath(width, height);
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// Spec-correct preset clip-path (ECMA-376 pathLst evaluator)
// ---------------------------------------------------------------------------

/**
 * Build a CSS `clip-path: path('…')` expression from the spec-correct ECMA-376
 * preset shape evaluator. This consults
 * {@link evaluatePresetShape} (which evaluates the preset's `gdLst` formulas
 * against the shape dimensions and any `shapeAdjustments`) and wraps the
 * resulting SVG path data in `path(...)` so it can be used as a CSS
 * `clip-path`.
 *
 * The legacy {@link getShapeClipPath} / {@link getAdjustmentAwareShapeClipPath}
 * helpers — which read from the static polygon table — remain in place and
 * are still the preferred fallback for any shape this evaluator does not
 * yet cover. Callers that want spec-correct, formula-driven geometry should
 * try this helper first and fall through to the static helpers when it
 * returns `undefined`.
 *
 * @param shapeType   The OOXML preset geometry name (e.g. `"roundRect"`).
 *                    Lookup is case-sensitive but tolerant of common casings.
 * @param width       Element width in pixels (must be > 0 to produce a
 *                    meaningful path).
 * @param height      Element height in pixels.
 * @param adjustments Optional adjustment record from `shapeAdjustments`.
 * @returns A CSS `clip-path` value (e.g. `path('M 0 0 …')`), or `undefined`
 *          when the shape isn't in the populated preset table or the
 *          evaluation produced no path commands.
 */
export function getShapeClipPathFromPreset(
	shapeType: string | undefined,
	width: number,
	height: number,
	adjustments?: Record<string, number>,
): string | undefined {
	if (!shapeType) {
		return undefined;
	}
	const result = evaluatePresetShape(shapeType, width, height, adjustments);
	if (!result || result.svgPath === '') {
		return undefined;
	}
	// Single-quoted form is the most widely supported in CSS clip-path: path().
	// Escape backslashes first, then single quotes, defensively (neither is
	// produced today). Order matters: backslash is the CSS escape character,
	// so an unescaped backslash immediately preceding a quote would absorb
	// the escaping backslash inserted below, leaving that quote unescaped
	// and able to terminate the `path('...')` string early.
	const escaped = result.svgPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
	return `path('${escaped}')`;
}

// ---------------------------------------------------------------------------
// Round-rect radius
// ---------------------------------------------------------------------------

/**
 * Calculate the border-radius in pixels for a rounded-rectangle shape.
 *
 * The OOXML `adj` value ranges from 0 to 50000 (representing 0% to 100%
 * of the maximum possible radius). The maximum radius is half the shorter
 * side of the element. If no adjustment is specified, the default OOXML
 * value of 16667/50000 (~1/3) is used.
 *
 * @param element - The element whose dimensions and `shapeAdjustments.adj` are read.
 * @returns The border-radius in pixels.
 */
export function getRoundRectRadiusPx(element: PptxElementWithShapeStyle): number {
	const adjustment = element.shapeAdjustments?.adj;
	// Normalize the adjustment: clamp to [0, 50000] then scale to [0, 1].
	// Default OOXML rounded-rect adjustment is 16667 (~1/3 of 50000).
	const normalizedAdjustment =
		typeof adjustment === 'number' && Number.isFinite(adjustment)
			? Math.min(Math.max(adjustment, 0), 50000) / 50000
			: 16667 / 50000;
	// Radius = half the shorter side * normalized adjustment factor
	return (
		Math.min(Math.max(element.width, 1), Math.max(element.height, 1)) * 0.5 * normalizedAdjustment
	);
}

// ---------------------------------------------------------------------------
// Image mask style (shape-based clipping for images)
// ---------------------------------------------------------------------------

/**
 * CSS properties to apply shape-based clipping to an image element.
 * Exactly one of `borderRadius` or `clipPath` will be set, depending
 * on whether the shape is best expressed via border-radius or clip-path.
 */
export interface ImageMaskStyle {
	/** CSS `border-radius` value (number in px or string like `"9999px"`). */
	borderRadius?: string | number;
	/** CSS `clip-path` value (e.g. a `polygon(...)` expression). */
	clipPath?: string;
}

/**
 * Determine the CSS mask style to apply shape-based clipping to an image.
 *
 * Rounded rectangles and similar variants use `border-radius`, ellipses
 * and cylinders use predefined border-radius strings, and all other
 * shapes delegate to the preset clip-path library.
 *
 * @param element - The element whose `shapeType` and dimensions are inspected.
 * @returns An {@link ImageMaskStyle} with either `borderRadius` or `clipPath`,
 *          or `undefined` if no masking is needed.
 */
export function getImageMaskStyle(element: PptxElementWithShapeStyle): ImageMaskStyle | undefined {
	const shapeType = element.shapeType;
	if (!shapeType) {
		return undefined;
	}
	const normalized = shapeType.toLowerCase();

	if (
		normalized === 'roundrect' ||
		normalized === 'round1rect' ||
		normalized === 'round2samerect' ||
		normalized === 'round2diagrect' ||
		normalized === 'sniproundrect' ||
		normalized === 'snip1rect' ||
		normalized === 'snip2diagrect'
	) {
		const radiusPx = getRoundRectRadiusPx(element);
		if (radiusPx <= 0.01) {
			return undefined;
		}
		return { borderRadius: radiusPx };
	}

	if (normalized === 'ellipse' || normalized === 'oval') {
		return { borderRadius: '9999px' };
	}
	if (normalized === 'can' || normalized === 'cylinder') {
		return { borderRadius: '48% / 12%' };
	}

	const clipPath = getShapeClipPath(shapeType);
	if (!clipPath) {
		return undefined;
	}
	return { clipPath };
}
