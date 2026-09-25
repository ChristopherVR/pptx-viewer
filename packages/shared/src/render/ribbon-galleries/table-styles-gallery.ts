/**
 * The Table Styles gallery. PLACEHOLDER: the catalogue has not landed yet, so the
 * trigger renders disabled.
 *
 * @module render/ribbon-galleries/table-styles-gallery
 */
import { emptyGalleryModule } from './gallery-module';
import type { RibbonGalleryModule } from './gallery-module';

export const TABLE_STYLES_GALLERY: RibbonGalleryModule = emptyGalleryModule(
	'tableStyles',
	'pptx.gallery.tableStyles.title',
	'Table Styles',
);
