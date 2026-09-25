/**
 * Paragraph-level bullet OVERRIDES: the bullet colour / size / typeface
 * choices a paragraph's own `<a:pPr>` authors without a bullet TYPE.
 *
 * CT_TextParagraphProperties splits the bullet group into four independent
 * choices (EG_TextBulletColor, EG_TextBulletSize, EG_TextBulletTypeface,
 * EG_TextBulletType). PowerPoint routinely writes the first three on a
 * paragraph whose bullet mark itself is inherited from the list style, e.g.
 * `<a:pPr><a:buClr><a:srgbClr val="E74011"/></a:buClr></a:pPr>`. The bullet
 * resolver finds no type on such a paragraph, resolves the bullet from the
 * cascade, and the writer (rightly) refuses to stamp a cascaded bullet onto
 * the paragraph, so the paragraph's own override used to be dropped on every
 * rewrite of the slide.
 *
 * @module paragraph-bullet-overrides
 */

import type { XmlObject } from '../types';
import { xmlHasChild } from './xml-access';

/** Bullet-TYPE children: any one of them makes the paragraph own its bullet. */
const BULLET_TYPE_KEYS = ['a:buNone', 'a:buChar', 'a:buAutoNum', 'a:buBlip'] as const;

/** Colour / size / typeface children, in schema order. */
const BULLET_OVERRIDE_KEYS = [
	'a:buClrTx',
	'a:buClr',
	'a:buSzTx',
	'a:buSzPct',
	'a:buSzPts',
	'a:buFontTx',
	'a:buFont',
] as const;

/**
 * Capture the bullet colour / size / typeface children of a paragraph's own
 * `a:pPr` when it declares no bullet type. Returns `undefined` when the
 * paragraph declares a bullet type (its {@link BulletInfo} then owns the whole
 * group) or authored none of these children.
 */
export function captureParagraphBulletOverrides(pPr: XmlObject | undefined): XmlObject | undefined {
	if (!pPr || typeof pPr !== 'object') {
		return undefined;
	}
	if (BULLET_TYPE_KEYS.some((key) => xmlHasChild(pPr, key))) {
		return undefined;
	}
	const captured: XmlObject = {};
	for (const key of BULLET_OVERRIDE_KEYS) {
		const value = pPr[key];
		if (value === undefined) {
			continue;
		}
		// A childless marker (`<a:buClrTx/>`) parses to the empty string.
		captured[key] = typeof value === 'object' && value !== null ? value : {};
	}
	return Object.keys(captured).length > 0 ? captured : undefined;
}

/**
 * Re-emit captured bullet overrides into a `paragraphProps` object that has no
 * bullet group of its own yet. Keys are appended in schema order, so this must
 * run at the bullet group's position (after `a:spcAft`, before `a:tabLst`).
 */
export function applyParagraphBulletOverrides(
	paragraphProps: XmlObject,
	overrides: XmlObject | undefined,
): void {
	if (!overrides) {
		return;
	}
	for (const key of BULLET_OVERRIDE_KEYS) {
		if (overrides[key] !== undefined && paragraphProps[key] === undefined) {
			paragraphProps[key] = overrides[key];
		}
	}
}
