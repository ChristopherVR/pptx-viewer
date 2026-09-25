/**
 * The DOM contract and small view helpers every binding's gallery component
 * shares, so the five galleries are addressable the same way (the
 * framework-neutral e2e spec relies on these attributes).
 *
 * @module render/ribbon-galleries/gallery-view
 */
import type { RibbonGalleryDescriptor, RibbonGalleryItem } from './gallery-types';

/** On the gallery trigger (dropdown button, or an inline gallery's "more" button). */
export const RIBBON_GALLERY_ATTR = 'data-ribbon-gallery';
/** On the dropped-down panel. */
export const RIBBON_GALLERY_POPUP_ATTR = 'data-ribbon-gallery-popup';
/** On every tile button (inline strip and panel). */
export const RIBBON_GALLERY_ITEM_ATTR = 'data-gallery-item';
/** On a contextual tab's button in the tab row. */
export const RIBBON_CONTEXTUAL_TAB_ATTR = 'data-ribbon-contextual-tab';

/** How many tiles an inline gallery shows in the ribbon before "more". */
export const INLINE_GALLERY_TILE_COUNT = 6;

/** The tiles an inline gallery shows in the ribbon itself. */
export function inlineGalleryItems(
	descriptor: RibbonGalleryDescriptor,
	count: number = INLINE_GALLERY_TILE_COUNT,
): RibbonGalleryItem[] {
	return descriptor.sections.flatMap((section) => section.items).slice(0, count);
}

/** True when the descriptor has at least one tile. */
export function galleryHasItems(descriptor: RibbonGalleryDescriptor): boolean {
	return descriptor.sections.some((section) => section.items.length > 0);
}

/**
 * A tile's accessible name: the translated key when the binding's dictionary
 * has it, the English fallback otherwise. `translate` returns the key itself
 * for a miss in every binding, which is what this checks for.
 */
export function galleryItemLabel(
	item: RibbonGalleryItem,
	translate: (key: string, params?: Readonly<Record<string, string | number>>) => string,
): string {
	const translated = translate(item.labelKey, item.labelParams);
	return translated && translated !== item.labelKey ? translated : item.label;
}
