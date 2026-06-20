/**
 * Pure PDF page-size / file-name helpers shared by every binding's image+PDF
 * export. No DOM, no jsPDF, no html2canvas.
 *
 * All page-size values are in points (pt), the unit jsPDF uses natively
 * (1 pt = 1/72 inch). The slide pixel dimensions passed in are treated as a
 * logical size for aspect-ratio maths only; the resulting PDF pages are scaled
 * to fit within standard A4.
 */

/** A4 dimensions in points (pt). */
const A4_PT_W = 841.89;
const A4_PT_H = 595.28;

/**
 * Determine jsPDF page orientation from the slide's pixel width and height.
 * `w > h` is landscape; otherwise portrait.
 */
export function pdfOrientation(w: number, h: number): 'landscape' | 'portrait' {
	return w > h ? 'landscape' : 'portrait';
}

/**
 * Compute the jsPDF page dimensions (in pt) for the slide, preserving the slide
 * aspect ratio within A4 bounds. The returned `{ width, height }` are the
 * MediaBox dimensions to pass to `new jsPDF({ unit: 'pt', format: [w, h] })`.
 *
 * @param w - Slide canvas width in pixels.
 * @param h - Slide canvas height in pixels.
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

/**
 * Sanitize a file-name by replacing characters that are unsafe on Windows,
 * macOS, and Linux file systems with an underscore. Stripped characters:
 * `\ / : * ? " < > |` and ASCII control codes (0-31).
 */
export function sanitizeFileName(name: string): string {
	// eslint-disable-next-line no-control-regex
	return name.replace(/[\\/:*?"<>|\x00-\x1F]/gu, '_');
}

/**
 * Build a per-slide file name from a base name, 1-based slide index, and
 * extension (without the leading dot).
 */
export function slideFileName(baseName: string, index: number, ext: string): string {
	return `${baseName}-${index}.${ext}`;
}
