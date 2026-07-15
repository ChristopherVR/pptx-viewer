import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('legacy comment package round-trip', () => {
	it('preserves extensions while typed fields are edited and emits Strict namespaces', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const slide = createSlide('Blank')
			.addText('Review', { x: 10, y: 10, width: 200, height: 40 })
			.build();
		slide.comments = [
			{
				id: '3',
				author: 'Alice Example',
				createdAt: '2024-06-01T10:00:00Z',
				text: 'Original',
				x: 12,
				y: 24,
			},
		];
		data.slides.push(slide);

		const initialBytes = await handler.save(data.slides);
		const injectedZip = await JSZip.loadAsync(initialBytes);
		const commentPath = Object.keys(injectedZip.files).find((path) =>
			/^ppt\/comments\/comment\d+\.xml$/.test(path),
		);
		expect(commentPath).toBeDefined();
		const commentXml = await injectedZip.file(commentPath!)!.async('string');
		injectedZip.file(
			commentPath!,
			commentXml.replace(
				'<p:text>Original</p:text>',
				'<p:text>Original</p:text><p:extLst><p:ext uri="urn:test:comment"><x:data xmlns:x="urn:test">opaque</x:data></p:ext></p:extLst>',
			),
		);
		const authorsXml = await injectedZip.file('ppt/commentAuthors.xml')!.async('string');
		injectedZip.file(
			'ppt/commentAuthors.xml',
			authorsXml
				.replace('<p:cmAuthor ', '<p:cmAuthor vendor="preserved" ')
				.replace(
					'</p:cmAuthorLst>',
					'<p:extLst><p:ext uri="urn:test:list"/></p:extLst></p:cmAuthorLst>',
				),
		);

		const injectedBytes = await injectedZip.generateAsync({ type: 'uint8array' });
		const loadedHandler = new PptxHandler();
		const loaded = await loadedHandler.load(toArrayBuffer(injectedBytes));
		expect(loaded.slides[0].comments?.[0].rawXml?.['p:extLst']).toBeDefined();
		expect(loaded.commentAuthors?.[0].rawXml?.['@_vendor']).toBe('preserved');

		loaded.slides[0].comments![0].text = 'Edited';
		loaded.slides[0].comments![0].x = 30;
		loaded.slides[0].isDirty = true;
		const savedBytes = await loadedHandler.save(loaded.slides, { conformance: 'strict' });
		const savedZip = await JSZip.loadAsync(savedBytes);
		const savedCommentXml = await savedZip.file(commentPath!)!.async('string');
		const savedAuthorsXml = await savedZip.file('ppt/commentAuthors.xml')!.async('string');

		expect(savedCommentXml).toContain('http://purl.oclc.org/ooxml/presentationml/main');
		expect(savedCommentXml).toContain('<p:text>Edited</p:text>');
		expect(savedCommentXml).toContain('urn:test:comment');
		expect(savedCommentXml).toContain('opaque');
		expect(savedAuthorsXml).toContain('http://purl.oclc.org/ooxml/presentationml/main');
		expect(savedAuthorsXml).toContain('vendor="preserved"');
		expect(savedAuthorsXml).toContain('urn:test:list');
	});

	it('deletes comment parts, authors, relationships, and overrides explicitly', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const slide = createSlide('Blank').build();
		slide.comments = [{ id: '0', author: 'Alice', text: 'Remove me' }];
		data.slides.push(slide);
		const initialBytes = await handler.save(data.slides);

		const loadedHandler = new PptxHandler();
		const loaded = await loadedHandler.load(toArrayBuffer(initialBytes));
		loaded.slides[0].comments = [];
		loaded.slides[0].isDirty = true;
		const savedZip = await JSZip.loadAsync(await loadedHandler.save(loaded.slides));
		const paths = Object.keys(savedZip.files);
		const contentTypes = await savedZip.file('[Content_Types].xml')!.async('string');
		const presentationRels = await savedZip
			.file('ppt/_rels/presentation.xml.rels')!
			.async('string');

		expect(paths.some((path) => /^ppt\/comments\/comment\d+\.xml$/.test(path))).toBeFalsy();
		expect(savedZip.file('ppt/commentAuthors.xml')).toBeNull();
		expect(contentTypes).not.toContain('presentationml.comments+xml');
		expect(contentTypes).not.toContain('presentationml.commentAuthors+xml');
		expect(presentationRels).not.toContain('/commentAuthors');
	});
});
