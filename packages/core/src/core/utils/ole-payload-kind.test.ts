import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { detectOlePayloadEditorKind } from './ole-payload-kind';
import { buildOle2 } from './ole2-parser-write';

async function zipWith(entries: Record<string, string>): Promise<Uint8Array> {
	const zip = new JSZip();
	for (const [path, content] of Object.entries(entries)) {
		zip.file(path, content);
	}
	return zip.generateAsync({ type: 'uint8array' });
}

describe('detectOlePayloadEditorKind', () => {
	it('detects an xlsx package', async () => {
		const bytes = await zipWith({ 'xl/workbook.xml': '<workbook/>' });
		await expect(detectOlePayloadEditorKind(bytes)).resolves.toBe('sheet-xlsx');
	});

	it('detects a docx package', async () => {
		const bytes = await zipWith({ 'word/document.xml': '<document/>' });
		await expect(detectOlePayloadEditorKind(bytes)).resolves.toBe('document-docx');
	});

	it('detects a pptx package', async () => {
		const bytes = await zipWith({ 'ppt/presentation.xml': '<presentation/>' });
		await expect(detectOlePayloadEditorKind(bytes)).resolves.toBe('deck-pptx');
	});

	it('falls back to file for an unrecognised zip', async () => {
		const bytes = await zipWith({ 'readme.txt': 'hi' });
		await expect(detectOlePayloadEditorKind(bytes)).resolves.toBe('file');
	});

	it('detects a legacy xls (Workbook stream) OLE2 compound file', async () => {
		const bytes = new Uint8Array(buildOle2(new Map([['Workbook', new Uint8Array([1, 2, 3])]])));
		await expect(detectOlePayloadEditorKind(bytes)).resolves.toBe('sheet-xls');
	});

	it('detects a legacy doc (WordDocument stream) OLE2 compound file', async () => {
		const bytes = new Uint8Array(buildOle2(new Map([['WordDocument', new Uint8Array([1, 2, 3])]])));
		await expect(detectOlePayloadEditorKind(bytes)).resolves.toBe('document-doc');
	});

	it('falls back to file for an OLE2 container with neither stream', async () => {
		const bytes = new Uint8Array(buildOle2(new Map([['CONTENTS', new Uint8Array([1])]])));
		await expect(detectOlePayloadEditorKind(bytes)).resolves.toBe('file');
	});

	it('falls back to file for empty input', async () => {
		await expect(detectOlePayloadEditorKind(new Uint8Array(0))).resolves.toBe('file');
	});

	it('falls back to file for arbitrary non-zip, non-OLE2 bytes', async () => {
		await expect(detectOlePayloadEditorKind(new Uint8Array([1, 2, 3, 4, 5]))).resolves.toBe('file');
	});
});
