import {
	applyImportedPptxData,
	buildPptxJsonDocument,
	deserializePptxFromJson,
} from 'pptx-viewer-core';
import type { PptxJsonAssetStats } from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';

// ── exportToJson ─────────────────────────────────────────────────────────────

export interface ExportToJsonParams {
	/** Pretty-print with 2-space indentation. Default `true`. */
	pretty?: boolean;
}

export interface ExportToJsonResult {
	/** The serialized `pptx-viewer-json` document text. */
	json: string;
	slideCount: number;
	/** UTF-8 byte size of the serialized document. */
	byteSize: number;
	/** Embedded binary-asset accounting (count + decoded bytes). */
	assets: PptxJsonAssetStats;
}

/**
 * Serialize the presentation to the portable, self-contained
 * `pptx-viewer-json` document format (binary assets embedded as base64).
 */
export function exportToJson(
	ctx: ToolContext,
	params: ExportToJsonParams,
): ToolResult<ExportToJsonResult> {
	const document = buildPptxJsonDocument(ctx.pptxData, { generator: 'pptx-viewer-mcp' });
	const json = JSON.stringify(document, null, params.pretty === false ? undefined : 2);

	return {
		pptxData: ctx.pptxData,
		dirty: false,
		result: {
			json,
			slideCount: document.slideCount,
			byteSize: new TextEncoder().encode(json).byteLength,
			assets: document.assets,
		},
	};
}

// ── importFromJson ───────────────────────────────────────────────────────────

export interface ImportFromJsonParams {
	/** The `pptx-viewer-json` document text to import. */
	json: string;
}

export interface ImportFromJsonResult {
	slideCount: number;
	width: number;
	height: number;
}

/**
 * Replace the presentation content with a deck imported from a
 * `pptx-viewer-json` document: every presentation-level field the document
 * defines wins, and the slide array is replaced wholesale. The context's
 * `pptxData` object is mutated in place so hosts holding a reference (viewer
 * bridges, the save pipeline) observe the imported deck.
 */
export function importFromJson(
	ctx: ToolContext,
	params: ImportFromJsonParams,
): ToolResult<ImportFromJsonResult> {
	const imported = deserializePptxFromJson(params.json);
	applyImportedPptxData(ctx.pptxData, imported);

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: {
			slideCount: ctx.pptxData.slides.length,
			width: ctx.pptxData.width,
			height: ctx.pptxData.height,
		},
	};
}
