/**
 * Public, pure entry points for editing an embedded OLE object's CONTENT
 * from any viewer binding (and the MCP tools, which call these directly on
 * a loaded `PptxData`'s elements).
 *
 * Every function here follows the same shape already used throughout this
 * codebase for typed-element edits (see the `oleName` rename round-trip in
 * `ole-save-roundtrip.test.ts`): read the current `OlePptxElement`, decode
 * its recovered payload (`oleEmbeddedData`, see `ole-embedded-extract.ts`),
 * apply the edit with the matching payload editor, and return an updated
 * element with `oleEmbeddedData` / `previewImageData` refreshed and
 * `oleContentDirty` set so `handler.save(slides)` knows to write the new
 * bytes back into the package (`PptxHandlerRuntimeSaveOleContent.ts`
 * reads that flag). Callers replace the element in `slide.elements`, mark
 * the slide dirty, and save exactly as they already do for any other typed
 * field edit; no new `PptxHandler` methods are needed.
 *
 * The commit/preview-regeneration internals live in `ole-edit-commit.ts`,
 * split out purely to keep this file under the 300-LOC limit.
 *
 * @module ole-edit-api
 */
import type { OleObjectType, OlePptxElement } from '../types/elements';
import { parseDataUrlToBytes } from './data-url-utils';
import {
	readOleDocumentParagraphs,
	writeOleDocumentParagraphEdit,
} from './ole-document-docx-editor';
import { bestOleName, commitPayload, regeneratePreview, resolveMimeType } from './ole-edit-commit';
import { oleBytesToDataUrl } from './ole-embedded-extract';
import { oleObjectTypeToGlyph, renderOleIconPng } from './ole-icon-raster';
import { readOleNestedDeckDetail, writeOleNestedDeckElementText } from './ole-nested-deck-editor';
import type { OleNestedDeckSlideDetail } from './ole-nested-deck-editor';
import { detectOlePayloadEditorKind } from './ole-payload-kind';
import type { OlePayloadEditorKind } from './ole-payload-kind';
import { readOleXlsGrid, writeOleXlsNumericCellEdit } from './ole-sheet-xls-biff8';
import { writeOleXlsStringCellEdit } from './ole-sheet-xls-biff8-writer';
import { readOleSheetGrid, writeOleSheetCellEdit } from './ole-sheet-xlsx-editor';
import type { OleSheetGrid } from './ole-sheet-xlsx-editor';
import { mimeTypeForOleFile } from './ole-utils';

export type { OlePayloadEditorKind } from './ole-payload-kind';
export type { OleSheetGrid, OleSheetCell, OleSheetRow } from './ole-sheet-xlsx-editor';

function decodePayload(element: OlePptxElement): Uint8Array | undefined {
	if (!element.oleEmbeddedData) {
		return undefined;
	}
	return parseDataUrlToBytes(element.oleEmbeddedData)?.bytes;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) {
		return false;
	}
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false;
		}
	}
	return true;
}

/**
 * Resolve which in-place editor applies to an OLE element's current
 * payload. `'file'` covers both a genuinely unsupported format and a
 * missing/unreadable payload (both fall back to Replace File).
 */
export async function resolveOleEditorKindFromPayload(
	element: OlePptxElement,
): Promise<OlePayloadEditorKind> {
	const bytes = decodePayload(element);
	return bytes ? detectOlePayloadEditorKind(bytes) : 'file';
}

/** Read the spreadsheet grid for an Excel-payload OLE element (xlsx or legacy xls). */
export async function getOleSheetGrid(element: OlePptxElement): Promise<OleSheetGrid | undefined> {
	const bytes = decodePayload(element);
	if (!bytes) {
		return undefined;
	}
	const kind = await detectOlePayloadEditorKind(bytes);
	if (kind === 'sheet-xlsx') {
		return readOleSheetGrid(bytes);
	}
	if (kind === 'sheet-xls') {
		return readOleXlsGrid(bytes);
	}
	return undefined;
}

/** Read the paragraph text for a Word-payload OLE element (docx only; legacy doc is replace-only). */
export async function getOleDocumentParagraphs(
	element: OlePptxElement,
): Promise<string[] | undefined> {
	const bytes = decodePayload(element);
	if (!bytes) {
		return undefined;
	}
	const kind = await detectOlePayloadEditorKind(bytes);
	return kind === 'document-docx' ? readOleDocumentParagraphs(bytes) : undefined;
}

/** Read the raw payload bytes of a nested-deck (embedded PowerPoint) OLE element, for `PptxHandler.load`. */
export async function getOleNestedDeckBytes(
	element: OlePptxElement,
): Promise<Uint8Array | undefined> {
	const bytes = decodePayload(element);
	if (!bytes) {
		return undefined;
	}
	const kind = await detectOlePayloadEditorKind(bytes);
	return kind === 'deck-pptx' ? bytes : undefined;
}

/**
 * Read every slide's full text-element inventory for a nested-deck OLE
 * element: each slide's index and every text-bearing shape's id + current
 * text (including shapes inside groups), not just a "title" slot.
 */
export async function getOleNestedDeckDetail(
	element: OlePptxElement,
): Promise<OleNestedDeckSlideDetail[] | undefined> {
	const bytes = await getOleNestedDeckBytes(element);
	return bytes ? readOleNestedDeckDetail(bytes) : undefined;
}

/**
 * Replace ONE text-bearing shape's text on a nested-deck OLE element's
 * given slide (identified by its element id, per {@link getOleNestedDeckDetail}),
 * re-saving the nested deck through its own full `PptxHandler.save` and
 * writing the result back onto the OLE element.
 */
export async function applyOleNestedDeckElementTextEdit(
	element: OlePptxElement,
	slideIndex: number,
	elementId: string,
	text: string,
): Promise<OlePptxElement> {
	const bytes = await getOleNestedDeckBytes(element);
	if (!bytes) {
		return element;
	}
	const updated = await writeOleNestedDeckElementText(bytes, slideIndex, elementId, text);
	return bytesEqual(bytes, updated) ? element : commitPayload(element, 'deck-pptx', updated);
}

/** Apply one cell edit to an Excel-payload OLE element's first worksheet. */
export async function applyOleSheetCellEdit(
	element: OlePptxElement,
	edit: { row: number; col: number; value: string },
): Promise<OlePptxElement> {
	const bytes = decodePayload(element);
	if (!bytes) {
		return element;
	}
	const kind = await detectOlePayloadEditorKind(bytes);
	let updated: Uint8Array;
	if (kind === 'sheet-xlsx') {
		updated = await writeOleSheetCellEdit(bytes, edit);
	} else if (kind === 'sheet-xls') {
		const numeric = Number(edit.value);
		updated =
			edit.value.trim().length > 0 && Number.isFinite(numeric)
				? writeOleXlsNumericCellEdit(bytes, { row: edit.row, col: edit.col, value: numeric })
				: writeOleXlsStringCellEdit(bytes, edit);
	} else {
		return element;
	}
	return bytesEqual(bytes, updated) ? element : commitPayload(element, kind, updated);
}

/** Replace one paragraph's text in a Word-payload (docx) OLE element. */
export async function applyOleDocumentParagraphEdit(
	element: OlePptxElement,
	paragraphIndex: number,
	text: string,
): Promise<OlePptxElement> {
	const bytes = decodePayload(element);
	if (!bytes) {
		return element;
	}
	const kind = await detectOlePayloadEditorKind(bytes);
	if (kind !== 'document-docx') {
		return element;
	}
	const updated = await writeOleDocumentParagraphEdit(bytes, paragraphIndex, text);
	return bytesEqual(bytes, updated) ? element : commitPayload(element, kind, updated);
}

/** Replace a nested-deck OLE element's payload with a re-saved presentation's bytes. */
export async function applyOleNestedDeckBytes(
	element: OlePptxElement,
	savedDeckBytes: Uint8Array,
): Promise<OlePptxElement> {
	return commitPayload(element, 'deck-pptx', savedDeckBytes);
}

/**
 * Replace an OLE element's payload wholesale with an arbitrary file (the
 * "Replace File" action available for every payload kind, and the only
 * edit available for a generic Packager object or an unsupported format).
 */
export async function replaceOleFile(
	element: OlePptxElement,
	fileBytes: Uint8Array,
	fileName?: string,
): Promise<OlePptxElement> {
	const kind = await detectOlePayloadEditorKind(fileBytes);
	const mimeType = fileName ? mimeTypeForOleFile(fileName) : resolveMimeType(element);
	const previewImageData = await regeneratePreview(element, kind, fileBytes);
	return {
		...element,
		oleEmbeddedData: oleBytesToDataUrl(fileBytes, mimeType),
		oleEmbeddedByteSize: fileBytes.length,
		...(fileName ? { oleEmbeddedFileName: fileName, fileName } : {}),
		previewImageData,
		oleContentDirty: true,
	};
}

/**
 * Rename an OLE object's Object Name (`p:oleObj/@name`) and, when it is
 * displayed `showAsIcon`, regenerate the baked-in icon caption so the new
 * name is visible when the deck is reopened in real PowerPoint (which
 * renders the icon's `p:pic` blip as a static image, not a live label).
 */
export async function setOleObjectName(
	element: OlePptxElement,
	name: string,
): Promise<OlePptxElement> {
	const trimmed = name.trim();
	const next: OlePptxElement = { ...element, oleName: trimmed.length > 0 ? trimmed : undefined };
	if (!next.oleShowAsIcon) {
		return next;
	}
	const png = renderOleIconPng({
		glyph: oleObjectTypeToGlyph(next.oleObjectType as OleObjectType | undefined),
		caption: bestOleName(next) ?? '',
	});
	return {
		...next,
		previewImageData: oleBytesToDataUrl(png, 'image/png'),
		oleContentDirty: true,
	};
}
