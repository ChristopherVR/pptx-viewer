/**
 * crop-shape-clip.ts: the CSS `clip-path` for a picture's "Crop to Shape"
 * (`element.cropShape`).
 *
 * React (`viewer/utils/image-style.ts`) and Angular
 * (`viewer/image-renderer-helpers.ts`) each hand-rolled this: React with a
 * small fixed `CROP_SHAPE_CLIP_PATHS` polygon table (7 shapes, straight-line
 * polygons only, so `roundedRect` degraded to a fixed 12% corner radius and
 * `star` degraded to a 10-point outline instead of the real 5-point star
 * preset), Angular by routing through {@link getResolvedShapeClipPathFor}
 * (this module's own dependency), which reuses the full adjustment-aware
 * preset cascade and therefore renders every crop shape PowerPoint's gallery
 * offers, correctly. Vue, Svelte and Vanilla had no crop-to-shape support at
 * all. This module promotes Angular's approach (the more correct of the two)
 * so all five bindings share one implementation.
 *
 * Framework-agnostic: no React, Vue, Angular, Svelte or DOM imports.
 */
import { getResolvedShapeClipPathFor } from './shape-geometry';

/**
 * `element.cropShape` values that don't match a preset geometry name
 * directly. Mirrors the mapping Angular's `getImageCropShapeClipPath` used:
 * `roundedRect` is the crop-gallery's name for the `roundRect` preset, and
 * `star` is its name for the 5-point `star5` preset.
 */
const CROP_SHAPE_ALIASES: Readonly<Record<string, string>> = {
	roundedRect: 'roundRect',
	star: 'star5',
};

/**
 * The CSS `clip-path` value for a "Crop to Shape" picture, or `undefined`
 * when the picture has no crop shape (`cropShape` unset or `'none'`).
 *
 * @param cropShape `element.cropShape` from an image/picture element.
 * @param width     Element width in pixels.
 * @param height    Element height in pixels.
 */
export function getCropShapeClipPath(
	cropShape: string | undefined,
	width: number,
	height: number,
): string | undefined {
	if (!cropShape || cropShape === 'none') {
		return undefined;
	}
	const presetName = CROP_SHAPE_ALIASES[cropShape] ?? cropShape;
	return getResolvedShapeClipPathFor(presetName, width, height);
}
