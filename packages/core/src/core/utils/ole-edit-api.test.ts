import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../builders/sdk/PresentationBuilder';
import type { OlePptxElement } from '../types/elements';
import {
	applyOleDocumentParagraphEdit,
	applyOleNestedDeckElementTextEdit,
	applyOleSheetCellEdit,
	getOleDocumentParagraphs,
	getOleNestedDeckDetail,
	getOleSheetGrid,
	replaceOleFile,
	resolveOleEditorKindFromPayload,
	setOleObjectName,
} from './ole-edit-api';
import { oleBytesToDataUrl } from './ole-embedded-extract';

const WORKBOOK_XML = `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></sheets></workbook>`;
const SHEET1_XML = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>10</v></c></row></sheetData></worksheet>`;
const DOCUMENT_XML = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body></w:document>`;

async function makeXlsxElement(): Promise<OlePptxElement> {
	const zip = new JSZip();
	zip.file('xl/workbook.xml', WORKBOOK_XML);
	zip.file('xl/worksheets/sheet1.xml', SHEET1_XML);
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return {
		id: 'ole1',
		type: 'ole',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		oleObjectType: 'excel',
		oleEmbeddedData: oleBytesToDataUrl(
			bytes,
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		),
		oleEmbeddedFileName: 'budget.xlsx',
	};
}

async function makeDocxElement(): Promise<OlePptxElement> {
	const zip = new JSZip();
	zip.file('word/document.xml', DOCUMENT_XML);
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return {
		id: 'ole2',
		type: 'ole',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		oleObjectType: 'word',
		oleEmbeddedData: oleBytesToDataUrl(
			bytes,
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		),
		oleEmbeddedFileName: 'notes.docx',
	};
}

async function makeDeckElement(): Promise<OlePptxElement> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(createSlide('Blank').addText('Nested Title', { fontSize: 32 }).build());
	const bytes = await handler.save(data.slides);
	return {
		id: 'ole3',
		type: 'ole',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		oleObjectType: 'powerpoint',
		oleEmbeddedData: oleBytesToDataUrl(
			bytes,
			'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		),
		oleEmbeddedFileName: 'inner.pptx',
	};
}

describe('ole-edit-api', () => {
	it('resolves the editor kind for a sheet payload', async () => {
		const element = await makeXlsxElement();
		await expect(resolveOleEditorKindFromPayload(element)).resolves.toBe('sheet-xlsx');
	});

	it('resolves the editor kind for a missing payload as file', async () => {
		await expect(
			resolveOleEditorKindFromPayload({ id: 'x', type: 'ole', x: 0, y: 0, width: 1, height: 1 }),
		).resolves.toBe('file');
	});

	it('reads the sheet grid for an xlsx element', async () => {
		const element = await makeXlsxElement();
		const grid = await getOleSheetGrid(element);
		expect(grid!.rows[0]!.cells[0]!.value).toBe('10');
	});

	it('applies a sheet cell edit and marks the element dirty with a refreshed preview', async () => {
		const element = await makeXlsxElement();
		const updated = await applyOleSheetCellEdit(element, { row: 0, col: 0, value: '99' });
		expect(updated.oleContentDirty).toBeTruthy();
		expect(updated.previewImageData).toBeDefined();
		expect(updated).not.toBe(element); // original left untouched
		expect(element.oleContentDirty).toBeUndefined();

		const grid = await getOleSheetGrid(updated);
		expect(grid!.rows[0]!.cells[0]!.value).toBe('99');
	});

	it('reads and edits document paragraphs', async () => {
		const element = await makeDocxElement();
		await expect(getOleDocumentParagraphs(element)).resolves.toStrictEqual(['Hello']);

		const updated = await applyOleDocumentParagraphEdit(element, 0, 'Updated');
		expect(updated.oleContentDirty).toBeTruthy();
		await expect(getOleDocumentParagraphs(updated)).resolves.toStrictEqual(['Updated']);
	});

	it('replaceOleFile always marks the element dirty and updates the payload', async () => {
		const element = await makeXlsxElement();
		const newBytes = new TextEncoder().encode('plain replacement file');
		const updated = await replaceOleFile(element, newBytes, 'notes.txt');
		expect(updated.oleContentDirty).toBeTruthy();
		expect(updated.oleEmbeddedFileName).toBe('notes.txt');
		expect(updated.oleEmbeddedByteSize).toBe(newBytes.length);
	});

	it('setOleObjectName regenerates the icon preview only when showAsIcon is set', async () => {
		const element = await makeXlsxElement();

		const renamedNoIcon = await setOleObjectName(element, 'Q3 Budget');
		expect(renamedNoIcon.oleName).toBe('Q3 Budget');
		expect(renamedNoIcon.oleContentDirty).toBeUndefined();

		const iconElement = { ...element, oleShowAsIcon: true };
		const renamedIcon = await setOleObjectName(iconElement, 'Q3 Budget');
		expect(renamedIcon.oleName).toBe('Q3 Budget');
		expect(renamedIcon.oleContentDirty).toBeTruthy();
		expect(renamedIcon.previewImageData).toMatch(/^data:image\/png;base64,/);
	});

	it('reads and edits a nested deck element by id (full inventory, not just a title slot)', async () => {
		const element = await makeDeckElement();
		const detail = await getOleNestedDeckDetail(element);
		expect(detail).toStrictEqual([
			{ index: 0, elements: [{ elementId: expect.any(String), text: 'Nested Title' }] },
		]);
		const elementId = detail![0]!.elements[0]!.elementId;

		const updated = await applyOleNestedDeckElementTextEdit(element, 0, elementId, 'Renamed');
		expect(updated.oleContentDirty).toBeTruthy();
		const updatedDetail = await getOleNestedDeckDetail(updated);
		expect(updatedDetail![0]!.elements.map((e) => e.text)).toStrictEqual(['Renamed']);
	});

	it('setOleObjectName clears the name for blank input', async () => {
		const element = await makeXlsxElement();
		const cleared = await setOleObjectName(element, '   ');
		expect(cleared.oleName).toBeUndefined();
	});
});
