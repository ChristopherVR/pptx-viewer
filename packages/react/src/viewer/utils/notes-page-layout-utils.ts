/**
 * Notes-page layout calculations: thin re-export shim.
 *
 * The pure per-slide notes-page geometry (mm) lives once in
 * `pptx-viewer-shared` (`export/notes-page-layout`). This module preserves the
 * historical import path for React consumers/components/tests.
 */
export {
	computeNotesPageLayout,
	computeAllNotesPages,
	getNotesPrintableArea,
} from 'pptx-viewer-shared';
export type { NotesPageSlideArea, NotesPageTextArea, NotesPageData } from 'pptx-viewer-shared';
