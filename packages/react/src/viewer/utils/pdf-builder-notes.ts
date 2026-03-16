/**
 * Notes-page PDF builder.
 *
 * Generates a PDF with each page containing the slide image in the
 * upper 2/3 and speaker notes text in the lower 1/3, following
 * PowerPoint's "Notes Pages" print layout.
 *
 * Implementation is split across focused sub-modules:
 * - `pdf-builder-notes-layout` -- Layout calculation, text wrapping, PDF text utilities
 * - `pdf-builder-notes-builder` -- Full PDF document assembly
 *
 * @module pdf-builder-notes
 */

// Layout calculation and text utilities
export {
	calculateNotesPageLayout,
	wrapNotesText,
	calculateContinuationPageMaxLines,
	escapePdfText,
	buildNotesTextStream,
} from './pdf-builder-notes-layout';

// PDF document builder
export { buildNotesPdf } from './pdf-builder-notes-builder';
