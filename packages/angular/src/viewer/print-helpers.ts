/**
 * Pure print helper utilities: thin re-export shim.
 *
 * The handout grid geometry now lives once in `pptx-viewer-shared`
 * (`export/handout-layout`), the print-specific logic (settings validation,
 * slide-range / colour-filter resolution, page-count estimation, HTML markup
 * builders, full document assembler) in `export/print-document`, HTML
 * escaping in `export/html-escape`, and handout master "chrome" resolution
 * (background/header/footer/date/page-number/positioned slide rects) in
 * `export/handout-master-chrome`. All are inlined here at build time via
 * `../internal/shared-src`. This module preserves the historical import path
 * and public names for the Angular print service, components, dialog, and
 * tests.
 */
export {
	A4_LANDSCAPE,
	A4_PORTRAIT,
	HANDOUT_OPTIONS,
	computeHandoutLayout,
	computePageCount,
	generateNoteLineCount,
	getHandoutGrid,
	getPrintableArea,
} from '../internal/shared-src/export/handout-layout';
export type {
	HandoutCellPosition,
	HandoutGrid,
	HandoutOrientation,
	HandoutPage,
	HandoutSlidesPerPage,
	PageDimensions,
} from '../internal/shared-src/export/handout-layout';

export {
	DEFAULT_PRINT_SETTINGS,
	buildHandoutsHtml,
	buildNotesHtml,
	buildOutlineHtml,
	buildPrintHtmlDocument as buildPrintDocument,
	buildSlidesHtml,
	computeColorFilter,
	computeSlideIndices,
	effectiveOrientation,
	estimatePageCount,
	filterHiddenSlideIndices,
	normalizeSlidesPerPage,
	slideTitle,
	validatePrintSettings,
} from '../internal/shared-src/export/print-document';
export type {
	PrintColorMode,
	PrintHtmlDocumentOptions as PrintDocumentOptions,
	PrintOrientation,
	PrintSettings,
	PrintSlideRange,
	PrintWhat,
} from '../internal/shared-src/export/print-document';

export { escapeHtml, safeDataImageSrc } from '../internal/shared-src/export/html-escape';

// Handout master "chrome": background/header/footer/date/page-number/
// positioned slide-rect resolution for the print path, consumed by
// `buildHandoutsHtml` above.
export { handoutMasterChrome } from '../internal/shared-src/export/handout-master-chrome';
export type {
	HandoutChromeBackground,
	HandoutChromeBox,
	HandoutMasterChrome,
	HandoutMasterChromeOptions,
} from '../internal/shared-src/export/handout-master-chrome';
