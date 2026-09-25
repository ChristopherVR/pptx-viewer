/**
 * The Chart Styles gallery. PLACEHOLDER: the catalogue has not landed yet, so the
 * trigger renders disabled.
 *
 * @module render/ribbon-galleries/chart-styles-gallery
 */
import { emptyGalleryModule } from './gallery-module';
import type { RibbonGalleryModule } from './gallery-module';

export const CHART_STYLES_GALLERY: RibbonGalleryModule = emptyGalleryModule(
	'chartStyles',
	'pptx.gallery.chartStyles.title',
	'Chart Styles',
);
