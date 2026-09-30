/**
 * SmartArt Design > Change Colors: the colour schemes the core SmartArt model
 * carries (`SmartArtColorScheme`), named and grouped after PowerPoint's
 * gallery (see `smartart-gallery-patch.ts`). A pick sets
 * `smartArtData.colorScheme` through the shared inspector patch.
 *
 * @module render/ribbon-galleries/smartart-colors-gallery
 */
import type { RibbonGalleryModule } from './gallery-module';
import { galleryColorScheme } from './gallery-theme';
import type { RibbonGallerySection } from './gallery-types';
import { smartArtColorPatch } from './smartart-color-patch';
import { SMARTART_COLOR_ENTRIES, smartArtElementPatch } from './smartart-gallery-patch';
import type { SmartArtColorEntry } from './smartart-gallery-patch';
import { smartArtTileSvg } from './smartart-gallery-tiles';

const TILE = { width: 56, height: 36 };

const SECTIONS: ReadonlyArray<{ id: SmartArtColorEntry['section']; title: string }> = [
	{ id: 'colorful', title: 'Colorful' },
	{ id: 'accent1', title: 'Accent 1' },
	{ id: 'accent2', title: 'Accent 2' },
];

/** `{{from}}`/`{{to}}` for the "Colorful Range" entries. */
function labelParams(entry: SmartArtColorEntry): Record<string, number> | undefined {
	const match = /(\d) to (\d)$/u.exec(entry.name) ?? /Accent (\d)$/u.exec(entry.name);
	if (!match) {
		return undefined;
	}
	return match[2] ? { from: Number(match[1]), to: Number(match[2]) } : { accent: Number(match[1]) };
}

export const SMARTART_COLORS_GALLERY: RibbonGalleryModule = {
	build(ctx) {
		const element = ctx.element;
		const data = element?.type === 'smartArt' ? element.smartArtData : undefined;
		const scheme = galleryColorScheme(ctx);
		const fills = data?.colorTransform?.fillColors;
		const matched = fills?.length
			? SMARTART_COLOR_ENTRIES.find(
					(entry) =>
						entry.accents.length === fills.length &&
						entry.accents.every(
							(accent, index) => scheme[accent].toLowerCase() === fills[index].toLowerCase(),
						),
				)?.id
			: undefined;
		const current = data
			? (data.colorScheme ?? matched ?? (fills?.length ? undefined : 'colorful1'))
			: undefined;
		const sections: RibbonGallerySection[] = SECTIONS.map((section) => ({
			id: section.id,
			titleKey: `pptx.gallery.smartArtColors.section.${section.id}`,
			title: section.title,
			columns: 5,
			tileWidth: TILE.width,
			tileHeight: TILE.height,
			items: SMARTART_COLOR_ENTRIES.filter((entry) => entry.section === section.id).map((entry) => {
				const params = labelParams(entry);
				return {
					id: entry.id,
					labelKey: entry.labelKey,
					...(params && { labelParams: params }),
					label: entry.name,
					previewSvg: smartArtTileSvg(
						entry.id,
						entry.accents.map((accent) => scheme[accent]),
						'flat',
						TILE,
					),
					applied: current === entry.id,
				};
			}),
		}));
		return {
			id: 'smartArtColors',
			labelKey: 'pptx.gallery.smartArtColors.title',
			label: 'Change Colors',
			disabled: !data,
			sections,
		};
	},
	apply(itemId, ctx) {
		const entry = SMARTART_COLOR_ENTRIES.find((candidate) => candidate.id === itemId);
		const data = ctx.element?.type === 'smartArt' ? ctx.element.smartArtData : undefined;
		const scheme = galleryColorScheme(ctx);
		const patch =
			entry && data
				? smartArtElementPatch(ctx.element, {
						colorScheme: entry.id,
						...smartArtColorPatch(
							data,
							entry.accents.map((accent) => scheme[accent]),
						),
					})
				: null;
		return patch ? { kind: 'element', ...patch } : null;
	},
};
