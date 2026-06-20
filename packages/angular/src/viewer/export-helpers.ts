/**
 * Pure export helper utilities: no Angular, no DOM, no jsPDF, no html2canvas.
 *
 * These are extracted from the service so that they can be unit-tested in
 * isolation and potentially reused by other parts of the package.
 *
 * All page-size values are in **points (pt)**: the unit used natively by
 * jsPDF. 1 pt = 1/72 inch. The slide pixel dimensions passed in are treated
 * as a logical size for aspect-ratio maths only; the resulting PDF pages are
 * scaled to fit within standard A4.
 */

/* ------------------------------------------------------------------ */
/*  Orientation helpers                                                 */
/* ------------------------------------------------------------------ */

/**
 * Determine jsPDF page orientation from the slide's pixel width and height.
 *
 * - If `w > h` → `'landscape'`
 * - If `w <= h` → `'portrait'`
 *
 * @param w - Slide canvas width in pixels (or any consistent unit).
 * @param h - Slide canvas height in pixels (or any consistent unit).
 */
export function pdfOrientation(w: number, h: number): 'landscape' | 'portrait' {
	return w > h ? 'landscape' : 'portrait';
}

/* ------------------------------------------------------------------ */
/*  Page-size helper                                                    */
/* ------------------------------------------------------------------ */

/** A4 dimensions in points (pt). */
const A4_PT_W = 841.89;
const A4_PT_H = 595.28;

/**
 * Compute the jsPDF page dimensions (in **pt**) for the slide, preserving the
 * slide aspect ratio within A4 bounds.
 *
 * The returned `{ width, height }` are the MediaBox dimensions to pass to
 * `new jsPDF({ unit: 'pt', format: [width, height] })`.  The orientation
 * field mirrors {@link pdfOrientation}.
 *
 * When the slide is landscape (`w > h`):
 *   - page width  = A4 landscape width  (841.89 pt)
 *   - page height = A4 landscape height (595.28 pt)
 * When portrait:
 *   - page width  = A4 portrait width   (595.28 pt)
 *   - page height = A4 portrait height  (841.89 pt)
 *
 * @param w - Slide canvas width in pixels.
 * @param h - Slide canvas height in pixels.
 * @returns `{ width, height, orientation }` all in pt.
 */
export function pdfPageSize(
	w: number,
	h: number,
): { width: number; height: number; orientation: 'landscape' | 'portrait' } {
	const orientation = pdfOrientation(w, h);
	if (orientation === 'landscape') {
		return { width: A4_PT_W, height: A4_PT_H, orientation };
	}
	return { width: A4_PT_H, height: A4_PT_W, orientation };
}

/* ------------------------------------------------------------------ */
/*  File-name helpers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Sanitize a file-name by replacing characters that are unsafe on Windows,
 * macOS, and Linux file systems with an underscore.
 *
 * Stripped characters: `\ / : * ? " < > |` and ASCII control codes (0–31).
 *
 * @param name - Raw file name (may include path-unsafe chars).
 * @returns Sanitized file name safe for all major operating systems.
 */
export function sanitizeFileName(name: string): string {
	// eslint-disable-next-line no-control-regex
	return name.replace(/[\\/:*?"<>|\x00-\x1F]/gu, '_');
}

/**
 * Build a per-slide file name from a base name, 1-based slide index, and
 * extension.
 *
 * @example
 * slideFileName('deck', 2, 'png')  // → 'deck-2.png'
 * slideFileName('my deck!', 3, 'pdf') // → 'my deck!-3.pdf'  (sanitize separately if needed)
 *
 * @param baseName - Presentation base name (without extension).
 * @param index    - 1-based slide number.
 * @param ext      - File extension **without** the leading dot.
 * @returns Composed file name string.
 */
export function slideFileName(baseName: string, index: number, ext: string): string {
	return `${baseName}-${index}.${ext}`;
}
