/**
 * Tests for the REAL `updateNotesXmlText` on `PptxHandlerRuntime`: notes body
 * shape selection, stale-segment handling, and paragraph-scope preservation.
 *
 * This file used to reimplement each of those rules as a local helper and test
 * the copy, which proved nothing about the shipped code. It now drives the
 * production method through a subclass that only widens its visibility.
 */
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';

import type { TextSegment, XmlObject } from '../../types';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';

class NotesRuntime extends PptxHandlerRuntime {
	public updateNotes(
		notesXmlObj: XmlObject,
		notesText: string | undefined,
		notesSegments?: TextSegment[],
	): boolean {
		return this.updateNotesXmlText(notesXmlObj, notesText, notesSegments);
	}
}

const runtime = new NotesRuntime();

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	parseAttributeValue: false,
	parseTagValue: false,
});
const builder = new XMLBuilder({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	suppressEmptyNode: false,
});

/**
 * The `a:pPr` PowerPoint writes on a notes body paragraph. Taken verbatim from
 * `ppt/notesSlides/notesSlide1.xml` of `e2e/fixtures/solution-explorer.pptx`,
 * whose 11 attributes a no-edit round-trip reduced to zero.
 */
const AUTHORED_NOTES_PPR = [
	'<a:pPr marL="0" marR="0" lvl="0" indent="0" algn="l" defTabSz="914400" rtl="0"',
	' eaLnBrk="1" fontAlgn="auto" latinLnBrk="0" hangingPunct="1">',
	'<a:lnSpc><a:spcPct val="100000"/></a:lnSpc>',
	'<a:spcBef><a:spcPts val="0"/></a:spcBef>',
	'<a:spcAft><a:spcPts val="0"/></a:spcAft>',
	'<a:buClrTx/><a:buSzTx/><a:buFontTx/><a:buNone/><a:tabLst/><a:defRPr/>',
	'</a:pPr>',
].join('');

function notesPart(bodyParagraphs: string, extraShapes = ''): XmlObject {
	return parser.parse(
		[
			'<p:notes><p:cSld><p:spTree>',
			'<p:sp><p:nvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>',
			`<p:txBody><a:bodyPr/><a:lstStyle/>${bodyParagraphs}</p:txBody></p:sp>`,
			extraShapes,
			'</p:spTree></p:cSld></p:notes>',
		].join(''),
	) as XmlObject;
}

function bodyTxBody(notesXml: XmlObject): XmlObject {
	const spTree = (
		((notesXml['p:notes'] as XmlObject)['p:cSld'] as XmlObject)['p:spTree'] as XmlObject
	)['p:sp'];
	const shapes = Array.isArray(spTree) ? (spTree as XmlObject[]) : [spTree as XmlObject];
	return shapes[0]['p:txBody'] as XmlObject;
}

function bodyXml(notesXml: XmlObject): string {
	return builder.build(bodyTxBody(notesXml)) as string;
}

function paragraphsOf(notesXml: XmlObject): XmlObject[] {
	const paragraphs = bodyTxBody(notesXml)['a:p'];
	return Array.isArray(paragraphs) ? (paragraphs as XmlObject[]) : [paragraphs as XmlObject];
}

describe('updateNotesXmlText paragraph-scope preservation', () => {
	it('keeps every authored a:pPr attribute when the notes text is unchanged', () => {
		const notesXml = notesPart(
			`<a:p>${AUTHORED_NOTES_PPR}<a:r><a:rPr lang="en-GB"/><a:t>Speaker note</a:t></a:r>` +
				'<a:endParaRPr lang="en-GB" dirty="0"/></a:p>',
		);

		expect(runtime.updateNotes(notesXml, 'Speaker note', undefined)).toBeTruthy();

		const pPr = paragraphsOf(notesXml)[0]['a:pPr'] as XmlObject;
		expect(pPr['@_marL']).toBe('0');
		expect(pPr['@_algn']).toBe('l');
		expect(pPr['@_defTabSz']).toBe('914400');
		expect(pPr['@_eaLnBrk']).toBe('1');
		expect(pPr['@_fontAlgn']).toBe('auto');
		expect(pPr['@_latinLnBrk']).toBe('0');
		expect(pPr['@_hangingPunct']).toBe('1');
		expect(pPr['a:lnSpc']).toStrictEqual({ 'a:spcPct': { '@_val': '100000' } });
		expect(pPr['a:buNone']).toBeDefined();
	});

	it('keeps the authored a:pPr when the notes text itself was edited', () => {
		const notesXml = notesPart(
			`<a:p>${AUTHORED_NOTES_PPR}<a:r><a:rPr lang="en-GB"/><a:t>Old</a:t></a:r></a:p>`,
		);

		runtime.updateNotes(notesXml, 'A rewritten speaker note', undefined);

		const paragraph = paragraphsOf(notesXml)[0];
		expect((paragraph['a:pPr'] as XmlObject)['@_hangingPunct']).toBe('1');
		expect(bodyXml(notesXml)).toContain('A rewritten speaker note');
	});

	it('keeps the authored proofing language instead of stamping en-US', () => {
		const notesXml = notesPart(
			`<a:p>${AUTHORED_NOTES_PPR}<a:r><a:rPr lang="en-GB"/><a:t>Note</a:t></a:r>` +
				'<a:endParaRPr lang="en-GB" dirty="0"/></a:p>',
		);

		runtime.updateNotes(notesXml, 'Note', undefined);

		expect(paragraphsOf(notesXml)[0]['a:endParaRPr']).toStrictEqual({
			'@_lang': 'en-GB',
			'@_dirty': '0',
		});
	});

	it('preserves each paragraph a:pPr independently across a multi-paragraph body', () => {
		const notesXml = notesPart(
			'<a:p><a:pPr algn="l" marL="0"/><a:r><a:t>first</a:t></a:r></a:p>' +
				'<a:p><a:pPr algn="ctr" marL="457200"/><a:r><a:t>second</a:t></a:r></a:p>',
		);

		runtime.updateNotes(notesXml, 'first\nsecond', undefined);

		const paragraphs = paragraphsOf(notesXml);
		expect(paragraphs).toHaveLength(2);
		expect((paragraphs[0]['a:pPr'] as XmlObject)['@_algn']).toBe('l');
		expect((paragraphs[1]['a:pPr'] as XmlObject)['@_algn']).toBe('ctr');
		expect((paragraphs[1]['a:pPr'] as XmlObject)['@_marL']).toBe('457200');
	});

	it('leaves an added paragraph with no borrowed properties', () => {
		const notesXml = notesPart('<a:p><a:pPr algn="ctr"/><a:r><a:t>first</a:t></a:r></a:p>');

		runtime.updateNotes(notesXml, 'first\nbrand new line', undefined);

		const paragraphs = paragraphsOf(notesXml);
		expect(paragraphs).toHaveLength(2);
		expect((paragraphs[0]['a:pPr'] as XmlObject)['@_algn']).toBe('ctr');
		expect(paragraphs[1]['a:pPr']).toStrictEqual({});
	});
});

describe('updateNotesXmlText body-shape selection', () => {
	it('writes into the body placeholder rather than another shape', () => {
		const notesXml = notesPart(
			'<a:p><a:r><a:t>note</a:t></a:r></a:p>',
			'<p:sp><p:nvSpPr><p:nvPr><p:ph type="sldNum" idx="5"/></p:nvPr></p:nvSpPr>' +
				'<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>12</a:t></a:r></a:p></p:txBody></p:sp>',
		);

		runtime.updateNotes(notesXml, 'edited note', undefined);

		expect(bodyXml(notesXml)).toContain('edited note');
	});

	it('creates a txBody on the body placeholder when it has none', () => {
		const notesXml = parser.parse(
			'<p:notes><p:cSld><p:spTree>' +
				'<p:sp><p:nvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr></p:sp>' +
				'</p:spTree></p:cSld></p:notes>',
		) as XmlObject;

		expect(runtime.updateNotes(notesXml, 'fresh note', undefined)).toBeTruthy();
		expect(bodyXml(notesXml)).toContain('fresh note');
	});

	it('reports failure when the notes part has no shape tree', () => {
		expect(runtime.updateNotes({}, 'note', undefined)).toBeFalsy();
		expect(
			runtime.updateNotes(parser.parse('<p:notes><p:cSld/></p:notes>') as XmlObject, 'note'),
		).toBeFalsy();
	});

	it('reports failure when the shape tree has no shapes', () => {
		const notesXml = parser.parse('<p:notes><p:cSld><p:spTree/></p:cSld></p:notes>') as XmlObject;
		expect(runtime.updateNotes(notesXml, 'note', undefined)).toBeFalsy();
	});
});

describe('updateNotesXmlText stale-segment handling', () => {
	it('honours segments that still match the plain text', () => {
		const notesXml = notesPart('<a:p><a:r><a:t>Hello World</a:t></a:r></a:p>');
		const segments: TextSegment[] = [
			{ text: 'Hello ', style: { bold: true } },
			{ text: 'World', style: {} },
		];

		runtime.updateNotes(notesXml, 'Hello World', segments);

		const xml = bodyXml(notesXml);
		expect(xml).toContain('b="1"');
		expect(xml).toContain('Hello ');
		expect(xml).toContain('World');
	});

	it('discards segments the plain text has outgrown', () => {
		const notesXml = notesPart('<a:p><a:r><a:t>Old text</a:t></a:r></a:p>');
		const segments: TextSegment[] = [
			{ text: 'Old ', style: { bold: true } },
			{ text: 'text', style: {} },
		];

		runtime.updateNotes(notesXml, 'New text', segments);

		const xml = bodyXml(notesXml);
		expect(xml).toContain('New text');
		expect(xml).not.toContain('b="1"');
	});
});
