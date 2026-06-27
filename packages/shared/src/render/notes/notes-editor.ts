/**
 * notes-editor.ts: framework-agnostic DOM command helpers for the rich
 * speaker-notes contentEditable editor, shared by every binding.
 *
 * These wrap the pure paragraph/segment maths in `notes-utils` with the small
 * amount of (framework-neutral) DOM work the toolbar actions need: reading the
 * live editor back into segments, applying a list/indent command at the caret,
 * and inserting a hyperlink at the current selection. The binding owns the
 * editor element ref, the debounce, and the reactive state; it calls these to
 * compute the next segments + plain text without duplicating the logic.
 */

import type { PptxSlide, TextSegment } from 'pptx-viewer-core';

import { safeOpenUrl } from '../hyperlink-security';
import { isMobileViewport } from '../mobile-viewport';
import { parseSegmentsFromRichEditor } from './notes-html';
import type { NotesInlineCommand, NotesParagraph } from './notes-utils';
import {
	MAX_INDENT_LEVEL,
	createPlainNotesSegments,
	getCurrentParagraphIndex,
	normalizeSegments,
	paragraphsToSegments,
	segmentsToParagraphs,
	segmentsToPlainText,
} from './notes-utils';

/** A computed editor snapshot: the segment model plus its plain-text form. */
export interface NotesEditState {
	segments: TextSegment[];
	text: string;
}

/** Paragraph-level toolbar commands. */
export type NotesParagraphCommand = 'bullet' | 'numbered' | 'indent' | 'outdent';

/**
 * The segments to seed an editor for a slide: prefer the slide's rich
 * `notesSegments` (populated on load from the .pptx), else derive plain
 * segments from the `notes` string.
 */
export function resolveNotesSegments(slide: PptxSlide | undefined): TextSegment[] {
	return slide?.notesSegments && slide.notesSegments.length > 0
		? normalizeSegments(slide.notesSegments)
		: createPlainNotesSegments(slide?.notes ?? '');
}

/**
 * Whether the rich editor should be the default surface. Rich on desktop;
 * plain `<textarea>` on a mobile viewport so the on-screen keyboard and caret
 * behave (the documented mobile-notes rationale). The user can still flip it
 * with the toolbar rich/plain toggle.
 */
export function defaultRichEnabled(): boolean {
	if (typeof window === 'undefined') {
		return true;
	}
	const width = window.innerWidth;
	const height = window.innerHeight;
	const isTouch = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
	return !isMobileViewport(width, height, isTouch);
}

/** Read the live contentEditable DOM back into a segment + plain-text snapshot. */
export function readEditorSegments(editorEl: HTMLElement): NotesEditState {
	const segments = parseSegmentsFromRichEditor(editorEl);
	return { segments, text: segmentsToPlainText(segments) };
}

function updateParagraph(para: NotesParagraph, command: NotesParagraphCommand): NotesParagraph {
	switch (command) {
		case 'bullet':
			return { ...para, bulletType: para.bulletType === 'bullet' ? 'none' : 'bullet' };
		case 'numbered':
			return { ...para, bulletType: para.bulletType === 'numbered' ? 'none' : 'numbered' };
		case 'indent':
			return { ...para, indentLevel: Math.min(MAX_INDENT_LEVEL, para.indentLevel + 1) };
		case 'outdent':
			return { ...para, indentLevel: Math.max(0, para.indentLevel - 1) };
	}
}

/**
 * Apply a paragraph-level command (bullet/numbered/indent/outdent) to the
 * paragraph under the caret and return the next segment + plain-text snapshot.
 */
export function applyParagraphCommand(
	editorEl: HTMLElement,
	segments: TextSegment[],
	command: NotesParagraphCommand,
): NotesEditState {
	const paraIdx = getCurrentParagraphIndex(editorEl, segments);
	const paragraphs = segmentsToParagraphs(segments);
	if (paraIdx >= 0 && paraIdx < paragraphs.length) {
		paragraphs[paraIdx] = updateParagraph(paragraphs[paraIdx], command);
	}
	const next = paragraphsToSegments(paragraphs);
	return { segments: next, text: segmentsToPlainText(next) };
}

/** Apply an inline character-format command to the current selection. */
export function applyInlineCommand(command: NotesInlineCommand): void {
	if (typeof document !== 'undefined') {
		document.execCommand(command);
	}
}

/** Normalise a user-entered link URL: bare hosts get an `https://` scheme. */
export function normalizeNotesLinkUrl(url: string): string {
	const trimmed = url.trim();
	return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

/**
 * Insert a hyperlink anchor at the current selection inside the editor.
 * Mirrors React's `handleInsertLink`: the caller has already normalised the URL
 * and focused the editor; this performs the range mutation.
 */
export function insertHyperlinkAtSelection(url: string, displayText: string): void {
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0) {
		return;
	}
	const range = sel.getRangeAt(0);
	range.deleteContents();
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.textContent = displayText;
	anchor.style.color = '#4a9eff';
	anchor.style.textDecoration = 'underline';
	anchor.style.cursor = 'pointer';
	anchor.setAttribute('data-hyperlink', url);
	range.insertNode(anchor);
	range.setStartAfter(anchor);
	range.collapse(true);
	sel.removeAllRanges();
	sel.addRange(range);
}

/**
 * Handle a click on an anchor inside the editor: a plain click edits text, a
 * Ctrl/Cmd+click opens the link through the scheme-allowlisted `safeOpenUrl`
 * so `javascript:` / `data:` hrefs in untrusted notes cannot execute.
 */
export function handleEditorAnchorClick(
	target: EventTarget | null,
	withModifier: boolean,
): boolean {
	if (!(target instanceof HTMLAnchorElement)) {
		return false;
	}
	const href = target.getAttribute('data-hyperlink') || target.getAttribute('href');
	if (href && withModifier) {
		safeOpenUrl(href);
		return true;
	}
	return false;
}
