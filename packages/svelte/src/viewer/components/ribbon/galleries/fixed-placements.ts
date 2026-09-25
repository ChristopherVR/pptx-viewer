import { FIXED_TAB_GALLERIES } from 'pptx-viewer-shared';
import type { RibbonControlId, RibbonGalleryPlacement } from 'pptx-viewer-shared';

/**
 * The shared placement of a gallery that sits on a fixed tab (Home > Drawing,
 * Home > Paragraph, Design > Variants), looked up by its control id so the
 * gallery id and mode always come from `FIXED_TAB_GALLERIES`.
 */
export function fixedGalleryPlacement(control: RibbonControlId): RibbonGalleryPlacement {
	const placement = FIXED_TAB_GALLERIES.find((entry) => entry.control === control);
	if (!placement) {
		throw new Error(`No fixed-tab gallery is placed at ${control}`);
	}
	return placement;
}
