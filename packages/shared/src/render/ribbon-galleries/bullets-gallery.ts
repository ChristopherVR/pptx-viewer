/**
 * The Bullets gallery. PLACEHOLDER: the catalogue has not landed yet, so the
 * trigger renders disabled.
 *
 * @module render/ribbon-galleries/bullets-gallery
 */
import { emptyGalleryModule } from './gallery-module';
import type { RibbonGalleryModule } from './gallery-module';

export const BULLETS_GALLERY: RibbonGalleryModule = emptyGalleryModule(
	'bullets',
	'pptx.gallery.bullets.title',
	'Bullets',
);
