/**
 * Detect which in-place content editor applies to a recovered OLE embedded
 * payload (see `ole-embedded-extract.ts` for how the payload bytes are
 * recovered from the package).
 *
 * Detection reads the bytes themselves rather than trusting `progId` alone:
 * a `progId` can be missing, stale, or generic ("Package"), but the payload's
 * own container format (a ZIP/OPC package vs. an OLE2 compound file vs. an
 * arbitrary file) is unambiguous and is what actually determines which
 * editor can parse it.
 *
 * @module ole-payload-kind
 */
import JSZip from 'jszip';

import { isOle2CompoundFile } from './ole-embedded-extract';
import { parseOle2 } from './ole2-parser-read';

/** Which in-place editor (if any) applies to a recovered OLE payload. */
export type OlePayloadEditorKind =
	| 'sheet-xlsx'
	| 'sheet-xls'
	| 'document-docx'
	| 'document-doc'
	| 'deck-pptx'
	| 'file';

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

function isZipMagic(bytes: Uint8Array): boolean {
	if (bytes.length < 4) {
		return false;
	}
	return ZIP_MAGIC.every((byte, i) => bytes[i] === byte);
}

/**
 * Detect the editor kind for a recovered OLE payload's bytes.
 *
 * Never throws: any parse failure falls back to `'file'` (replace-file-only),
 * which is always a safe, fully-supported action.
 */
export async function detectOlePayloadEditorKind(bytes: Uint8Array): Promise<OlePayloadEditorKind> {
	if (bytes.length === 0) {
		return 'file';
	}

	if (isZipMagic(bytes)) {
		try {
			const zip = await JSZip.loadAsync(bytes);
			if (zip.file('xl/workbook.xml')) {
				return 'sheet-xlsx';
			}
			if (zip.file('word/document.xml')) {
				return 'document-docx';
			}
			if (zip.file('ppt/presentation.xml')) {
				return 'deck-pptx';
			}
		} catch {
			// Fall through to 'file'.
		}
		return 'file';
	}

	if (isOle2CompoundFile(bytes)) {
		try {
			const buffer = bytes.buffer.slice(
				bytes.byteOffset,
				bytes.byteOffset + bytes.byteLength,
			) as ArrayBuffer;
			const ole = parseOle2(buffer);
			if (ole.getStream('Workbook') || ole.getStream('Book')) {
				return 'sheet-xls';
			}
			if (ole.getStream('WordDocument')) {
				return 'document-doc';
			}
		} catch {
			// Fall through to 'file'.
		}
		return 'file';
	}

	return 'file';
}
