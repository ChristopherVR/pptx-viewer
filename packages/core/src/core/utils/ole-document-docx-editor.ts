/**
 * In-place paragraph text editing for an embedded Word document
 * (`Word.Document.12` / `.docx` OLE payload).
 *
 * Scope: reads each `w:p` paragraph's plain text (concatenating its runs),
 * and replaces a chosen paragraph's content with a single run carrying the
 * new text. The paragraph's own properties (`w:pPr`: alignment, spacing,
 * list numbering, etc.) are preserved untouched; the replacement run reuses
 * the paragraph's FIRST existing run's `w:rPr` (font, bold/italic, colour)
 * so basic formatting survives. A paragraph with multiple differently
 * formatted runs collapses to that first run's formatting, since a plain
 * text edit has no way to express which formatting the new text should
 * carry; callers that need multi-run formatting preserved should edit the
 * source document in Word or Replace the whole file instead. Every other
 * part of the document (styles, headers/footers, other paragraphs) is left
 * byte-identical.
 *
 * @module ole-document-docx-editor
 */
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';

import type { XmlObject } from '../types';
import { ensureXmlChildren, xmlChild, xmlChildren, xmlText } from './xml-access';

const DOCUMENT_PART_PATH = 'word/document.xml';

function createWordXmlParser(): XMLParser {
	return new XMLParser({
		ignoreAttributes: false,
		attributeNamePrefix: '@_',
		trimValues: false,
		// See the matching comment in `ole-sheet-xlsx-editor.ts`: `xmlText`
		// only accepts string leaves.
		parseTagValue: false,
		parseAttributeValue: false,
	});
}

function createWordXmlBuilder(): XMLBuilder {
	return new XMLBuilder({
		ignoreAttributes: false,
		attributeNamePrefix: '@_',
		suppressBooleanAttributes: false,
		format: false,
	});
}

/** Concatenate a paragraph's run text (`w:r/w:t`), ignoring other run children. */
function paragraphText(paragraph: XmlObject): string {
	return xmlChildren(paragraph, 'w:r')
		.map((run) => xmlText(xmlChild(run, 'w:t') ?? run['w:t']) ?? '')
		.join('');
}

/**
 * Read every paragraph's plain text from an embedded `.docx` payload's main
 * document part, in document order.
 *
 * Returns `undefined` when the payload is not a readable Word document.
 */
export async function readOleDocumentParagraphs(
	docxBytes: Uint8Array,
): Promise<string[] | undefined> {
	try {
		const zip = await JSZip.loadAsync(docxBytes);
		const documentFile = zip.file(DOCUMENT_PART_PATH);
		if (!documentFile) {
			return undefined;
		}
		const parser = createWordXmlParser();
		const tree = parser.parse(await documentFile.async('string')) as XmlObject;
		const body = xmlChild(xmlChild(tree, 'w:document'), 'w:body');
		if (!body) {
			return [];
		}
		return xmlChildren(body, 'w:p').map(paragraphText);
	} catch {
		return undefined;
	}
}

/**
 * Replace one paragraph's text in an embedded `.docx` payload's main
 * document part, preserving paragraph properties and the first run's
 * formatting (see module doc for the exact scope). Returns the original
 * bytes unchanged if the edit could not be applied.
 */
export async function writeOleDocumentParagraphEdit(
	docxBytes: Uint8Array,
	paragraphIndex: number,
	text: string,
): Promise<Uint8Array> {
	try {
		const zip = await JSZip.loadAsync(docxBytes);
		const documentFile = zip.file(DOCUMENT_PART_PATH);
		if (!documentFile) {
			return docxBytes;
		}
		const parser = createWordXmlParser();
		const builder = createWordXmlBuilder();
		const tree = parser.parse(await documentFile.async('string')) as XmlObject;
		const body = xmlChild(xmlChild(tree, 'w:document'), 'w:body');
		if (!body) {
			return docxBytes;
		}
		const paragraphs = ensureXmlChildren(body, 'w:p');
		const paragraph = paragraphs[paragraphIndex];
		if (!paragraph) {
			return docxBytes;
		}

		const firstRunRPr = xmlChildren(paragraph, 'w:r')
			.map((run) => xmlChild(run, 'w:rPr'))
			.find((rPr): rPr is XmlObject => rPr !== undefined);

		const newRun: XmlObject = {
			...(firstRunRPr ? { 'w:rPr': firstRunRPr } : {}),
			'w:t': { '@_xml:space': 'preserve', '#text': text },
		};

		// Rebuild the paragraph, keeping `w:pPr` (if present) first and
		// discarding the old runs, per CT_P's `pPr?, (run content)` sequence.
		const pPr = xmlChild(paragraph, 'w:pPr');
		for (const key of Object.keys(paragraph)) {
			delete paragraph[key];
		}
		if (pPr) {
			paragraph['w:pPr'] = pPr;
		}
		paragraph['w:r'] = newRun;

		zip.file(DOCUMENT_PART_PATH, builder.build(tree) as string);
		return await zip.generateAsync({
			type: 'uint8array',
			compression: 'DEFLATE',
			compressionOptions: { level: 6 },
		});
	} catch {
		return docxBytes;
	}
}
