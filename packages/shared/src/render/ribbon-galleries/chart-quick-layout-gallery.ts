/**
 * The Quick Layout gallery. PLACEHOLDER: the catalogue has not landed yet, so the
 * trigger renders disabled.
 *
 * @module render/ribbon-galleries/chart-quick-layout-gallery
 */
import { emptyGalleryModule } from './gallery-module';
import type { RibbonGalleryModule } from './gallery-module';

export const CHART_QUICK_LAYOUT_GALLERY: RibbonGalleryModule = emptyGalleryModule(
	'chartQuickLayout',
	'pptx.gallery.chartQuickLayout.title',
	'Quick Layout',
);
