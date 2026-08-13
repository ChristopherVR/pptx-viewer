import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../../types';
import { notesShapeRole, selectNotesBodyShapes } from './notes-body-shapes';

/** Minimal notes-page `p:sp` carrying a placeholder of the given type. */
function placeholderShape(type: string | undefined, text: string): XmlObject {
	const ph: XmlObject = type === undefined ? {} : { '@_type': type };
	return {
		'p:nvSpPr': {
			'p:cNvPr': { '@_id': '2', '@_name': `${type ?? 'body'} placeholder` },
			'p:cNvSpPr': {},
			'p:nvPr': { 'p:ph': ph },
		},
		'p:txBody': { 'a:p': { 'a:r': { 'a:t': text } } },
	};
}

/** A plain text box drawn on the notes page: no `p:ph` at all. */
function plainShape(text: string): XmlObject {
	return {
		'p:nvSpPr': {
			'p:cNvPr': { '@_id': '9', '@_name': 'TextBox' },
			'p:cNvSpPr': {},
			'p:nvPr': {},
		},
		'p:txBody': { 'a:p': { 'a:r': { 'a:t': text } } },
	};
}

describe('notesShapeRole', () => {
	it('treats the body placeholder as the notes body', () => {
		expect(notesShapeRole(placeholderShape('body', 'notes'))).toBe('body');
	});

	it('treats an omitted @type as body (ST_PlaceholderType defaults to body)', () => {
		expect(notesShapeRole(placeholderShape(undefined, 'notes'))).toBe('body');
	});

	it.each(['sldNum', 'sldImg', 'dt', 'hdr', 'ftr'])(
		'treats the %s placeholder as a notes-page field, not notes text',
		(type) => {
			expect(notesShapeRole(placeholderShape(type, 'x'))).toBe('field');
		},
	);

	it('is case- and whitespace-insensitive about the placeholder type', () => {
		expect(notesShapeRole(placeholderShape(' SLDNUM ', '12'))).toBe('field');
	});

	it('treats a shape with no placeholder as neither body nor field', () => {
		expect(notesShapeRole(plainShape('drawn on the notes page'))).toBe('other');
	});
});

describe('selectNotesBodyShapes', () => {
	it('keeps only the body placeholder when the notes page has one', () => {
		const image = placeholderShape('sldImg', '');
		const body = placeholderShape('body', 'real speaker notes');
		const number = placeholderShape('sldNum', '12');
		expect(selectNotesBodyShapes([image, body, number])).toStrictEqual([body]);
	});

	it('excludes the date, header and footer fields', () => {
		const body = placeholderShape('body', 'real speaker notes');
		const selected = selectNotesBodyShapes([
			placeholderShape('dt', '13/08/2026'),
			body,
			placeholderShape('hdr', 'Confidential'),
			placeholderShape('ftr', 'Acme Corp'),
		]);
		expect(selected).toStrictEqual([body]);
	});

	it('keeps a body placeholder whose text is only a number', () => {
		// The bug this guards was diagnosed as "the slide number leaks into the
		// notes", so filtering on what the text LOOKS like is tempting and
		// wrong: a note that genuinely reads "12" has to survive.
		const body = placeholderShape('body', '12');
		expect(selectNotesBodyShapes([placeholderShape('sldNum', '12'), body])).toStrictEqual([body]);
	});

	it('falls back to non-placeholder shapes when there is no body placeholder', () => {
		const drawn = plainShape('notes in a plain text box');
		expect(selectNotesBodyShapes([placeholderShape('sldNum', '4'), drawn])).toStrictEqual([drawn]);
	});

	it('never falls back to a field placeholder', () => {
		expect(selectNotesBodyShapes([placeholderShape('sldNum', '4')])).toStrictEqual([]);
	});
});
