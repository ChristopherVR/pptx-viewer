/**
 * `buildRibbonGallery` / `applyRibbonGalleryItem`: the two calls a binding
 * makes, dispatched to the gallery modules.
 *
 * @module render/ribbon-galleries/gallery-registry
 */
import { BULLETS_GALLERY } from './bullets-gallery';
import { CHART_COLORS_GALLERY } from './chart-colors-gallery';
import { CHART_QUICK_LAYOUT_GALLERY } from './chart-quick-layout-gallery';
import { CHART_STYLES_GALLERY } from './chart-styles-gallery';
import type { RibbonGalleryModule } from './gallery-module';
import type {
	RibbonGalleryApplyResult,
	RibbonGalleryContext,
	RibbonGalleryDescriptor,
	RibbonGalleryId,
} from './gallery-types';
import { NUMBERING_GALLERY } from './numbering-gallery';
import { PICTURE_STYLES_GALLERY } from './picture-styles-gallery';
import { SHAPE_EFFECTS_GALLERY } from './shape-effects-gallery';
import { applyShapeStylesItem, buildShapeStylesGallery } from './shape-styles-gallery';
import { SMARTART_COLORS_GALLERY } from './smartart-colors-gallery';
import { SMARTART_STYLES_GALLERY } from './smartart-styles-gallery';
import { TABLE_STYLES_GALLERY } from './table-styles-gallery';
import { THEME_COLORS_GALLERY } from './theme-colors-gallery';
import { THEME_FONTS_GALLERY } from './theme-fonts-gallery';
import { WORDART_STYLES_GALLERY } from './wordart-styles-gallery';

const MODULES: Record<RibbonGalleryId, RibbonGalleryModule> = {
	shapeStyles: { build: buildShapeStylesGallery, apply: applyShapeStylesItem },
	shapeEffects: SHAPE_EFFECTS_GALLERY,
	wordArtStyles: WORDART_STYLES_GALLERY,
	pictureStyles: PICTURE_STYLES_GALLERY,
	bullets: BULLETS_GALLERY,
	numbering: NUMBERING_GALLERY,
	tableStyles: TABLE_STYLES_GALLERY,
	chartStyles: CHART_STYLES_GALLERY,
	chartColors: CHART_COLORS_GALLERY,
	chartQuickLayout: CHART_QUICK_LAYOUT_GALLERY,
	smartArtStyles: SMARTART_STYLES_GALLERY,
	smartArtColors: SMARTART_COLORS_GALLERY,
	themeColors: THEME_COLORS_GALLERY,
	themeFonts: THEME_FONTS_GALLERY,
};

/** Every gallery id, for tests and hosts. */
export const RIBBON_GALLERY_IDS = Object.keys(MODULES) as RibbonGalleryId[];

/** The descriptor a binding renders for gallery `id`. */
export function buildRibbonGallery(
	id: RibbonGalleryId,
	ctx: RibbonGalleryContext,
): RibbonGalleryDescriptor {
	return MODULES[id].build(ctx);
}

/**
 * What picking `itemId` in gallery `id` should do, or `null` when the pick
 * does not apply to the selection (the binding does nothing).
 */
export function applyRibbonGalleryItem(
	id: RibbonGalleryId,
	itemId: string,
	ctx: RibbonGalleryContext,
): RibbonGalleryApplyResult | null {
	return MODULES[id].apply(itemId, ctx);
}
