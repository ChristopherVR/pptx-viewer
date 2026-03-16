/**
 * Notes-page PDF layout calculation and text utilities.
 *
 * Pure functions for calculating page geometry, wrapping text, and
 * building PDF content streams for the notes-page PDF layout.
 * These have no DOM dependencies and are easy to test in isolation.
 *
 * @module pdf-builder-notes-layout
 */

import {
	NOTES_PAGE_W,
	NOTES_PAGE_H,
	NOTES_MARGIN,
	NOTES_SLIDE_FRACTION,
	NOTES_GAP,
	NOTES_FONT_SIZE,
	NOTES_LINE_HEIGHT,
	NOTES_CONTINUATION_HEADER_SIZE,
} from './pdf-builder-types';

/* ------------------------------------------------------------------ */
/*  Notes-page layout calculation (pure, testable)                    */
/* ------------------------------------------------------------------ */

/**
 * Calculate the layout geometry for a single notes page.
 *
 * This is a pure function with no DOM dependencies, making it easy to test.
 *
 * @param slideWidth   - Pixel width of the captured slide canvas.
 * @param slideHeight  - Pixel height of the captured slide canvas.
 * @returns Layout rectangles in PDF points for the slide image and notes area.
 */
export function calculateNotesPageLayout(
	slideWidth: number,
	slideHeight: number,
): {
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
} {
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
 * Wrap a text string into lines that fit within a given width at a given font size.
 *
 * Uses approximate character widths (monospace-ish estimation) since we cannot
 * measure actual glyph widths without a full font engine. This is acceptable for
 * speaker notes which are typically plain text.
 *
 * @param text       - The text to wrap.
 * @param maxWidth   - Maximum line width in PDF points.
 * @param fontSize   - Font size in PDF points.
 * @returns Array of wrapped text lines.
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
	const paragraphs = text.split(/\r?\n/);

	for (const paragraph of paragraphs) {
		if (paragraph.trim().length === 0) {
			lines.push('');
			continue;
		}

		const words = paragraph.split(/\s+/);
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
 * Calculate the maximum number of notes text lines that fit on a
 * continuation page (text-only, no slide image).
 *
 * Continuation pages use the same margins and font settings but the
 * entire content area (minus a small header) is available for text.
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
 *
 * @param text - The raw text string.
 * @returns The escaped string safe for PDF content streams.
 */
export function escapePdfText(text: string): string {
	return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * Build a content stream for notes text lines starting at the given Y position.
 *
 * @param lines - The lines of text to render.
 * @param startY - The Y coordinate where rendering begins (PDF coords).
 * @returns A PDF content stream string.
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
