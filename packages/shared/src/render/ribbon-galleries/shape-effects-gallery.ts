/**
 * The Shape Effects gallery. PLACEHOLDER: the catalogue has not landed yet, so the
 * trigger renders disabled.
 *
 * @module render/ribbon-galleries/shape-effects-gallery
 */
import { emptyGalleryModule } from './gallery-module';
import type { RibbonGalleryModule } from './gallery-module';

export const SHAPE_EFFECTS_GALLERY: RibbonGalleryModule = emptyGalleryModule(
	'shapeEffects',
	'pptx.gallery.shapeEffects.title',
	'Shape Effects',
);
