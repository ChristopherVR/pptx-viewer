import type { ParagraphRun } from 'pptx-viewer-shared';

import { createEl } from '../dom';

/**
 * Append a run's text content into `host`, honouring shared's per-script font
 * split (`run.scriptRuns`), measured tab-stop layout (`run.tabLines`) and
 * `u="words"` per-word underline pieces (`run.underlineWordPieces`, a ruby
 * run; `piece.words`, a tab piece) when any is present.
 *
 * The descriptors come from `pptx-viewer-shared`'s `buildParagraphs` (the
 * per-script split was React-only before this helper existed: CJK, Arabic,
 * Hebrew and Thai text rendered in the wrong typeface here; the tab layout was
 * likewise React-only, so a TOC-style row lost its leader dots and right-
 * aligned page number). Used for the run's span / anchor / ruby base text, so
 * all three carry the same content logic.
 */
export function appendRunContent(doc: Document, host: HTMLElement, run: ParagraphRun): void {
	if (run.tabLines) {
		appendTabLines(doc, host, run.tabLines);
		return;
	}
	const pieces = run.scriptRuns ?? run.underlineWordPieces;
	if (pieces) {
		appendStyledPieces(doc, host, pieces);
		return;
	}
	host.appendChild(doc.createTextNode(run.text));
}

function appendTabLines(
	doc: Document,
	host: HTMLElement,
	lines: NonNullable<ParagraphRun['tabLines']>,
): void {
	lines.forEach((line, li) => {
		const lineHost = createEl(doc, 'span', undefined, {
			display: 'inline-block',
			whiteSpace: 'nowrap',
		});
		for (const piece of line.pieces) {
			if (piece.leaderStyle) {
				const leader = createEl(doc, 'span', undefined, piece.leaderStyle);
				leader.setAttribute('aria-hidden', 'true');
				leader.textContent = piece.leaderText ?? '';
				lineHost.appendChild(leader);
			}
			// `u="words"`: one sibling span per word/gap in place of the piece span.
			for (const word of piece.words ?? [piece]) {
				const textSpan = createEl(doc, 'span', undefined, word.style);
				textSpan.textContent = word.text;
				lineHost.appendChild(textSpan);
			}
		}
		host.appendChild(lineHost);
		if (li < lines.length - 1) {
			host.appendChild(doc.createElement('br'));
		}
	});
}

function appendStyledPieces(
	doc: Document,
	host: HTMLElement,
	pieces: NonNullable<ParagraphRun['scriptRuns']>,
): void {
	for (const piece of pieces) {
		if (piece.style) {
			const span = createEl(doc, 'span', undefined, piece.style);
			span.textContent = piece.text;
			host.appendChild(span);
		} else {
			host.appendChild(doc.createTextNode(piece.text));
		}
	}
}
