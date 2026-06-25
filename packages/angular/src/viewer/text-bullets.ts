/**
 * Paragraph bullet / list-marker helpers for the Angular text renderer.
 *
 * Thin re-export shim: the implementations live in `pptx-viewer-shared`
 * (`render/bullet-autonum.ts` for romanNumeral / alphaLabel / formatAutoNumber,
 * `render/bullet-list.ts` for resolveParagraphBullet / bulletIndentPx). This
 * module preserves the local import path (`./text-bullets`) that Angular
 * consumers already use, re-exporting the shared symbols unchanged.
 */

export {
	alphaLabel,
	bulletIndentPx,
	formatAutoNumber,
	resolveParagraphBullet,
	romanNumeral,
} from '../internal/shared';
export type { ParagraphBulletResult } from '../internal/shared';
