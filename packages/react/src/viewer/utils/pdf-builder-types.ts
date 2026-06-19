/**
 * Types and layout constants for PDF export.
 *
 * The notes-page point-geometry constants and the `PdfImageData` shape are
 * shared across bindings and now live in `pptx-viewer-shared`
 * (`export/pdf-notes-layout`); they are re-exported here to preserve the
 * historical import path. The PDF-mode / capture-input types below are
 * React-binding specific (they reference DOM `HTMLCanvasElement`).
 *
 * @module pdf-builder-types
 */

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
} from 'pptx-viewer-shared';
export type { PdfImageData } from 'pptx-viewer-shared';

/**
 * PDF layout mode for export.
 *
 * - `'slides'`   -- landscape pages, one slide image per page (default)
 * - `'notes'`    -- portrait pages, slide image in top 2/3 with notes text below
 * - `'handouts'` -- reserved for future handout layouts (2/3/4/6 slides per page)
 */
export type PdfLayoutMode = 'slides' | 'notes' | 'handouts';

/** Slide data paired with its speaker notes for notes-page PDF export. */
export interface NotesPageInput {
	/** Captured slide canvas (JPEG-encoded internally). */
	canvas: HTMLCanvasElement;
	/** Plain-text speaker notes for this slide (may be empty/undefined). */
	notes?: string;
	/** One-based slide number for the header. */
	slideNumber: number;
}
