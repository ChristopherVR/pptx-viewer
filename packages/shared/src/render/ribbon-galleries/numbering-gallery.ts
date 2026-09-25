/**
 * The Numbering gallery. PLACEHOLDER: the catalogue has not landed yet, so the
 * trigger renders disabled.
 *
 * @module render/ribbon-galleries/numbering-gallery
 */
import { emptyGalleryModule } from './gallery-module';
import type { RibbonGalleryModule } from './gallery-module';

export const NUMBERING_GALLERY: RibbonGalleryModule = emptyGalleryModule(
	'numbering',
	'pptx.gallery.numbering.title',
	'Numbering',
);
