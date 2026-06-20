/**
 * Notes-page PDF layout / text helpers: thin re-export shim.
 *
 * The pure point-geometry calculation, text wrapping, PDF content-stream
 * fragments, and escaping live once in `pptx-viewer-shared`
 * (`export/pdf-notes-layout`). This module preserves the historical import
 * path for the React PDF builder and its tests.
 *
 * @module pdf-builder-notes-layout
 */
export {
	calculateNotesPageLayout,
	wrapNotesText,
	calculateContinuationPageMaxLines,
	escapePdfText,
	buildNotesTextStream,
} from 'pptx-viewer-shared';
export type { NotesPdfPageLayout } from 'pptx-viewer-shared';
