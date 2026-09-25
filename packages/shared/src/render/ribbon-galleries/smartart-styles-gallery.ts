/**
 * The SmartArt Styles gallery. PLACEHOLDER: the catalogue has not landed yet, so the
 * trigger renders disabled.
 *
 * @module render/ribbon-galleries/smartart-styles-gallery
 */
import { emptyGalleryModule } from './gallery-module';
import type { RibbonGalleryModule } from './gallery-module';

export const SMARTART_STYLES_GALLERY: RibbonGalleryModule = emptyGalleryModule(
	'smartArtStyles',
	'pptx.gallery.smartArtStyles.title',
	'SmartArt Styles',
);
