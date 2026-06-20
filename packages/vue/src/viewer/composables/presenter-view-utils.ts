/**
 * Thin re-export shim → `pptx-viewer-shared` (`render/presenter-view`).
 *
 * The pure presenter-view helpers (time formatting, notes font-size clamping,
 * notes -> render-spec conversion) now live in shared, consumed by every
 * binding. This file preserves the historical Vue import surface so
 * `PresenterView.vue` and the colocated tests are unchanged.
 */

export type { NotesSpan } from 'pptx-viewer-shared';
export {
	NOTES_FONT_SIZE_MIN,
	NOTES_FONT_SIZE_MAX,
	NOTES_FONT_SIZE_STEP,
	NOTES_FONT_SIZE_DEFAULT,
	clampNotesFontSize,
	formatTime,
	formatElapsed,
	notesSegmentsToSpans,
} from 'pptx-viewer-shared';
