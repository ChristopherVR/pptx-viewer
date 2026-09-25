/**
 * The Change Colors gallery. PLACEHOLDER: the catalogue has not landed yet, so the
 * trigger renders disabled.
 *
 * @module render/ribbon-galleries/smartart-colors-gallery
 */
import { emptyGalleryModule } from './gallery-module';
import type { RibbonGalleryModule } from './gallery-module';

export const SMARTART_COLORS_GALLERY: RibbonGalleryModule = emptyGalleryModule(
	'smartArtColors',
	'pptx.gallery.smartArtColors.title',
	'Change Colors',
);
