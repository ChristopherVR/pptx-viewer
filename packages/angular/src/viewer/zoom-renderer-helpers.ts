import type { PptxElement, ZoomPptxElement } from 'pptx-viewer-core';
import { isZoomElement } from 'pptx-viewer-core';

import type { StyleMap } from './element-style';
import { getContainerStyle } from './element-style';
import type { ZoomTargetInfo } from './zoom-target.service';

/** Fallback tile background when the target slide has no background colour. */
const FALLBACK_THUMBNAIL_BG = '#f0f0f0';

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
	readonly zoomType: 'slide' | 'section' | 'summary';
	/** Optional section identifier for section zooms. */
	readonly targetSectionId: string | undefined;
	/** Human-readable badge text ("Slide Zoom" / "Section Zoom"). */
	readonly badgeText: string;
	/** Human-readable slide label ("Slide N"). */
	readonly slideLabel: string;
	/** Accessible label for the element. */
	readonly ariaLabel: string;
	/**
	 * Fallback-thumbnail background colour: the target slide's own background when
	 * known, else a neutral grey. Mirrors React's `ZoomSlideThumbnail`.
	 */
	readonly thumbnailBackground: string;
	/**
	 * Friendly section caption for the fallback thumbnail: the target slide's
	 * section name when resolved, else the raw `targetSectionId` (GUID).
	 */
	readonly sectionCaption: string | undefined;
}

/**
 * Build the complete zoom view-model for a given element.
 *
 * When `targetInfo` is supplied (the target slide was resolved from the deck),
 * the fallback-thumbnail fields use the real target slide: its `backgroundColor`
 * as the tile background, `Slide ${slideNumber}` as the label, and its friendly
 * `sectionName` as the caption. This mirrors React's `ZoomSlideThumbnail`. When
 * it is absent the old fallback applies: grey background, `Slide ${index + 1}`,
 * and the raw `targetSectionId`.
 *
 * Returns sensible defaults for non-zoom elements (all derived strings are
 * empty/fallback values, `zoom` is `undefined`).
 */
export function buildZoomViewModel(
	element: PptxElement,
	targetInfo?: ZoomTargetInfo,
): ZoomViewModel {
	const zoom = isZoomElement(element) ? element : undefined;
	const previewSrc = zoom?.imageData;
	const targetSlideIndex = zoom?.targetSlideIndex ?? 0;
	const zoomType: 'slide' | 'section' | 'summary' = zoom?.zoomType ?? 'slide';
	const targetSectionId = zoom?.targetSectionId;
	const badgeText =
		zoomType === 'section'
			? 'Section Zoom'
			: zoomType === 'summary'
				? 'Summary Zoom'
				: 'Slide Zoom';
	const slideLabel =
		targetInfo?.slideNumber !== undefined
			? `Slide ${targetInfo.slideNumber}`
			: `Slide ${targetSlideIndex + 1}`;
	const thumbnailBackground = targetInfo?.backgroundColor ?? FALLBACK_THUMBNAIL_BG;
	const sectionCaption = targetInfo?.sectionName ?? targetSectionId;
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
		thumbnailBackground,
		sectionCaption,
	};
}

/**
 * Resolve a zoom element's zero-based target slide index, or `0` for non-zoom
 * elements. Used to look the target slide up before building the view model.
 */
export function zoomTargetSlideIndex(element: PptxElement): number {
	return isZoomElement(element) ? element.targetSlideIndex : 0;
}

/** Wrapper `[ngStyle]`-compatible style for the zoom container `<div>`. */
export function buildZoomContainerStyle(element: PptxElement, zIndex: number): StyleMap {
	return getContainerStyle(element, zIndex);
}

/**
 * Whether a keyboard event should activate the zoom tile (Enter or Space).
 * Other keys are ignored so they pass through to the presentation controller.
 */
export function isZoomActivationKey(key: string): boolean {
	return key === 'Enter' || key === ' ';
}
