/**
 * Deck-as-JSON export helper shared by every binding's "Export as JSON"
 * backstage card. All of the actual serialization lives in core
 * (`PptxJsonConverter`); this module only assembles the download filename and
 * hands the JSON text to the shared blob-download helper, so each binding's
 * wiring stays a one-liner.
 */

import { serializePptxToJson, PPTX_JSON_MIME_TYPE } from 'pptx-viewer-core';
import type { PptxData } from 'pptx-viewer-core';

import { downloadBlob, sanitizeDownloadFilename } from './download-helpers';

/** Default base name used when the host supplies no source file name. */
const DEFAULT_BASE_NAME = 'presentation';

/**
 * Derive the download name for a deck-JSON export from the source file name:
 * `deck.pptx` becomes `deck.json`, a missing name becomes `presentation.json`.
 */
export function deckJsonFileName(sourceName?: string | null): string {
	const base = (sourceName ?? '').replace(/\.(pptx|ppsx|pptm|potx|json)$/iu, '').trim();
	return sanitizeDownloadFilename(`${base.length > 0 ? base : DEFAULT_BASE_NAME}.json`);
}

/** Build the serialized `pptx-viewer-json` text for a deck. */
export function buildDeckJson(data: PptxData): string {
	return serializePptxToJson(data, { generator: 'pptx-viewer', pretty: true });
}

/**
 * Serialize the deck to `pptx-viewer-json` and trigger a browser download.
 * Returns the filename that was used.
 */
export function exportDeckJson(data: PptxData, sourceName?: string | null): string {
	const fileName = deckJsonFileName(sourceName);
	const json = buildDeckJson(data);
	downloadBlob(new Blob([json], { type: PPTX_JSON_MIME_TYPE }), fileName);
	return fileName;
}
