/**
 * The Colors gallery. PLACEHOLDER: the catalogue has not landed yet, so the
 * trigger renders disabled.
 *
 * @module render/ribbon-galleries/theme-colors-gallery
 */
import { emptyGalleryModule } from './gallery-module';
import type { RibbonGalleryModule } from './gallery-module';

export const THEME_COLORS_GALLERY: RibbonGalleryModule = emptyGalleryModule(
	'themeColors',
	'pptx.gallery.themeColors.title',
	'Colors',
);
