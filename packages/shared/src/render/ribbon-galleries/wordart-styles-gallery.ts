/**
 * The WordArt Styles gallery. PLACEHOLDER: the catalogue has not landed yet, so the
 * trigger renders disabled.
 *
 * @module render/ribbon-galleries/wordart-styles-gallery
 */
import { emptyGalleryModule } from './gallery-module';
import type { RibbonGalleryModule } from './gallery-module';

export const WORDART_STYLES_GALLERY: RibbonGalleryModule = emptyGalleryModule(
	'wordArtStyles',
	'pptx.gallery.wordArtStyles.title',
	'WordArt Styles',
);
