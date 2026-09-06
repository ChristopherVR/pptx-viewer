import JSZip from 'jszip';
import { oleBytesToDataUrl, PptxHandler } from 'pptx-viewer-core';
import type { OlePptxElement, PptxData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	getOleContent,
	replaceOleFileT,
	setOleDeckSlideTitle,
	setOleDocumentParagraph,
	setOleObjectNameT,
	setOleSheetCell,
} from '../../tools/ole-tools.js';
import type { ToolContext } from '../../types.js';

const WORKBOOK_XML = `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></sheets></workbook>`;
const SHEET1_XML = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>10</v></c></row></sheetData></worksheet>`;
const DOCUMENT_XML = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body></w:document>`;

async function makeXlsxDataUrl(): Promise<string> {
	const zip = new JSZip();
	zip.file('xl/workbook.xml', WORKBOOK_XML);
	zip.file('xl/worksheets/sheet1.xml', SHEET1_XML);
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return oleBytesToDataUrl(
		bytes,
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	);
}

async function makeDocxDataUrl(): Promise<string> {
	const zip = new JSZip();
	zip.file('word/document.xml', DOCUMENT_XML);
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return oleBytesToDataUrl(
		bytes,
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	);
}

async function makeDeckDataUrl(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({ initialSlideCount: 0 });
	data.slides.push(createSlide('Blank').addText('Nested Title', { fontSize: 32 }).build());
	const bytes = await handler.save(data.slides);
	return oleBytesToDataUrl(
		bytes,
		'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	);
}

/** The elementId of the first (and only, for `makeDeckDataUrl`) text-bearing shape on nested slide 0. */
async function firstDeckElementId(ctx: ToolContext, elementId: string): Promise<string> {
	const read = await getOleContent(ctx, { slideIndex: 0, elementId });
	return read.result.deckSlides![0]!.elements[0]!.elementId;
}

/** Build a minimal in-memory ToolContext with one OLE element on slide 0. */
function ctxWithOle(element: Omit<OlePptxElement, 'x' | 'y' | 'width' | 'height'>): ToolContext {
	const pptxData: PptxData = {
		width: 960,
		height: 540,
		slides: [
			{
				id: 'slide-0',
				rId: 'rId2',
				slideNumber: 1,
				elements: [{ x: 0, y: 0, width: 100, height: 100, ...element }],
				notes: '',
				comments: [],
			},
		],
	} as unknown as PptxData;
	return { pptxData };
}

describe('getOleContent', () => {
	it('returns the sheet grid for an xlsx-payload OLE object', async () => {
		const ctx = ctxWithOle({
			id: 'ole-1',
			type: 'ole',
			oleObjectType: 'excel',
			oleEmbeddedData: await makeXlsxDataUrl(),
			oleEmbeddedFileName: 'budget.xlsx',
		});
		const result = await getOleContent(ctx, { slideIndex: 0, elementId: 'ole-1' });
		expect(result.dirty).toBeFalsy();
		expect(result.result.kind).toBe('sheet-xlsx');
		expect(result.result.editable).toBeTruthy();
		expect(result.result.sheet?.rows[0]?.cells[0]?.value).toBe('10');
	});

	it('returns paragraphs for a docx-payload OLE object', async () => {
		const ctx = ctxWithOle({
			id: 'ole-2',
			type: 'ole',
			oleObjectType: 'word',
			oleEmbeddedData: await makeDocxDataUrl(),
			oleEmbeddedFileName: 'notes.docx',
		});
		const result = await getOleContent(ctx, { slideIndex: 0, elementId: 'ole-2' });
		expect(result.result.kind).toBe('document-docx');
		expect(result.result.editable).toBeTruthy();
		expect(result.result.paragraphs).toStrictEqual(['Hello']);
	});

	it('returns deck slide summaries for a nested-deck OLE object', async () => {
		const ctx = ctxWithOle({
			id: 'ole-3',
			type: 'ole',
			oleObjectType: 'powerpoint',
			oleEmbeddedData: await makeDeckDataUrl(),
			oleEmbeddedFileName: 'inner.pptx',
		});
		const result = await getOleContent(ctx, { slideIndex: 0, elementId: 'ole-3' });
		expect(result.result.kind).toBe('deck-pptx');
		expect(result.result.deckSlides).toStrictEqual([
			{ index: 0, elements: [{ elementId: expect.any(String), text: 'Nested Title' }] },
		]);
	});

	it('reports a file-kind object as not editable with guidance to ole_replace_file', async () => {
		const ctx = ctxWithOle({ id: 'ole-4', type: 'ole', oleObjectType: 'pdf' });
		const result = await getOleContent(ctx, { slideIndex: 0, elementId: 'ole-4' });
		expect(result.result.kind).toBe('file');
		expect(result.result.editable).toBeFalsy();
		expect(result.result.message).toMatch(/ole_replace_file/);
	});

	it('throws for an out-of-range slide index', async () => {
		const ctx = ctxWithOle({ id: 'ole-5', type: 'ole' });
		await expect(getOleContent(ctx, { slideIndex: 5, elementId: 'ole-5' })).rejects.toThrow(
			'out of range',
		);
	});

	it('throws when the element does not exist', async () => {
		const ctx = ctxWithOle({ id: 'ole-6', type: 'ole' });
		await expect(getOleContent(ctx, { slideIndex: 0, elementId: 'missing' })).rejects.toThrow(
			'not found',
		);
	});

	it('throws when the element is not an OLE object', async () => {
		const ctx = ctxWithOle({ id: 'ole-7', type: 'ole' });
		ctx.pptxData.slides[0].elements.push({
			id: 'txt-1',
			type: 'text',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			text: 'hi',
		});
		await expect(getOleContent(ctx, { slideIndex: 0, elementId: 'txt-1' })).rejects.toThrow(
			'is not an OLE object',
		);
	});
});

describe('setOleSheetCell', () => {
	it('applies the edit, marks the slide dirty, and replaces the element', async () => {
		const ctx = ctxWithOle({
			id: 'ole-1',
			type: 'ole',
			oleObjectType: 'excel',
			oleEmbeddedData: await makeXlsxDataUrl(),
		});
		const before = ctx.pptxData.slides[0].elements[0];
		const result = await setOleSheetCell(ctx, {
			slideIndex: 0,
			elementId: 'ole-1',
			row: 0,
			col: 0,
			value: '99',
		});
		expect(result.dirty).toBeTruthy();
		expect(result.result).toStrictEqual({ elementId: 'ole-1', changed: true });
		expect(ctx.pptxData.slides[0].isDirty).toBeTruthy();
		expect(ctx.pptxData.slides[0].elements[0]).not.toBe(before);

		const read = await getOleContent(ctx, { slideIndex: 0, elementId: 'ole-1' });
		expect(read.result.sheet?.rows[0]?.cells[0]?.value).toBe('99');
	});

	it('is a no-op for a non-sheet payload', async () => {
		const ctx = ctxWithOle({
			id: 'ole-2',
			type: 'ole',
			oleObjectType: 'word',
			oleEmbeddedData: await makeDocxDataUrl(),
		});
		const before = ctx.pptxData.slides[0].elements[0];
		const result = await setOleSheetCell(ctx, {
			slideIndex: 0,
			elementId: 'ole-2',
			row: 0,
			col: 0,
			value: '99',
		});
		expect(result.dirty).toBeFalsy();
		expect(result.result.changed).toBeFalsy();
		expect(ctx.pptxData.slides[0].isDirty).toBeUndefined();
		expect(ctx.pptxData.slides[0].elements[0]).toBe(before);
	});
});

describe('setOleDocumentParagraph', () => {
	it('applies the edit and marks the slide dirty', async () => {
		const ctx = ctxWithOle({
			id: 'ole-1',
			type: 'ole',
			oleObjectType: 'word',
			oleEmbeddedData: await makeDocxDataUrl(),
		});
		const result = await setOleDocumentParagraph(ctx, {
			slideIndex: 0,
			elementId: 'ole-1',
			paragraphIndex: 0,
			text: 'Updated',
		});
		expect(result.dirty).toBeTruthy();
		expect(result.result.changed).toBeTruthy();
		expect(ctx.pptxData.slides[0].isDirty).toBeTruthy();

		const read = await getOleContent(ctx, { slideIndex: 0, elementId: 'ole-1' });
		expect(read.result.paragraphs).toStrictEqual(['Updated']);
	});
});

describe('setOleDeckSlideTitle', () => {
	it('edits one specific text-bearing shape on the nested slide and marks the slide dirty', async () => {
		const ctx = ctxWithOle({
			id: 'ole-1',
			type: 'ole',
			oleObjectType: 'powerpoint',
			oleEmbeddedData: await makeDeckDataUrl(),
		});
		const deckElementId = await firstDeckElementId(ctx, 'ole-1');
		const result = await setOleDeckSlideTitle(ctx, {
			slideIndex: 0,
			elementId: 'ole-1',
			deckSlideIndex: 0,
			deckElementId,
			title: 'Renamed',
		});
		expect(result.dirty).toBeTruthy();
		expect(result.result.changed).toBeTruthy();
		expect(ctx.pptxData.slides[0].isDirty).toBeTruthy();

		const read = await getOleContent(ctx, { slideIndex: 0, elementId: 'ole-1' });
		expect(read.result.deckSlides![0]!.elements.map((e) => e.text)).toStrictEqual(['Renamed']);
	});

	it('is a no-op for an unknown deckElementId', async () => {
		const ctx = ctxWithOle({
			id: 'ole-1',
			type: 'ole',
			oleObjectType: 'powerpoint',
			oleEmbeddedData: await makeDeckDataUrl(),
		});
		const result = await setOleDeckSlideTitle(ctx, {
			slideIndex: 0,
			elementId: 'ole-1',
			deckSlideIndex: 0,
			deckElementId: 'no-such-id',
			title: 'Renamed',
		});
		expect(result.dirty).toBeFalsy();
		expect(result.result.changed).toBeFalsy();
	});
});

describe('setOleObjectNameT', () => {
	it('renames the object and always marks dirty', async () => {
		const ctx = ctxWithOle({
			id: 'ole-1',
			type: 'ole',
			oleObjectType: 'excel',
			oleEmbeddedData: await makeXlsxDataUrl(),
		});
		const result = await setOleObjectNameT(ctx, {
			slideIndex: 0,
			elementId: 'ole-1',
			name: 'Q3 Budget',
		});
		expect(result.dirty).toBeTruthy();
		expect(result.result.changed).toBeTruthy();
		const updated = ctx.pptxData.slides[0].elements[0] as OlePptxElement;
		expect(updated.oleName).toBe('Q3 Budget');
	});

	it('clears the name for blank input', async () => {
		const ctx = ctxWithOle({ id: 'ole-1', type: 'ole', oleName: 'Old Name' });
		await setOleObjectNameT(ctx, { slideIndex: 0, elementId: 'ole-1', name: '   ' });
		const updated = ctx.pptxData.slides[0].elements[0] as OlePptxElement;
		expect(updated.oleName).toBeUndefined();
	});
});

describe('replaceOleFileT', () => {
	it('replaces the payload wholesale and always marks dirty', async () => {
		const ctx = ctxWithOle({
			id: 'ole-1',
			type: 'ole',
			oleObjectType: 'excel',
			oleEmbeddedData: await makeXlsxDataUrl(),
			oleEmbeddedFileName: 'budget.xlsx',
		});
		const plain = oleBytesToDataUrl(
			new TextEncoder().encode('plain replacement file'),
			'text/plain',
		);
		const result = await replaceOleFileT(ctx, {
			slideIndex: 0,
			elementId: 'ole-1',
			fileData: plain,
			fileName: 'notes.txt',
		});
		expect(result.dirty).toBeTruthy();
		expect(result.result.changed).toBeTruthy();
		expect(ctx.pptxData.slides[0].isDirty).toBeTruthy();
		const updated = ctx.pptxData.slides[0].elements[0] as OlePptxElement;
		expect(updated.oleEmbeddedFileName).toBe('notes.txt');
	});

	it('rejects fileData that is not a base64 data URL', async () => {
		const ctx = ctxWithOle({ id: 'ole-1', type: 'ole' });
		await expect(
			replaceOleFileT(ctx, { slideIndex: 0, elementId: 'ole-1', fileData: 'not-a-data-url' }),
		).rejects.toThrow('base64 data URL');
	});
});
