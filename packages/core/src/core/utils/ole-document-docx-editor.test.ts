import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import {
	readOleDocumentParagraphs,
	writeOleDocumentParagraphEdit,
} from './ole-document-docx-editor';

const DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Hello</w:t></w:r></w:p>
    <w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p>
    <w:sectPr/>
  </w:body>
</w:document>`;

async function buildMinimalDocx(): Promise<Uint8Array> {
	const zip = new JSZip();
	zip.file('word/document.xml', DOCUMENT_XML);
	return zip.generateAsync({ type: 'uint8array' });
}

describe('ole-document-docx-editor', () => {
	it('reads every paragraph in document order', async () => {
		const docx = await buildMinimalDocx();
		const paragraphs = await readOleDocumentParagraphs(docx);
		expect(paragraphs).toStrictEqual(['Hello', 'Second paragraph']);
	});

	it('returns undefined for a payload with no readable document part', async () => {
		const zip = new JSZip();
		zip.file('readme.txt', 'not a document');
		const bytes = await zip.generateAsync({ type: 'uint8array' });
		await expect(readOleDocumentParagraphs(bytes)).resolves.toBeUndefined();
	});

	it('replaces a paragraph’s text, keeping the first run’s formatting', async () => {
		const docx = await buildMinimalDocx();
		const updated = await writeOleDocumentParagraphEdit(docx, 0, 'Updated text');
		const paragraphs = await readOleDocumentParagraphs(updated);
		expect(paragraphs).toStrictEqual(['Updated text', 'Second paragraph']);

		const zip = await JSZip.loadAsync(updated);
		const xml = await zip.file('word/document.xml')!.async('string');
		expect(xml).toContain('<w:b');
	});

	it('leaves the payload unchanged for an out-of-range paragraph index', async () => {
		const docx = await buildMinimalDocx();
		const updated = await writeOleDocumentParagraphEdit(docx, 5, 'nope');
		expect(updated).toStrictEqual(docx);
	});
});
