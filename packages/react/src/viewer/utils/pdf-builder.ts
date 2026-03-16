/**
 * PDF export builders for slide presentations.
 *
 * This file is the public API facade. Implementation is split across:
 * - `pdf-builder-types.ts` -- shared types and layout constants
 * - `pdf-builder-notes.ts` -- notes-page PDF builder with text wrapping
 * - `pdf-builder-slides.ts` -- slides-only PDF builder and canvas conversion
 *
 * @module pdf-builder
 */

// Re-export types and constants
export type { PdfLayoutMode, NotesPageInput, PdfImageData } from './pdf-builder-types';
export {
	NOTES_PAGE_W,
	NOTES_PAGE_H,
	NOTES_MARGIN,
	NOTES_SLIDE_FRACTION,
	NOTES_GAP,
	NOTES_FONT_SIZE,
	NOTES_LINE_HEIGHT,
	NOTES_BORDER_WIDTH,
	NOTES_CONTINUATION_HEADER_SIZE,
} from './pdf-builder-types';

// Re-export notes-page layout and builder
export {
	calculateNotesPageLayout,
	wrapNotesText,
	calculateContinuationPageMaxLines,
	buildNotesPdf,
} from './pdf-builder-notes';

// Re-export slides PDF builder and canvas helper
export {
	canvasToJpegData,
	buildPdfFromImageData,
	buildPdfFromCanvases,
} from './pdf-builder-slides';
