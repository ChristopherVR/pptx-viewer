/**
 * Rich speaker-notes editor: framework-agnostic logic shared by the React, Vue,
 * and Angular bindings. The contentEditable view layer + reactive wiring stays
 * per binding; everything here (segment/paragraph maths, HTML serialise/parse,
 * caret-aware toolbar commands, print document) is pure or framework-neutral
 * DOM.
 *
 * `escapeHtml` is intentionally NOT re-exported here: the shared
 * `export/print-document` module already exports that name and a duplicate star
 * export would make it ambiguous. Notes modules import it directly.
 */

export type { NotesParagraph, NotesEditorMode, NotesInlineCommand } from './notes-utils';
export {
	DEBOUNCE_MS,
	EXPANDED_MAX_HEIGHT,
	PX_TO_PT,
	MAX_INDENT_LEVEL,
	INDENT_PX,
	createPlainNotesSegments,
	segmentsToPlainText,
	normalizeSegments,
	parsePt,
	segmentsToParagraphs,
	paragraphsToSegments,
	getCurrentParagraphIndex,
} from './notes-utils';
export { segmentsToEditorHtml, parseSegmentsFromRichEditor } from './notes-html';
export type { NotesEditState, NotesParagraphCommand } from './notes-editor';
export {
	resolveNotesSegments,
	defaultRichEnabled,
	readEditorSegments,
	applyParagraphCommand,
	applyInlineCommand,
	normalizeNotesLinkUrl,
	insertHyperlinkAtSelection,
	handleEditorAnchorClick,
} from './notes-editor';
export { buildNotesPrintHtml } from './notes-print';
