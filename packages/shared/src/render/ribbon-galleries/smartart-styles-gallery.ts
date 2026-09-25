/**
 * SmartArt Design > SmartArt Styles: the style intensities the core SmartArt
 * model carries (`SmartArtStyle`: flat / moderate / intense), named after the
 * PowerPoint "Best Match for Document" entries they correspond to (Simple
 * Fill, Moderate Effect, Intense Effect; `Application.SmartArtQuickStyles`
 * 1, 4 and 5). PowerPoint's other quick styles (White Outline, Subtle Effect
 * and the nine 3-D scenes) have no model value yet. A pick sets
 * `smartArtData.style` through the shared inspector patch.
 *
 * @module render/ribbon-galleries/smartart-styles-gallery
 */
import type { RibbonGalleryModule } from './gallery-module';
import { galleryColorScheme } from './gallery-theme';
import { SMARTART_STYLE_ENTRIES, smartArtElementPatch } from './smartart-gallery-patch';
import { smartArtTileSvg } from './smartart-gallery-tiles';

const TILE = { width: 56, height: 36 };

export const SMARTART_STYLES_GALLERY: RibbonGalleryModule = {
	build(ctx) {
		const element = ctx.element;
		const data = element?.type === 'smartArt' ? element.smartArtData : undefined;
		const current = data ? (data.style ?? 'flat') : undefined;
		const accent1 = galleryColorScheme(ctx).accent1;
		return {
			id: 'smartArtStyles',
			labelKey: 'pptx.gallery.smartArtStyles.title',
			label: 'SmartArt Styles',
			disabled: !data,
			sections: [
				{
					id: 'bestMatch',
					titleKey: 'pptx.gallery.smartArtStyles.section.bestMatch',
					title: 'Best Match for Document',
					columns: 5,
					tileWidth: TILE.width,
					tileHeight: TILE.height,
					items: SMARTART_STYLE_ENTRIES.map((entry) => ({
						id: entry.id,
						labelKey: entry.labelKey,
						label: entry.name,
						previewSvg: smartArtTileSvg(`style-${entry.id}`, [accent1], entry.id, TILE),
						applied: current === entry.id,
					})),
				},
			],
		};
	},
	apply(itemId, ctx) {
		const entry = SMARTART_STYLE_ENTRIES.find((candidate) => candidate.id === itemId);
		const patch = entry ? smartArtElementPatch(ctx.element, { style: entry.id }) : null;
		return patch ? { kind: 'element', ...patch } : null;
	},
};
