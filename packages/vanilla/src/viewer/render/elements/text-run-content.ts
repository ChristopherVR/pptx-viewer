import type { ParagraphRun } from 'pptx-viewer-shared';

import { createEl } from '../dom';

/**
 * Append a run's text content into `host`, honouring shared's per-script font
 * split (`run.scriptRuns`) and measured tab-stop layout (`run.tabLines`) when
 * either is present.
 *
 * Both descriptors come from `pptx-viewer-shared`'s `buildParagraphs` (the
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
	if (run.scriptRuns) {
		appendScriptRuns(doc, host, run.scriptRuns);
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
			const textSpan = createEl(doc, 'span', undefined, piece.style);
			textSpan.textContent = piece.text;
			lineHost.appendChild(textSpan);
		}
		host.appendChild(lineHost);
		if (li < lines.length - 1) {
			host.appendChild(doc.createElement('br'));
		}
	});
}

function appendScriptRuns(
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
