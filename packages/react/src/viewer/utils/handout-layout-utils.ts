/**
 * Handout layout calculations: thin re-export shim.
 *
 * The pure layout math (grid mapping, A4 page geometry, cell positioning,
 * pagination) lives once in `pptx-viewer-shared` (`export/handout-layout`).
 * This module preserves the historical import path for React
 * consumers/components/tests.
 */
export {
	A4_PORTRAIT,
	A4_LANDSCAPE,
	getHandoutGrid,
	computePageCount,
	computePageCells,
	computeHandoutLayout,
	getPrintableArea,
	generateNoteLineCount,
} from 'pptx-viewer-shared';
export type {
	HandoutSlidesPerPage,
	HandoutGrid,
	PageDimensions,
	HandoutCellPosition,
	HandoutPage,
} from 'pptx-viewer-shared';
