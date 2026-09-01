import { getShapeType } from '../geometry/shape-geometry';
import type { PptxCropShape, PptxImageLikeElement } from '../types';
import { xmlAttr, xmlChild } from './xml-access';

/**
 * The single mapping between a picture's `a:prstGeom/@prst` and the typed
 * {@link PptxCropShape} view the bindings expose as "Crop to Shape".
 *
 * PowerPoint has no dedicated crop-shape markup: cropping a picture to a shape
 * simply rewrites the `p:pic`'s own preset geometry. So `cropShape` is derived
 * from the preset on load and, when the user changes it, drives the preset on
 * save. Everything else about the geometry (`shapeType`, adjustments, custom
 * paths) stays the source of truth.
 *
 * Presets `getShapeType` understands are compared through it (so `oval` and
 * capitalised spellings land on `ellipse`); the ones it folds to `rect`
 * (`pentagon`, `hexagon`, `star5`) are matched on the lower-cased preset.
 */

/** Preset written for each crop shape. `'none'` writes nothing. */
const CROP_SHAPE_PRESET: Readonly<Record<Exclude<PptxCropShape, 'none'>, string>> = {
	ellipse: 'ellipse',
	roundedRect: 'roundRect',
	triangle: 'triangle',
	diamond: 'diamond',
	pentagon: 'pentagon',
	hexagon: 'hexagon',
	star: 'star5',
};

/** Lower-cased presets that `getShapeType` cannot distinguish from `rect`. */
const RECT_FOLDED_PRESETS: Readonly<Record<string, PptxCropShape>> = {
	pentagon: 'pentagon',
	hexagon: 'hexagon',
};

/**
 * Crop shape a picture's preset geometry expresses.
 * @returns The matching crop shape, or `undefined` when the preset is `rect`,
 * absent, or a shape the crop gallery does not offer.
 */
export function cropShapeForPresetGeometry(preset: string | undefined): PptxCropShape | undefined {
	if (!preset) {
		return undefined;
	}
	switch (getShapeType(preset)) {
		case 'ellipse':
			return 'ellipse';
		case 'roundRect':
			return 'roundedRect';
		case 'triangle':
			return 'triangle';
		case 'diamond':
			return 'diamond';
		default:
			break;
	}
	const lower = preset.trim().toLowerCase();
	if (lower in RECT_FOLDED_PRESETS) {
		return RECT_FOLDED_PRESETS[lower];
	}
	// Any star preset (`star4`, `star5`, `star6`, ...) is "star" in the gallery.
	return /^star\d+$/.test(lower) ? 'star' : undefined;
}

/**
 * Preset geometry to write for a crop shape.
 * @returns The `a:prstGeom/@prst` value, or `undefined` for `'none'`/absent.
 */
export function presetGeometryForCropShape(
	cropShape: PptxCropShape | undefined,
): string | undefined {
	if (!cropShape || cropShape === 'none') {
		return undefined;
	}
	return CROP_SHAPE_PRESET[cropShape];
}

/** The preset the picture was loaded with, from its retained `p:spPr`. */
export function pictureRetainedPresetGeometry(element: PptxImageLikeElement): string | undefined {
	const spPr = xmlChild(element.rawXml, 'p:spPr');
	return xmlAttr(xmlChild(spPr, 'a:prstGeom'), 'prst');
}

/**
 * Bring `element.shapeType` in line with a changed `cropShape` before the
 * geometry is written.
 *
 * The save path writes `a:prstGeom/@prst` from `shapeType`, so a crop chosen in
 * the inspector has to land there. But `cropShape` is ALSO derived from the
 * preset on load, so a picture loaded as an ellipse carries `cropShape:
 * 'ellipse'` forever; if the user then changes `shapeType` directly, the stale
 * crop must not drag it back. The rule is therefore: rewrite `shapeType` only
 * when `cropShape` differs from what the picture's PREVIOUS preset (the
 * baseline, read from `rawXml` unless given) expressed, i.e. when the crop
 * itself changed.
 *
 * Custom geometry is never touched: a crop shape cannot be expressed on top of
 * `a:custGeom`, and clobbering the paths would lose the drawing.
 *
 * @returns `true` when `shapeType` was rewritten.
 */
export function syncPictureShapeTypeWithCropShape(
	element: PptxImageLikeElement,
	baselinePreset: string | undefined = pictureRetainedPresetGeometry(element),
): boolean {
	const preset = presetGeometryForCropShape(element.cropShape);
	if (preset === undefined) {
		return false;
	}
	if (element.customGeometryPaths && element.customGeometryPaths.length > 0) {
		return false;
	}
	if (cropShapeForPresetGeometry(element.shapeType) === element.cropShape) {
		return false;
	}
	if (cropShapeForPresetGeometry(baselinePreset) === element.cropShape) {
		return false;
	}
	element.shapeType = preset;
	// Adjustments belong to the previous preset; the crop shape uses defaults.
	delete element.shapeAdjustments;
	return true;
}
