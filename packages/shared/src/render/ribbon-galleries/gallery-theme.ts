/**
 * The deck's colour / font scheme as the data galleries (Table Styles, Chart
 * Colors, SmartArt, theme Variants) preview it: `ctx.theme` first, then the
 * handler's `themeColorMap`, then PowerPoint's default Office theme, so a tile
 * never renders with holes.
 *
 * @module render/ribbon-galleries/gallery-theme
 */
import type { PptxThemeColorScheme } from 'pptx-viewer-core';

import type { RibbonGalleryContext } from './gallery-types';

/** PowerPoint's default "Office" theme colours (the 2023+ theme new decks get). */
export const OFFICE_THEME_COLORS: Readonly<PptxThemeColorScheme> = {
	dk1: '#000000',
	lt1: '#FFFFFF',
	dk2: '#0E2841',
	lt2: '#E8E8E8',
	accent1: '#156082',
	accent2: '#E97132',
	accent3: '#196B24',
	accent4: '#0F9ED5',
	accent5: '#A02B93',
	accent6: '#4EA72E',
	hlink: '#467886',
	folHlink: '#96607D',
};

export const THEME_COLOR_KEYS: ReadonlyArray<keyof PptxThemeColorScheme> = [
	'dk1',
	'lt1',
	'dk2',
	'lt2',
	'accent1',
	'accent2',
	'accent3',
	'accent4',
	'accent5',
	'accent6',
	'hlink',
	'folHlink',
];

function hex(value: string | undefined): string | undefined {
	if (!value) {
		return undefined;
	}
	const clean = value.trim().replace(/^#/u, '');
	return /^[0-9a-f]{6}$/iu.test(clean) ? `#${clean.toUpperCase()}` : undefined;
}

/** The twelve scheme colours the selection's deck resolves to. */
export function galleryColorScheme(ctx: RibbonGalleryContext): PptxThemeColorScheme {
	const fromTheme = ctx.theme?.colorScheme as Partial<Record<string, string>> | undefined;
	const fromMap = ctx.themeColorMap as Partial<Record<string, string>> | undefined;
	const scheme = { ...OFFICE_THEME_COLORS };
	for (const key of THEME_COLOR_KEYS) {
		scheme[key] = hex(fromTheme?.[key]) ?? hex(fromMap?.[key]) ?? OFFICE_THEME_COLORS[key];
	}
	return scheme;
}

/** A stable gallery item id for a scheme name ("Blue II" -> "blue-ii"). */
export function schemeSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, '-')
		.replace(/^-|-$/gu, '');
}

/** Case-insensitive equality of two colour schemes over the twelve slots. */
export function colorSchemesEqual(
	a: Readonly<PptxThemeColorScheme> | undefined,
	b: Readonly<PptxThemeColorScheme> | undefined,
): boolean {
	if (!a || !b) {
		return false;
	}
	return THEME_COLOR_KEYS.every((key) => hex(a[key]) !== undefined && hex(a[key]) === hex(b[key]));
}
