/**
 * The Change Colors gallery. PLACEHOLDER: the catalogue has not landed yet, so the
 * trigger renders disabled.
 *
 * @module render/ribbon-galleries/chart-colors-gallery
 */
import { emptyGalleryModule } from './gallery-module';
import type { RibbonGalleryModule } from './gallery-module';

export const CHART_COLORS_GALLERY: RibbonGalleryModule = emptyGalleryModule(
	'chartColors',
	'pptx.gallery.chartColors.title',
	'Change Colors',
);
