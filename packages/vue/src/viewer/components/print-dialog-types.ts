/**
 * Thin re-export shim → `pptx-viewer-shared` (`export/print-document` +
 * `export/handout-layout`).
 *
 * The DOM-free print range/page/preview math + types already live in shared's
 * export module (used by every binding's print path). This file preserves the
 * historical Vue import surface so the PrintDialog family and the colocated
 * tests are unchanged. A couple of shared symbols carry different names and are
 * aliased back here: `estimatePageCount` -> `computePageCount`,
 * `normalizeSlidesPerPage` -> `resolveSlidesPerPage`.
 */

export type {
	PrintWhat,
	PrintOrientation,
	PrintColorMode,
	HandoutSlidesPerPage,
	PrintSlideRange,
	PrintSettings,
	HandoutGrid,
} from 'pptx-viewer-shared';

export {
	HANDOUT_OPTIONS,
	isHandoutSlidesPerPage,
	normalizeSlidesPerPage as resolveSlidesPerPage,
	computeSlideIndices,
	effectiveOrientation,
	computeSlideCount,
	estimatePageCount as computePageCount,
	getHandoutGrid,
	computeColorFilter,
	escapeHtml,
	buildOutlineHtml,
	safeDataImageSrc,
} from 'pptx-viewer-shared';
