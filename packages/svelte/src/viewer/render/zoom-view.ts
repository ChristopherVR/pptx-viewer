import type { ZoomPptxElement } from 'pptx-viewer-core';

/**
 * View-model builder for `zoom` (Slide Zoom / Section Zoom) elements (Svelte
 * port of the vanilla binding's `renderZoomElement`, static-tile subset).
 * Pure field resolution only; the aria-label / badge text (which need
 * translation) are built in the `ZoomView` SFC via the Svelte i18n context.
 */
export interface ZoomView {
	zoomType: 'slide' | 'section';
	/** Zero-based target slide index. */
	target: number;
	sectionId: string | undefined;
	/** The element's own preview thumbnail, when embedded. */
	imageSrc: string | undefined;
}

/** Resolve the display fields for a zoom element. */
export function resolveZoomView(element: ZoomPptxElement): ZoomView {
	return {
		zoomType: element.zoomType ?? 'slide',
		target: element.targetSlideIndex ?? 0,
		sectionId: element.targetSectionId,
		imageSrc: element.imageData,
	};
}
