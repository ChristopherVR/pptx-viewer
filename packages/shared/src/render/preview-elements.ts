import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

/**
 * Composition helper for slide previews and sidebar thumbnails.
 *
 * Every binding paints a preview from the same two sources as a real save:
 * the inherited layout/master (template) elements first, then the slide-owned
 * elements on top. Keeping that merge + cap in one place stops each binding's
 * thumbnail path from drifting away from `buildSaveSlides` ordering.
 */

/**
 * Default cap on the number of elements a preview renders. This guards against
 * pathological decks (thousands of shapes on one slide) blowing up a tiny
 * off-screen thumbnail; ordinary slides sit far below it, so normal content is
 * never dropped.
 */
export const DEFAULT_PREVIEW_ELEMENT_CAP = 500;

export interface BuildPreviewElementsOptions {
	/**
	 * Maximum number of elements to include. Defaults to
	 * {@link DEFAULT_PREVIEW_ELEMENT_CAP}. A value <= 0 disables the cap.
	 */
	cap?: number;
}

/**
 * Ordered, capped element list for a slide preview/thumbnail. Inherited
 * template (layout/master) elements come first so slide-owned elements paint
 * on top, matching {@link import('./template-editing').buildSaveSlides}.
 */
export function buildPreviewElements(
	slide: PptxSlide,
	templateElements: readonly PptxElement[] = [],
	options?: BuildPreviewElementsOptions,
): PptxElement[] {
	const cap = options?.cap ?? DEFAULT_PREVIEW_ELEMENT_CAP;
	const merged = [...templateElements, ...slide.elements];
	if (cap > 0 && merged.length > cap) {
		return merged.slice(0, cap);
	}
	return merged;
}
