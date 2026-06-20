/**
 * Notes-page PDF document builder.
 *
 * Assembles the full PDF byte stream for the notes-page layout, combining
 * slide images with wrapped speaker notes text. The pure byte-assembly
 * (`buildNotesPdfBytes`) now lives in `pptx-viewer-shared`
 * (`export/pdf-notes-builder`); only the DOM-bound canvas->JPEG conversion and
 * Blob/object-URL wrapping stay here.
 *
 * @module pdf-builder-notes-builder
 */

import { buildNotesPdfBytes } from 'pptx-viewer-shared';
import type { NotesPageMeta } from 'pptx-viewer-shared';

import type { NotesPageInput } from './pdf-builder-types';

/**
 * Build a PDF with notes pages: each page contains the slide image in the
 * upper 2/3 and speaker notes text in the lower 1/3.
 *
 * Layout follows PowerPoint's "Notes Pages" print layout:
 * - Portrait US Letter (8.5" x 11" / 612 x 792 pt)
 * - Slide image centered in upper portion with a thin border
 * - Notes text wrapped below with Helvetica font
 *
 * If notes text overflows the available space on the primary page,
 * additional continuation pages are emitted with the remaining text
 * and a "Slide N (continued)" header.
 *
 * @param pages - Array of slide canvas + notes pairs.
 * @returns Object URL pointing to the generated PDF blob.
 */
export function buildNotesPdf(pages: NotesPageInput[]): string {
	const images = pages.map((page) => {
		const dataUrl = page.canvas.toDataURL('image/jpeg', 0.92);
		const base64 = dataUrl.split(',')[1] ?? '';
		const raw = atob(base64);
		const bytes = new Uint8Array(raw.length);
		for (let i = 0; i < raw.length; i++) {
			bytes[i] = raw.charCodeAt(i);
		}
		return { bytes, w: page.canvas.width, h: page.canvas.height };
	});

	const meta: NotesPageMeta[] = pages.map((page) => ({
		notes: page.notes,
		slideNumber: page.slideNumber,
	}));

	const bytes = buildNotesPdfBytes(images, meta);
	const blob = new Blob([bytes], { type: 'application/pdf' });
	return URL.createObjectURL(blob);
}
