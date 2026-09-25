/**
 * Design > Variants > Fonts: PowerPoint's built-in font schemes (the
 * installed `Document Themes 16/Theme Fonts/*.xml`, generated into
 * `theme-font-schemes-data.ts`), headed by the deck's own pairing when it is
 * not one of them. A pick returns the heading (major) / body (minor) latin
 * typefaces for `PptxHandler.updateThemeFontScheme`, which rewrites exactly
 * those two `a:latin` entries.
 *
 * @module render/ribbon-galleries/theme-fonts-gallery
 */
import type { PptxThemeFontScheme } from 'pptx-viewer-core';

import type { RibbonGalleryModule } from './gallery-module';
import { escapeSvgText, svgTile } from './gallery-preview-svg';
import { schemeSlug } from './gallery-theme';
import type { RibbonGalleryContext, RibbonGalleryItem } from './gallery-types';
import { THEME_FONT_SCHEME_ROWS } from './theme-font-schemes-data';

const TILE = { width: 150, height: 36 };
const CURRENT_ID = 'current';

/** Font family list for an SVG attribute: the typeface, then a generic fallback. */
function family(face: string): string {
	return `${escapeSvgText(face.replace(/[;{}<>]/gu, ''))}, Calibri, Arial, sans-serif`;
}

/** "Aa" in the heading font, then the heading and body font names. */
export function fontSchemeTileSvg(major: string, minor: string): string {
	const body =
		`<rect x="0" y="0" width="${TILE.width}" height="${TILE.height}" fill="#FFFFFF"/>` +
		`<text x="4" y="26" font-family="${family(major)}" font-size="22" fill="#000000">Aa</text>` +
		`<text x="38" y="15" font-family="${family(major)}" font-size="11" fill="#000000">${escapeSvgText(major)}</text>` +
		`<text x="38" y="29" font-family="${family(minor)}" font-size="10" fill="#404040">${escapeSvgText(minor)}</text>`;
	return svgTile(TILE.width, TILE.height, '', body);
}

function sameFace(a: string | undefined, b: string | undefined): boolean {
	return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

function deckFonts(ctx: RibbonGalleryContext): { major: string; minor: string } | undefined {
	const major = ctx.theme?.fontScheme?.majorFont?.latin;
	const minor = ctx.theme?.fontScheme?.minorFont?.latin;
	return major && minor ? { major, minor } : undefined;
}

function tile(
	id: string,
	name: string,
	major: string,
	minor: string,
	applied: boolean,
	labelKey = 'pptx.gallery.themeFonts.scheme',
): RibbonGalleryItem {
	return {
		id,
		labelKey,
		labelParams: { name, major, minor },
		label: `${name}: ${major} / ${minor}`,
		previewSvg: fontSchemeTileSvg(major, minor),
		applied,
	};
}

function schemeOf(major: string, minor: string): PptxThemeFontScheme {
	return { majorFont: { latin: major }, minorFont: { latin: minor } };
}

export const THEME_FONTS_GALLERY: RibbonGalleryModule = {
	build(ctx) {
		const current = deckFonts(ctx);
		const matches = (major: string, minor: string) =>
			Boolean(current && sameFace(current.major, major) && sameFace(current.minor, minor));
		const items = THEME_FONT_SCHEME_ROWS.map(([name, major, minor]) =>
			tile(schemeSlug(name), name, major, minor, matches(major, minor)),
		);
		if (current && !items.some((item) => item.applied)) {
			items.unshift(
				tile(
					CURRENT_ID,
					'Current Fonts',
					current.major,
					current.minor,
					true,
					'pptx.gallery.themeFonts.current',
				),
			);
		}
		return {
			id: 'themeFonts',
			labelKey: 'pptx.gallery.themeFonts.title',
			label: 'Fonts',
			disabled: false,
			sections: [
				{
					id: 'office',
					titleKey: 'pptx.gallery.themeFonts.section.office',
					title: 'Office',
					columns: 1,
					tileWidth: TILE.width,
					tileHeight: TILE.height,
					items,
				},
			],
		};
	},
	apply(itemId, ctx) {
		if (itemId === CURRENT_ID) {
			const current = deckFonts(ctx);
			return current
				? {
						kind: 'themeFontScheme',
						fontScheme: schemeOf(current.major, current.minor),
						name: 'Custom',
					}
				: null;
		}
		const row = THEME_FONT_SCHEME_ROWS.find(([name]) => schemeSlug(name) === itemId);
		return row
			? { kind: 'themeFontScheme', fontScheme: schemeOf(row[1], row[2]), name: row[0] }
			: null;
	},
};
