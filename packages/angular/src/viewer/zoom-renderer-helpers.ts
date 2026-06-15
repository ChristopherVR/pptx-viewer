import type { PptxElement, ZoomPptxElement } from 'pptx-viewer-core';
import { isZoomElement } from 'pptx-viewer-core';

import type { StyleMap } from './element-style';
import { getContainerStyle } from './element-style';

/**
 * Pure helpers for `ZoomRendererComponent`.
 *
 * All functions are framework-agnostic (no Angular dependency) so they can be
 * unit-tested without TestBed, following the same pattern as
 * `connector-path.ts`.
 */

/** Narrowed view-model derived from a `ZoomPptxElement`. */
export interface ZoomViewModel {
	/** Resolved zoom element, or undefined when the element is not a zoom. */
	readonly zoom: ZoomPptxElement | undefined;
	/** Preview image src (the `imageData` embedded thumbnail). */
	readonly previewSrc: string | undefined;
	/** Zero-based target slide index. */
	readonly targetSlideIndex: number;
	/** Zoom type string used as the badge label source and data attribute. */
	readonly zoomType: 'slide' | 'section';
	/** Optional section identifier for section zooms. */
	readonly targetSectionId: string | undefined;
	/** Human-readable badge text ("Slide Zoom" / "Section Zoom"). */
	readonly badgeText: string;
	/** Human-readable slide label ("Slide N"). */
	readonly slideLabel: string;
	/** Accessible label for the element. */
	readonly ariaLabel: string;
}

/**
 * Build the complete zoom view-model for a given element.
 * Returns sensible defaults for non-zoom elements (all derived strings are
 * empty/fallback values, `zoom` is `undefined`).
 */
export function buildZoomViewModel(element: PptxElement): ZoomViewModel {
	const zoom = isZoomElement(element) ? element : undefined;
	const previewSrc = zoom?.imageData;
	const targetSlideIndex = zoom?.targetSlideIndex ?? 0;
	const zoomType: 'slide' | 'section' = zoom?.zoomType ?? 'slide';
	const targetSectionId = zoom?.targetSectionId;
	const badgeText = zoomType === 'section' ? 'Section Zoom' : 'Slide Zoom';
	const slideLabel = `Slide ${targetSlideIndex + 1}`;
	let ariaLabel = `Zoom to slide ${targetSlideIndex + 1}`;
	if (zoomType === 'section' && targetSectionId) {
		ariaLabel = `${ariaLabel} (section: ${targetSectionId})`;
	}

	return {
		zoom,
		previewSrc,
		targetSlideIndex,
		zoomType,
		targetSectionId,
		badgeText,
		slideLabel,
		ariaLabel,
	};
}

/** Wrapper `[ngStyle]`-compatible style for the zoom container `<div>`. */
export function buildZoomContainerStyle(element: PptxElement, zIndex: number): StyleMap {
	return getContainerStyle(element, zIndex);
}
