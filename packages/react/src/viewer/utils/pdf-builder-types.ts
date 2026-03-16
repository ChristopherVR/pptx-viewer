/**
 * Types and layout constants for PDF export.
 *
 * @module pdf-builder-types
 */

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

/** Pre-converted image data for PDF embedding. */
export interface PdfImageData {
	/** Raw JPEG bytes. */
	bytes: Uint8Array;
	/** Image pixel width. */
	w: number;
	/** Image pixel height. */
	h: number;
}

/* ------------------------------------------------------------------ */
/*  Notes-page layout constants (US Letter portrait, 8.5" x 11")     */
/* ------------------------------------------------------------------ */

/** US Letter portrait width in PDF points (8.5 x 72). */
export const NOTES_PAGE_W = 612;
/** US Letter portrait height in PDF points (11 x 72). */
export const NOTES_PAGE_H = 792;
/** Page margin in points. */
export const NOTES_MARGIN = 36; // 0.5 inch
/** Fraction of the usable height allocated to the slide image area. */
export const NOTES_SLIDE_FRACTION = 2 / 3;
/** Gap between slide image area and notes text in points. */
export const NOTES_GAP = 18;
/** Font size for notes text in points. */
export const NOTES_FONT_SIZE = 11;
/** Line height multiplier for notes text. */
export const NOTES_LINE_HEIGHT = 1.4;
/** Border width around the slide image in points. */
export const NOTES_BORDER_WIDTH = 0.5;
/** Font size for the continuation page header in points. */
export const NOTES_CONTINUATION_HEADER_SIZE = 9;
