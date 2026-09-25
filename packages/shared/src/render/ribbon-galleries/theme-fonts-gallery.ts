/**
 * The Fonts gallery. PLACEHOLDER: the catalogue has not landed yet, so the
 * trigger renders disabled.
 *
 * @module render/ribbon-galleries/theme-fonts-gallery
 */
import { emptyGalleryModule } from './gallery-module';
import type { RibbonGalleryModule } from './gallery-module';

export const THEME_FONTS_GALLERY: RibbonGalleryModule = emptyGalleryModule(
	'themeFonts',
	'pptx.gallery.themeFonts.title',
	'Fonts',
);
