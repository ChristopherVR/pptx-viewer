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
import { getSubstituteFontFamily } from 'pptx-viewer-core';

import type { PictureBulletMarker } from '../internal/shared';
import { resolveParagraphBullet } from '../internal/shared';

export { alphaLabel, bulletIndentPx, formatAutoNumber, romanNumeral } from '../internal/shared';
export { resolveParagraphBullet };
export type { ParagraphBulletResult, PictureBulletMarker } from '../internal/shared';

export interface AngularParagraphBullet {
	marker?: string;
	picture?: PictureBulletMarker;
	style: Record<string, string | number>;
}

/**
 * Project the shared bullet model into Angular's paragraph presentation.
 *
 * The marker's font declaration is not decoration: its advance is what the
 * first line's text starts after. A bullet with no `a:buFont` is painted in the
 * PARAGRAPH's typeface (React renders the marker inside the first segment's
 * span), so falling back to the text body's declaration picked a different
 * family, and a different width, from the other bindings. `fontScale` is the
 * body's `a:normAutofit/@fontScale`, applied to the marker exactly as to its
 * runs; an explicit `a:buSzPts` is an absolute size and stays put.
 */
export function resolveAngularParagraphBullet(
	segment: TextSegment,
	baseFontSize: number,
	fontScale = 1,
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
	} else if (segment.style?.fontFamily) {
		style['font-family'] = getSubstituteFontFamily(segment.style.fontFamily);
	}
	// Weight / slant come from the marker's OWN segment, never from the text body:
	// a bold heading whose marker segment core parsed as regular painted a bold
	// glyph here and a regular one in React, and a heavier marker is a wider one.
	style['font-weight'] = segment.style?.bold ? 700 : 400;
	style['font-style'] = segment.style?.italic ? 'italic' : 'normal';
	const runFontSize = segment.style?.fontSize;
	if (typeof bullet.sizePts === 'number') {
		style['font-size'] = `${bullet.sizePts}px`;
	} else if (typeof bullet.sizePercent === 'number' && typeof runFontSize === 'number') {
		style['font-size'] = `${runFontSize * fontScale * (bullet.sizePercent / 100)}px`;
	} else if (fontScale !== 1 && typeof runFontSize === 'number') {
		style['font-size'] = `${runFontSize * fontScale}px`;
	}
	return {
		marker: bullet.picture?.src ? undefined : bullet.marker,
		picture: bullet.picture,
		style,
	};
}
