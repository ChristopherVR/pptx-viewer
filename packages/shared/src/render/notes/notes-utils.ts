/**
 * notes-utils.ts: framework-agnostic pure helpers for the rich speaker-notes
 * editor, shared by the React, Vue, and Angular bindings.
 *
 * Ported from React's `viewer/components/notes/notes-utils.ts`. Pure TypeScript
 * (no DOM, no framework imports beyond the core `TextSegment` model), so each
 * binding consumes one copy: paragraph/segment conversions, plain-text seeding,
 * normalisation, and the cursor->paragraph index lookup used by list/indent
 * toolbar actions.
 *
 * NOTE: `escapeHtml` is exported for sibling notes modules but intentionally not
 * re-exported through the notes barrel: the shared `export/print-document`
 * module already exports a symbol of the same name.
 */

import type { TextSegment } from 'pptx-viewer-core';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

/** Paragraph metadata derived from segments. */
export interface NotesParagraph {
	segments: TextSegment[];
	bulletType: 'none' | 'bullet' | 'numbered';
	indentLevel: number;
}

/** Which editor surface is active. */
export type NotesEditorMode = 'rich' | 'plain';

/** Inline character-formatting commands handled via `document.execCommand`. */
export type NotesInlineCommand = 'bold' | 'italic' | 'underline' | 'strikeThrough';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

export const DEBOUNCE_MS = 600;
export const EXPANDED_MAX_HEIGHT = 200;
export const PX_TO_PT = 0.75;
export const MAX_INDENT_LEVEL = 4;
export const INDENT_PX = 24;

/* ------------------------------------------------------------------ */
/*  Utility helpers                                                    */
/* ------------------------------------------------------------------ */

export function escapeHtml(value: string): string {
	return value
		.replace(/&/gu, '&amp;')
		.replace(/</gu, '&lt;')
		.replace(/>/gu, '&gt;')
		.replace(/"/gu, '&quot;')
		.replace(/'/gu, '&#39;');
}

export function createPlainNotesSegments(text: string): TextSegment[] {
	const lines = text.split('\n');
	const segments: TextSegment[] = [];
	lines.forEach((line, index) => {
		segments.push({ text: line, style: {} });
		if (index < lines.length - 1) {
			segments.push({ text: '', style: {}, isParagraphBreak: true });
		}
	});
	if (segments.length === 0) {
		segments.push({ text: '', style: {} });
	}
	return segments;
}

export function segmentsToPlainText(segments: TextSegment[]): string {
	return segments.map((segment) => (segment.isParagraphBreak ? '\n' : segment.text)).join('');
}

export function normalizeSegments(segments: TextSegment[]): TextSegment[] {
	const cleaned = segments.filter((segment) => segment.isParagraphBreak || segment.text.length > 0);
	while (cleaned.length > 0 && cleaned[cleaned.length - 1].isParagraphBreak) {
		cleaned.pop();
	}
	return cleaned.length > 0 ? cleaned : [{ text: '', style: {} }];
}

export function parsePt(value: string | undefined): number | undefined {
	if (!value) {
		return undefined;
	}
	const numeric = Number.parseFloat(value);
	if (Number.isNaN(numeric) || !Number.isFinite(numeric)) {
		return undefined;
	}
	if (value.endsWith('px')) {
		return numeric * PX_TO_PT;
	}
	return numeric;
}

/* ------------------------------------------------------------------ */
/*  Paragraph helpers (split segments into paragraphs and back)       */
/* ------------------------------------------------------------------ */

function buildParagraph(segments: TextSegment[]): NotesParagraph {
	const first = segments[0];
	let bulletType: NotesParagraph['bulletType'] = 'none';
	let indentLevel = 0;

	if (first?.bulletInfo) {
		if (first.bulletInfo.char) {
			bulletType = 'bullet';
		} else if (first.bulletInfo.autoNumType) {
			bulletType = 'numbered';
		}
	}
	if (first?.style.paragraphMarginLeft) {
		indentLevel = Math.min(
			MAX_INDENT_LEVEL,
			Math.max(0, Math.round(first.style.paragraphMarginLeft / INDENT_PX)),
		);
	}

	return {
		segments: segments.length > 0 ? segments : [{ text: '', style: {} }],
		bulletType,
		indentLevel,
	};
}

export function segmentsToParagraphs(segments: TextSegment[]): NotesParagraph[] {
	const normalized = normalizeSegments(segments);
	const paragraphs: NotesParagraph[] = [];
	let current: TextSegment[] = [];

	for (const seg of normalized) {
		if (seg.isParagraphBreak) {
			paragraphs.push(buildParagraph(current));
			current = [];
		} else {
			current.push(seg);
		}
	}
	if (current.length > 0) {
		paragraphs.push(buildParagraph(current));
	}
	if (paragraphs.length === 0) {
		paragraphs.push({
			segments: [{ text: '', style: {} }],
			bulletType: 'none',
			indentLevel: 0,
		});
	}
	return paragraphs;
}

export function paragraphsToSegments(paragraphs: NotesParagraph[]): TextSegment[] {
	const result: TextSegment[] = [];
	let numberedCounter = 0;

	paragraphs.forEach((para, pIdx) => {
		if (para.bulletType === 'numbered') {
			numberedCounter++;
		} else {
			numberedCounter = 0;
		}

		para.segments.forEach((seg, sIdx) => {
			const updated: TextSegment = { ...seg, style: { ...seg.style } };

			if (para.indentLevel > 0) {
				updated.style.paragraphMarginLeft = para.indentLevel * INDENT_PX;
			} else {
				delete updated.style.paragraphMarginLeft;
			}

			if (sIdx === 0) {
				if (para.bulletType === 'bullet') {
					updated.bulletInfo = { char: '•' };
				} else if (para.bulletType === 'numbered') {
					updated.bulletInfo = {
						autoNumType: 'arabicPeriod',
						paragraphIndex: numberedCounter - 1,
					};
				} else {
					delete updated.bulletInfo;
				}
			}

			result.push(updated);
		});

		if (pIdx < paragraphs.length - 1) {
			result.push({ text: '', style: {}, isParagraphBreak: true });
		}
	});

	return result;
}

/* ------------------------------------------------------------------ */
/*  Current paragraph index from cursor position                       */
/* ------------------------------------------------------------------ */

export function getCurrentParagraphIndex(editorEl: HTMLElement, segments: TextSegment[]): number {
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0) {
		return 0;
	}
	const range = sel.getRangeAt(0);

	let charOffset = 0;
	const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT);
	let node = walker.nextNode();
	while (node) {
		if (range.startContainer === node) {
			charOffset += range.startOffset;
			break;
		}
		charOffset += (node.textContent ?? '').length;
		node = walker.nextNode();
	}

	let paraIdx = 0;
	let pos = 0;
	for (const seg of segments) {
		if (seg.isParagraphBreak) {
			paraIdx++;
			pos++;
			continue;
		}
		const segLen = seg.text.length;
		if (pos + segLen > charOffset) {
			return paraIdx;
		}
		pos += segLen;
	}
	return paraIdx;
}
