/**
 * Paragraph bullet / list-marker helpers for the Angular text renderer.
 *
 * Thin re-export shim: the implementations live in `pptx-viewer-shared`
 * (`render/bullet-autonum.ts` for romanNumeral / alphaLabel / formatAutoNumber,
 * `render/bullet-list.ts` for resolveParagraphBullet / bulletIndentPx). This
 * module preserves the local import path (`./text-bullets`) that Angular
 * consumers already use, re-exporting the shared symbols unchanged.
 *
 * The projection of a resolved bullet into this binding's presentation
 * (`resolveAngularParagraphBullet`) used to live here; it went with the
 * hand-ported paragraph builder it served, since shared `buildParagraphs` now
 * returns the marker's own style (font, weight, size, hang width) for every
 * binding.
 */

export {
	alphaLabel,
	bulletIndentPx,
	formatAutoNumber,
	resolveParagraphBullet,
	romanNumeral,
} from '../internal/shared';
export type { ParagraphBulletResult, PictureBulletMarker } from '../internal/shared';
