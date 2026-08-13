import type { XmlObject } from '../../types';

/**
 * `ST_PlaceholderType` values that a notes page legitimately carries but which
 * are NOT speaker notes: the slide thumbnail, the slide-number field, the date
 * field, and the header/footer fields. Everything a notes master defines other
 * than the notes body lives here.
 */
const NON_BODY_NOTES_PLACEHOLDERS = new Set(['sldimg', 'sldnum', 'dt', 'hdr', 'ftr']);

/** Classification of one `p:sp` on a notes page. */
export type NotesShapeRole = 'body' | 'field' | 'other';

/**
 * Read `p:sp/p:nvSpPr/p:nvPr/p:ph/@type` and say what the shape is for.
 *
 * `body` is returned for the notes body placeholder, including the case where
 * `a:ph` omits `@type`: ECMA-376 defaults `ST_PlaceholderType` to `body`, so a
 * bare `<p:ph idx="1"/>` on a notes page IS the notes body.
 *
 * `field` is any of the notes page's non-body placeholders (see
 * {@link NON_BODY_NOTES_PLACEHOLDERS}); `other` is a shape with no placeholder
 * at all, e.g. a text box somebody drew on the notes page, or a placeholder
 * type that has no business on a notes page.
 */
export function notesShapeRole(shape: XmlObject | undefined): NotesShapeRole {
	const placeholder = (
		(shape?.['p:nvSpPr'] as XmlObject | undefined)?.['p:nvPr'] as XmlObject | undefined
	)?.['p:ph'] as XmlObject | undefined;
	if (placeholder === undefined || placeholder === null) {
		return 'other';
	}
	const rawType = placeholder['@_type'];
	const placeholderType = String(rawType ?? '')
		.trim()
		.toLowerCase();
	if (placeholderType === '' || placeholderType === 'body') {
		return 'body';
	}
	return NON_BODY_NOTES_PLACEHOLDERS.has(placeholderType) ? 'field' : 'other';
}

/**
 * Pick the shapes on a notes page whose text is the slide's speaker notes.
 *
 * Only the body placeholder holds speaker notes. Merging every shape's text
 * (the previous behaviour) swept the `sldNum` field in, so a slide with EMPTY
 * notes loaded as `notes === "12"` and the save side then wrote that string
 * into the notes body: after one round-trip PowerPoint reported
 * `NotesPage.Shapes(2).TextFrame.TextRange.Text === "12"` for a slide whose
 * notes the author had never touched. The date, header and footer fields
 * bled in exactly the same way.
 *
 * Filtering by placeholder type rather than by what the text looks like is
 * deliberate: a note whose real text is "12" must survive.
 *
 * A notes page with no body placeholder at all falls back to its
 * non-placeholder shapes, which mirrors the save side
 * (`updateNotesXmlText` prefers `body`, then the first shape with a text body)
 * so parse and save agree on which shape carries the notes.
 */
export function selectNotesBodyShapes(shapes: XmlObject[]): XmlObject[] {
	const bodyShapes = shapes.filter((shape) => notesShapeRole(shape) === 'body');
	if (bodyShapes.length > 0) {
		return bodyShapes;
	}
	return shapes.filter((shape) => notesShapeRole(shape) === 'other');
}
