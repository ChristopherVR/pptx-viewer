/**
 * The Picture Styles gallery. PLACEHOLDER: the catalogue has not landed yet, so the
 * trigger renders disabled.
 *
 * @module render/ribbon-galleries/picture-styles-gallery
 */
import { emptyGalleryModule } from './gallery-module';
import type { RibbonGalleryModule } from './gallery-module';

export const PICTURE_STYLES_GALLERY: RibbonGalleryModule = emptyGalleryModule(
	'pictureStyles',
	'pptx.gallery.pictureStyles.title',
	'Picture Styles',
);
