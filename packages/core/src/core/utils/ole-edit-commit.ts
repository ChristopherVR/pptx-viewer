/**
 * Shared commit/preview-regeneration internals for `ole-edit-api.ts`.
 *
 * Split out purely to keep `ole-edit-api.ts` (the public read/apply function
 * surface every binding and MCP tool calls) under this codebase's 300-LOC
 * file-size limit; these helpers have no reason to be called from outside
 * that module.
 *
 * @module ole-edit-commit
 */
import type { OleObjectType, OlePptxElement } from '../types/elements';
import {
	renderOleDeckPreviewPng,
	renderOleDocumentPreviewPng,
	renderOleSheetPreviewPng,
} from './ole-content-preview-raster';
import { readOleDocParagraphs } from './ole-document-doc-editor';
import { readOleDocumentParagraphs } from './ole-document-docx-editor';
import { oleBytesToDataUrl } from './ole-embedded-extract';
import { oleObjectTypeToGlyph, renderOleIconPng } from './ole-icon-raster';
import { readOleNestedDeckFirstSlideTextLines } from './ole-nested-deck-editor';
import type { OlePayloadEditorKind } from './ole-payload-kind';
import { readOleXlsGrid } from './ole-sheet-xls-biff8';
import { readOleSheetGrid } from './ole-sheet-xlsx-editor';
import { mimeTypeForOleFile } from './ole-utils';

/** Resolve the MIME type to store for an OLE element's payload. */
export function resolveMimeType(element: OlePptxElement, extensionHint?: string): string {
	const fileName =
		element.oleEmbeddedFileName ??
		element.fileName ??
		(extensionHint ? `payload.${extensionHint}` : undefined);
	return element.oleEmbeddedMimeType ?? mimeTypeForOleFile(fileName ?? 'payload.bin');
}

/** The best available identifying name for an OLE element (mirrors `getOleDisplayName` in shared). */
export function bestOleName(element: OlePptxElement): string | undefined {
	return element.oleName?.trim() || element.oleEmbeddedFileName || element.fileName;
}

/** Re-render `previewImageData` from `newPayload`, matching the element's display mode (icon vs. content thumbnail). */
export async function regeneratePreview(
	element: OlePptxElement,
	kind: OlePayloadEditorKind,
	newPayload: Uint8Array,
): Promise<string> {
	if (element.oleShowAsIcon) {
		const png = renderOleIconPng({
			glyph: oleObjectTypeToGlyph(element.oleObjectType as OleObjectType | undefined),
			caption: bestOleName(element) ?? '',
		});
		return oleBytesToDataUrl(png, 'image/png');
	}
	if (kind === 'sheet-xlsx' || kind === 'sheet-xls') {
		const grid =
			kind === 'sheet-xlsx' ? await readOleSheetGrid(newPayload) : readOleXlsGrid(newPayload);
		if (grid) {
			return oleBytesToDataUrl(renderOleSheetPreviewPng(grid), 'image/png');
		}
	}
	if (kind === 'document-docx' || kind === 'document-doc') {
		const paragraphs =
			kind === 'document-docx'
				? await readOleDocumentParagraphs(newPayload)
				: readOleDocParagraphs(newPayload);
		if (paragraphs) {
			return oleBytesToDataUrl(renderOleDocumentPreviewPng(paragraphs), 'image/png');
		}
	}
	if (kind === 'deck-pptx') {
		// A full slide render belongs to the viewer bindings, not core; this
		// pulls the nested deck's actual current first-slide text so the
		// thumbnail reflects the real edit rather than a static placeholder.
		const lines = await readOleNestedDeckFirstSlideTextLines(newPayload);
		return oleBytesToDataUrl(renderOleDeckPreviewPng(lines), 'image/png');
	}
	return element.previewImageData ?? oleBytesToDataUrl(renderOleIconPng({}), 'image/png');
}

/** Build the updated element after a successful content edit: new payload, refreshed preview, dirty flag. */
export async function commitPayload(
	element: OlePptxElement,
	kind: OlePayloadEditorKind,
	newPayload: Uint8Array,
): Promise<OlePptxElement> {
	const mimeType = resolveMimeType(element);
	const previewImageData = await regeneratePreview(element, kind, newPayload);
	return {
		...element,
		oleEmbeddedData: oleBytesToDataUrl(newPayload, mimeType),
		oleEmbeddedByteSize: newPayload.length,
		previewImageData,
		oleContentDirty: true,
	};
}
