/**
 * Design > Variants > Colors: PowerPoint's built-in colour schemes (the
 * installed `Document Themes 16/Theme Colors/*.xml`, generated into
 * `theme-color-schemes-data.ts`), headed by the deck's own scheme when it is
 * not one of them. A pick returns the whole twelve-slot scheme for the
 * binding to hand to `PptxHandler.updateThemeColorScheme`.
 *
 * @module render/ribbon-galleries/theme-colors-gallery
 */
import type { PptxThemeColorScheme } from 'pptx-viewer-core';

import { swatchStripSvg } from './chart-gallery-tiles';
import type { RibbonGalleryModule } from './gallery-module';
import {
	colorSchemesEqual,
	galleryColorScheme,
	schemeSlug,
	THEME_COLOR_KEYS,
} from './gallery-theme';
import type { RibbonGalleryContext, RibbonGalleryItem } from './gallery-types';
import { THEME_COLOR_SCHEME_ROWS } from './theme-color-schemes-data';

const TILE = { width: 96, height: 14 };
const CURRENT_ID = 'current';

export interface ThemeColorSchemeEntry {
	name: string;
	colorScheme: PptxThemeColorScheme;
}

let entries: ThemeColorSchemeEntry[] | undefined;

/** The built-in colour schemes, in gallery order. */
export function builtinThemeColorSchemes(): ThemeColorSchemeEntry[] {
	entries ??= THEME_COLOR_SCHEME_ROWS.map(([name, ...hexes]) => {
		const colorScheme = {} as PptxThemeColorScheme;
		THEME_COLOR_KEYS.forEach((key, i) => {
			colorScheme[key] = `#${hexes[i]}`;
		});
		return { name, colorScheme };
	});
	return entries;
}

/** The eight swatches the gallery shows: Dark 2, Light 2, Accent 1-6. */
function swatches(scheme: PptxThemeColorScheme): string[] {
	return [
		scheme.dk2,
		scheme.lt2,
		scheme.accent1,
		scheme.accent2,
		scheme.accent3,
		scheme.accent4,
		scheme.accent5,
		scheme.accent6,
	];
}

function deckScheme(ctx: RibbonGalleryContext): PptxThemeColorScheme | undefined {
	return ctx.theme?.colorScheme || ctx.themeColorMap ? galleryColorScheme(ctx) : undefined;
}

function tile(
	id: string,
	name: string,
	scheme: PptxThemeColorScheme,
	applied: boolean,
	labelKey = 'pptx.gallery.themeColors.scheme',
): RibbonGalleryItem {
	return {
		id,
		labelKey,
		labelParams: { name },
		label: name,
		previewSvg: swatchStripSvg(swatches(scheme), TILE),
		applied,
	};
}

export const THEME_COLORS_GALLERY: RibbonGalleryModule = {
	build(ctx) {
		const current = deckScheme(ctx);
		const builtins = builtinThemeColorSchemes();
		const matched = builtins.some((entry) => colorSchemesEqual(entry.colorScheme, current));
		const items = builtins.map((entry) =>
			tile(
				schemeSlug(entry.name),
				entry.name,
				entry.colorScheme,
				colorSchemesEqual(entry.colorScheme, current),
			),
		);
		if (current && !matched) {
			items.unshift(
				tile(CURRENT_ID, 'Current Colors', current, true, 'pptx.gallery.themeColors.current'),
			);
		}
		return {
			id: 'themeColors',
			labelKey: 'pptx.gallery.themeColors.title',
			label: 'Colors',
			disabled: false,
			sections: [
				{
					id: 'office',
					titleKey: 'pptx.gallery.themeColors.section.office',
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
			const current = deckScheme(ctx);
			return current ? { kind: 'themeColorScheme', colorScheme: current, name: 'Custom' } : null;
		}
		const entry = builtinThemeColorSchemes().find(
			(candidate) => schemeSlug(candidate.name) === itemId,
		);
		return entry
			? { kind: 'themeColorScheme', colorScheme: { ...entry.colorScheme }, name: entry.name }
			: null;
	},
};
