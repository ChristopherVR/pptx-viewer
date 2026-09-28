/**
 * The engine the Picture Format > Adjust galleries (Corrections, Color,
 * Artistic Effects) share: a gallery is a list of titled sections of
 * {@link AdjustPreset}s, each of which knows what it writes onto the
 * picture's `imageEffects`, whether the picture already carries it, and how
 * its tile previews. The three galleries differ only in their presets.
 *
 * A pick is a plain `imageEffects` patch (a14 Corrections / Color fields and
 * the recolor fields core already parses, renders and serialises), so it
 * round-trips on save with no new serialisation.
 *
 * @module render/ribbon-galleries/picture-adjust-gallery
 */
import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';

import type { RibbonGalleryModule } from './gallery-module';
import type {
	RibbonGalleryApplyResult,
	RibbonGalleryContext,
	RibbonGalleryId,
	RibbonGallerySection,
} from './gallery-types';
import { PICTURE_ADJUST_TILE, pictureAdjustTileSvg } from './picture-adjust-tile-svg';
import type { PictureAdjustPreview } from './picture-adjust-tile-svg';

/** One tile: what it writes, whether it is current, how it previews. */
export interface AdjustPreset {
	id: string;
	labelKey: string;
	labelParams?: Readonly<Record<string, string | number>>;
	/** English fallback name. */
	label: string;
	/** The `imageEffects` keys a pick sets; `undefined` removes a key. */
	changes: (effects: PptxImageEffects) => Partial<PptxImageEffects>;
	/** True when `effects` already carries this preset. */
	applied: (effects: PptxImageEffects) => boolean;
	preview: PictureAdjustPreview;
}

export interface AdjustSection {
	id: string;
	titleKey?: string;
	title?: string;
	columns: number;
	presets: AdjustPreset[];
}

export function isPictureElement(element: PptxElement | null): element is PptxElement {
	return element?.type === 'image' || element?.type === 'picture';
}

/** The picture's image effects (empty when it has none). */
export function pictureEffects(element: PptxElement): PptxImageEffects {
	return (element as { imageEffects?: PptxImageEffects }).imageEffects ?? {};
}

/** `imageEffects` merged with `changes`, dropping keys set to `undefined`. */
export function mergeImageEffects(
	effects: PptxImageEffects,
	changes: Partial<PptxImageEffects>,
): PptxImageEffects {
	const merged: Record<string, unknown> = { ...effects, ...changes };
	for (const key of Object.keys(merged)) {
		if (merged[key] === undefined) {
			delete merged[key];
		}
	}
	return merged as PptxImageEffects;
}

/** Case-insensitive `#RRGGBB` equality. */
export function sameHex(a: string | undefined, b: string): boolean {
	return (a ?? '').replace('#', '').toUpperCase() === b.replace('#', '').toUpperCase();
}

function toSection(
	galleryId: RibbonGalleryId,
	section: AdjustSection,
	element: PptxElement | null,
) {
	const effects = element ? pictureEffects(element) : {};
	const out: RibbonGallerySection = {
		id: section.id,
		...(section.titleKey && { titleKey: section.titleKey }),
		...(section.title && { title: section.title }),
		columns: section.columns,
		tileWidth: PICTURE_ADJUST_TILE.width,
		tileHeight: PICTURE_ADJUST_TILE.height,
		items: section.presets.map((preset) => ({
			id: preset.id,
			labelKey: preset.labelKey,
			...(preset.labelParams && { labelParams: preset.labelParams }),
			label: preset.label,
			previewSvg: pictureAdjustTileSvg(`${galleryId}-${preset.id}`, preset.preview),
			...(preset.preview.css && { previewFilter: preset.preview.css }),
			applied: element !== null && preset.applied(effects),
		})),
	};
	return out;
}

/** Build a gallery module from its title and its presets (which may depend on the theme). */
export function adjustGalleryModule(
	id: RibbonGalleryId,
	labelKey: string,
	label: string,
	sectionsFor: (ctx: RibbonGalleryContext) => AdjustSection[],
): RibbonGalleryModule {
	return {
		build(ctx) {
			const element = isPictureElement(ctx.element) ? ctx.element : null;
			return {
				id,
				labelKey,
				label,
				disabled: element === null,
				sections: sectionsFor(ctx).map((section) => toSection(id, section, element)),
			};
		},
		apply(itemId, ctx): RibbonGalleryApplyResult | null {
			const element = ctx.element;
			if (!isPictureElement(element)) {
				return null;
			}
			const preset = sectionsFor(ctx)
				.flatMap((section) => section.presets)
				.find((candidate) => candidate.id === itemId);
			if (!preset) {
				return null;
			}
			const effects = pictureEffects(element);
			return {
				kind: 'element',
				elementId: element.id,
				patch: {
					imageEffects: mergeImageEffects(effects, preset.changes(effects)),
				} as Partial<PptxElement>,
			};
		},
	};
}
