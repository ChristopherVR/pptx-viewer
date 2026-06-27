/**
 * notes-print.ts: framework-agnostic "Print speaker notes" document builder.
 *
 * Ported from React's `NotesPrintDialog.handlePrint`. Builds the full HTML
 * document string (one page per slide: header, placeholder thumbnail, bulleted
 * /numbered/indented notes) that each binding writes into a hidden print
 * iframe or a `window.open` document before calling `print()`.
 */

import type { PptxSlide } from 'pptx-viewer-core';

import { resolveNotesSegments } from './notes-editor';
import { escapeHtml, segmentsToParagraphs } from './notes-utils';

const PRINT_STYLES = `
	body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #222; }
	.slide-page { page-break-after: always; margin-bottom: 40px; }
	.slide-page:last-child { page-break-after: auto; }
	.slide-header { font-size: 14px; font-weight: bold; margin-bottom: 12px; color: #555; }
	.slide-thumb { width: 100%; max-width: 600px; aspect-ratio: 16/9; background: #f0f0f0;
		border: 1px solid #ccc; display: flex; align-items: center; justify-content: center;
		color: #999; font-size: 24px; margin-bottom: 16px; }
	.notes-text { font-size: 12px; line-height: 1.6; white-space: pre-wrap; }
	.notes-text .para { margin: 2px 0; }
	@media print { body { padding: 0; } }
`;

/**
 * Build the printable notes document for every slide.
 *
 * @param slides    the presentation slides, in order.
 * @param slideLabel maps a 1-based slide number to its display label, so the
 *                   caller can localise "Slide N" / "Folie N" / etc.
 */
export function buildNotesPrintHtml(
	slides: PptxSlide[],
	slideLabel: (slideNumber: number) => string,
): string {
	const pages = slides
		.map((slide) => {
			const paras = segmentsToParagraphs(resolveNotesSegments(slide));
			const label = escapeHtml(slideLabel(slide.slideNumber));

			let numCounter = 0;
			const body = paras
				.map((para) => {
					if (para.bulletType === 'numbered') {
						numCounter++;
					} else {
						numCounter = 0;
					}

					const indent = para.indentLevel * 24;
					let prefix = '';
					if (para.bulletType === 'bullet') {
						prefix = '• ';
					} else if (para.bulletType === 'numbered') {
						prefix = `${numCounter}. `;
					}

					const text = para.segments
						.filter((s) => !s.isParagraphBreak)
						.map((s) => escapeHtml(s.text))
						.join('');

					return `<div class="para" style="padding-left:${indent}px">${escapeHtml(prefix)}${text}</div>`;
				})
				.join('');

			return `<div class="slide-page"><div class="slide-header">${label}</div><div class="slide-thumb">${label}</div><div class="notes-text">${body}</div></div>`;
		})
		.join('');

	return `<!DOCTYPE html><html><head><style>${PRINT_STYLES}</style></head><body>${pages}</body></html>`;
}
