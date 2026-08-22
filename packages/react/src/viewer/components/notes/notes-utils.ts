/**
 * notes-utils.ts: the speaker-notes segment/paragraph helpers, from shared.
 *
 * The rich notes editor's maths (segments <-> paragraphs, indent/bullet levels,
 * caret-to-paragraph mapping, the editor constants) is framework-agnostic and
 * lives in `pptx-viewer-shared` (`render/notes/notes-utils`). This module
 * re-exports it so the React notes components keep their import paths, and so
 * the two never drift.
 *
 * `escapeHtml` is the one the shared root exports (from `export/print-document`):
 * a different implementation from the notes module's, but the same five entities,
 * and the render barrel deliberately exports only one of the two names.
 *
 * @module components/notes/notes-utils
 */
export {
	createPlainNotesSegments,
	escapeHtml,
	DEBOUNCE_MS,
	EXPANDED_MAX_HEIGHT,
	getCurrentParagraphIndex,
	INDENT_PX,
	MAX_INDENT_LEVEL,
	normalizeSegments,
	paragraphsToSegments,
	parsePt,
	PX_TO_PT,
	resolveNotesSegments,
	segmentsToParagraphs,
	segmentsToPlainText,
} from 'pptx-viewer-shared';
export type { NotesParagraph } from 'pptx-viewer-shared';
