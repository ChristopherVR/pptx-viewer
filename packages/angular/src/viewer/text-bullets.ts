/**
 * Paragraph bullet / list-marker helpers for the Angular text renderer.
 *
 * Thin re-export shim: the implementations live in `pptx-viewer-shared`
 * (`render/bullet-autonum.ts` for romanNumeral / alphaLabel / formatAutoNumber,
 * `render/bullet-list.ts` for resolveParagraphBullet / bulletIndentPx). This
 * module preserves the local import path (`./text-bullets`) that Angular
 * consumers already use, re-exporting the shared symbols unchanged.
 */

import type { TextSegment } from 'pptx-viewer-core';

import type { PictureBulletMarker } from '../internal/shared';
import { resolveParagraphBullet } from '../internal/shared';

export {
	alphaLabel,
	bulletIndentPx,
	formatAutoNumber,
	romanNumeral,
} from '../internal/shared';
export { resolveParagraphBullet };
export type { ParagraphBulletResult, PictureBulletMarker } from '../internal/shared';

export interface AngularParagraphBullet {
	marker?: string;
	picture?: PictureBulletMarker;
	style: Record<string, string | number>;
}

/** Project the shared bullet model into Angular's paragraph presentation. */
export function resolveAngularParagraphBullet(
	segment: TextSegment,
	baseFontSize: number,
): AngularParagraphBullet | undefined {
	const bullet = resolveParagraphBullet(segment, baseFontSize);
	if (!bullet) {
		return undefined;
	}
	const style: Record<string, string | number> = {};
	if (bullet.color) {
		style['color'] = bullet.color;
	}
	if (bullet.fontFamily) {
		style['font-family'] = bullet.fontFamily;
	}
	return {
		marker: bullet.picture?.src ? undefined : bullet.marker,
		picture: bullet.picture,
		style,
	};
}
