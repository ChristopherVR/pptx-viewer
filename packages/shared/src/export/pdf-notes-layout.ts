/**
 * Pure notes-page PDF layout calculation, text wrapping, and content-stream
 * helpers — shared by every binding's PDF export path.
 *
 * These functions have no DOM dependency: they compute page geometry (in PDF
 * points), wrap plain-text speaker notes, and emit PDF content-stream fragments.
 * The binding owns canvas→JPEG conversion and the final `Blob`/object-URL.
 */

/* ------------------------------------------------------------------ */
/*  Layout constants (US Letter portrait, 8.5" x 11")                 */
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

/** Pre-converted image data for PDF embedding. */
export interface PdfImageData {
	/** Raw JPEG bytes. */
	bytes: Uint8Array;
	/** Image pixel width. */
	w: number;
	/** Image pixel height. */
	h: number;
}

/** Computed geometry for a single notes page (all values in PDF points). */
export interface NotesPdfPageLayout {
	/** Available content width (page minus margins). */
	contentWidth: number;
	/** Available content height (page minus margins). */
	contentHeight: number;
	/** Height allocated to the slide image area. */
	slideAreaHeight: number;
	/** Height allocated to the notes text area. */
	notesAreaHeight: number;
	/** Rendered slide image width (aspect-ratio preserved). */
	imageWidth: number;
	/** Rendered slide image height (aspect-ratio preserved). */
	imageHeight: number;
	/** X position of the slide image (centered). */
	imageX: number;
	/** Y position of the slide image (PDF coords, origin at bottom-left). */
	imageY: number;
	/** Y position where notes text starts (PDF coords, origin at bottom-left). */
	notesTextY: number;
	/** Maximum number of notes text lines that fit. */
	maxNotesLines: number;
}

/* ------------------------------------------------------------------ */
/*  Layout calculation                                                 */
/* ------------------------------------------------------------------ */

/**
 * Calculate the layout geometry for a single notes page.
 *
 * @param slideWidth Pixel width of the captured slide canvas.
 * @param slideHeight Pixel height of the captured slide canvas.
 */
export function calculateNotesPageLayout(
	slideWidth: number,
	slideHeight: number,
): NotesPdfPageLayout {
	const contentWidth = NOTES_PAGE_W - 2 * NOTES_MARGIN;
	const contentHeight = NOTES_PAGE_H - 2 * NOTES_MARGIN;
	const slideAreaHeight = contentHeight * NOTES_SLIDE_FRACTION;
	const notesAreaHeight = contentHeight - slideAreaHeight - NOTES_GAP;

	// Fit slide image within the slide area, preserving aspect ratio
	const scale = Math.min(contentWidth / slideWidth, slideAreaHeight / slideHeight);
	const imageWidth = slideWidth * scale;
	const imageHeight = slideHeight * scale;

	// Center the image horizontally within content area
	const imageX = NOTES_MARGIN + (contentWidth - imageWidth) / 2;

	// Position image at top of content area (PDF y-axis: bottom = 0)
	const slideAreaTop = NOTES_PAGE_H - NOTES_MARGIN;
	const imageY = slideAreaTop - imageHeight;

	// Notes text starts below the slide area + gap
	const notesTextY = imageY - NOTES_GAP;

	// Calculate maximum lines that fit in the notes area
	const lineHeightPt = NOTES_FONT_SIZE * NOTES_LINE_HEIGHT;
	const maxNotesLines = Math.floor(notesAreaHeight / lineHeightPt);

	return {
		contentWidth,
		contentHeight,
		slideAreaHeight,
		notesAreaHeight,
		imageWidth,
		imageHeight,
		imageX,
		imageY,
		notesTextY,
		maxNotesLines,
	};
}

/**
 * Wrap a text string into lines that fit within a given width at a given font
 * size, using approximate Helvetica character widths (acceptable for plain
 * speaker notes).
 */
export function wrapNotesText(text: string, maxWidth: number, fontSize: number): string[] {
	if (!text || text.trim().length === 0) {
		return [];
	}

	// Approximate average character width as 0.5 x fontSize for Helvetica
	const avgCharWidth = fontSize * 0.5;
	const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);

	if (maxCharsPerLine <= 0) {
		return [];
	}

	const lines: string[] = [];
	// Split on explicit newlines first
	const paragraphs = text.split(/\r?\n/u);

	for (const paragraph of paragraphs) {
		if (paragraph.trim().length === 0) {
			lines.push('');
			continue;
		}

		const words = paragraph.split(/\s+/u);
		let currentLine = '';

		for (const word of words) {
			if (currentLine.length === 0) {
				currentLine = word;
			} else if (currentLine.length + 1 + word.length <= maxCharsPerLine) {
				currentLine += ` ${word}`;
			} else {
				lines.push(currentLine);
				currentLine = word;
			}
		}

		if (currentLine.length > 0) {
			lines.push(currentLine);
		}
	}

	return lines;
}

/**
 * Calculate the maximum number of notes text lines that fit on a continuation
 * page (text-only, no slide image).
 */
export function calculateContinuationPageMaxLines(): number {
	const contentHeight = NOTES_PAGE_H - 2 * NOTES_MARGIN;
	// Reserve space for the "Slide N (continued)" header + gap
	const headerReserve = NOTES_CONTINUATION_HEADER_SIZE + NOTES_GAP;
	const availableHeight = contentHeight - headerReserve;
	const lineHeightPt = NOTES_FONT_SIZE * NOTES_LINE_HEIGHT;
	return Math.floor(availableHeight / lineHeightPt);
}

/**
 * Escape special PDF text characters in a string for use in Tj operators.
 */
export function escapePdfText(text: string): string {
	return text.replace(/\\/gu, '\\\\').replace(/\(/gu, '\\(').replace(/\)/gu, '\\)');
}

/**
 * Build a content stream for notes text lines starting at the given Y position.
 */
export function buildNotesTextStream(lines: string[], startY: number): string {
	if (lines.length === 0) {
		return '';
	}

	const lineHeightPt = NOTES_FONT_SIZE * NOTES_LINE_HEIGHT;
	let content = `BT /F1 ${NOTES_FONT_SIZE} Tf 0 0 0 rg `;
	content += `${NOTES_MARGIN} ${startY.toFixed(2)} Td `;

	for (let li = 0; li < lines.length; li++) {
		const line = lines[li];
		if (li === 0) {
			content += `(${escapePdfText(line)}) Tj `;
		} else {
			content += `0 ${(-lineHeightPt).toFixed(2)} Td (${escapePdfText(line)}) Tj `;
		}
	}
	content += 'ET\n';
	return content;
}
