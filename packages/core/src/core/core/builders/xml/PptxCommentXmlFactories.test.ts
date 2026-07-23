import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import type { PptxCommentAuthor, XmlObject } from '../../../types';
import { PptxSaveState } from '../PptxSaveSessionBuilder';
import { PptxCommentAuthorsXmlFactory } from './PptxCommentAuthorsXmlFactory';
import { PptxSlideCommentsXmlFactory } from './PptxSlideCommentsXmlFactory';

const STRICT = {
	p: 'http://purl.oclc.org/ooxml/presentationml/main',
	a: 'http://purl.oclc.org/ooxml/drawingml/main',
	r: 'http://purl.oclc.org/ooxml/officeDocument/relationships',
};

function makeSaveState(authors: PptxCommentAuthor[] = [], root?: XmlObject): PptxSaveState {
	return new PptxSaveState({
		zip: new JSZip(),
		commentAuthorMap: new Map(authors.map((author) => [author.id, author.name])),
		commentAuthorDetails: new Map(authors.map((author) => [author.id, author])),
		commentAuthorsRootXml: root,
		emuPerPx: 9525,
	});
}

describe('pptx slide comments XML factory', () => {
	it('preserves unknown comment XML while applying typed edits', () => {
		const saveState = makeSaveState([
			{ id: '2', name: 'Alice', initials: 'AX', lastIdx: 4, clrIdx: 3 },
		]);
		const xml = new PptxSlideCommentsXmlFactory().createXmlElement({
			conformance: 'transitional',
			saveState,
			slideComments: [
				{
					id: '7',
					author: 'Alice',
					createdAt: '2024-06-01T10:00:00Z',
					text: 'Edited',
					x: 10,
					y: 20,
					rawXml: {
						'@_authorId': '99',
						'@_custom': 'keep',
						'x:pos': { '@_x': '1', '@_y': '2' },
						'x:text': 'Old',
						'p:extLst': { 'p:ext': { '@_uri': 'urn:test', 'x:data': 'opaque' } },
					},
				},
			],
		});
		const comment = (xml['p:cmLst'] as XmlObject)['p:cm'] as XmlObject[];

		expect(comment[0]['@_authorId']).toBe('2');
		expect(comment[0]['@_custom']).toBe('keep');
		expect(comment[0]['x:pos']).toBeUndefined();
		expect(comment[0]['x:text']).toBeUndefined();
		expect(comment[0]['p:pos']).toStrictEqual({ '@_x': '95250', '@_y': '190500' });
		expect(comment[0]['p:text']).toBe('Edited');
		expect(comment[0]['p:extLst']).toStrictEqual({
			'p:ext': { '@_uri': 'urn:test', 'x:data': 'opaque' },
		});
	});

	it('writes the resolved state back as @_done when a comment is resolved', () => {
		const xml = new PptxSlideCommentsXmlFactory().createXmlElement({
			conformance: 'transitional',
			saveState: makeSaveState(),
			slideComments: [{ id: '0', text: 'Done', resolved: true }],
		});
		const comment = (xml['p:cmLst'] as XmlObject)['p:cm'] as XmlObject[];
		expect(comment[0]['@_done']).toBe('1');
	});

	it('emits an explicit unresolved marker when an edit clears a resolved comment', () => {
		const xml = new PptxSlideCommentsXmlFactory().createXmlElement({
			conformance: 'transitional',
			saveState: makeSaveState(),
			slideComments: [
				{
					id: '0',
					text: 'Reopened',
					resolved: false,
					rawXml: { '@_done': '1' },
				},
			],
		});
		const comment = (xml['p:cmLst'] as XmlObject)['p:cm'] as XmlObject[];
		expect(comment[0]['@_done']).toBe('0');
	});

	it('preserves the original @_resolved attribute name on write-back', () => {
		const xml = new PptxSlideCommentsXmlFactory().createXmlElement({
			conformance: 'transitional',
			saveState: makeSaveState(),
			slideComments: [{ id: '0', text: 'Done', resolved: true, rawXml: { '@_resolved': '1' } }],
		});
		const comment = (xml['p:cmLst'] as XmlObject)['p:cm'] as XmlObject[];
		expect(comment[0]['@_resolved']).toBe('1');
		expect(comment[0]['@_done']).toBeUndefined();
	});

	it('omits any resolved marker for an unresolved comment with no prior state', () => {
		const xml = new PptxSlideCommentsXmlFactory().createXmlElement({
			conformance: 'transitional',
			saveState: makeSaveState(),
			slideComments: [{ id: '0', text: 'Plain' }],
		});
		const comment = (xml['p:cmLst'] as XmlObject)['p:cm'] as XmlObject[];
		expect(comment[0]['@_done']).toBeUndefined();
		expect(comment[0]['@_resolved']).toBeUndefined();
	});

	it('uses Strict namespaces for a Strict save', () => {
		const xml = new PptxSlideCommentsXmlFactory().createXmlElement({
			conformance: 'strict',
			saveState: makeSaveState(),
			slideComments: [{ id: '0', text: 'Strict' }],
		});
		const root = xml['p:cmLst'] as XmlObject;

		expect(root['@_xmlns:p']).toBe(STRICT.p);
		expect(root['@_xmlns:a']).toBe(STRICT.a);
		expect(root['@_xmlns:r']).toBe(STRICT.r);
	});
});

describe('pptx comment authors XML factory', () => {
	it('preserves author-list extensions and unknown author attributes', () => {
		const author: PptxCommentAuthor = {
			id: '4',
			name: 'Chris',
			initials: 'C',
			lastIdx: 8,
			clrIdx: 6,
			rawXml: { '@_vendor': 'keep', 'p:extLst': { 'p:ext': { '@_uri': 'urn:author' } } },
		};
		const saveState = makeSaveState([author], {
			'@_vendorRoot': 'keep-root',
			'x:cmAuthor': { '@_id': 'old' },
			'p:extLst': { 'p:ext': { '@_uri': 'urn:list' } },
		});
		const authorId = saveState.resolveCommentAuthorId('Chris');
		saveState.resolveCommentIndex(authorId, '8', 0);
		const xml = new PptxCommentAuthorsXmlFactory().createXmlElement({
			conformance: 'strict',
			saveState,
		});
		const root = xml['p:cmAuthorLst'] as XmlObject;
		const authors = root['p:cmAuthor'] as XmlObject[];

		expect(root['@_vendorRoot']).toBe('keep-root');
		expect(root['x:cmAuthor']).toBeUndefined();
		expect(root['p:extLst']).toStrictEqual({ 'p:ext': { '@_uri': 'urn:list' } });
		expect(root['@_xmlns:p']).toBe(STRICT.p);
		expect(authors[0]['@_vendor']).toBe('keep');
		expect(authors[0]['@_id']).toBe('4');
		expect(authors[0]['p:extLst']).toStrictEqual({
			'p:ext': { '@_uri': 'urn:author' },
		});
	});
});
