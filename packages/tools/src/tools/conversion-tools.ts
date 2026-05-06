import { isAbsolute, resolve, sep } from 'node:path';

import { PptxMarkdownConverter } from 'pptx-viewer-core';
import type { PptxConverterOptions } from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';

export interface ConvertToMarkdownParams {
	outputDir?: string;
	mediaFolderName?: string;
	includeMetadata?: boolean;
	slideRange?: { start?: number; end?: number };
	includeSpeakerNotes?: boolean;
	semanticMode?: boolean;
	sourceName?: string;
	/**
	 * Root directory under which `outputDir` must resolve. Defaults to
	 * `process.env.PPTX_TOOLS_ROOT` if set, else `process.cwd()`.
	 */
	rootDir?: string;
}

/** Resolve `outputDir` under `rootDir` and reject any traversal escape. */
function scopeOutputDir(outputDir: string, rootDir?: string): string {
	const root = resolve(rootDir ?? process.env['PPTX_TOOLS_ROOT'] ?? process.cwd());
	const resolved = isAbsolute(outputDir) ? resolve(outputDir) : resolve(root, outputDir);
	const rootWithSep = root.endsWith(sep) ? root : root + sep;
	if (resolved !== root && !resolved.startsWith(rootWithSep)) {
		throw new Error(
			`convertToMarkdown: outputDir "${outputDir}" resolves outside the allowed root "${root}"`,
		);
	}
	return resolved;
}

export interface ConvertToMarkdownResult {
	markdown: string;
	slidesConverted: number;
	totalSlides: number;
	imagesExtracted: number;
}

export async function convertToMarkdown(
	ctx: ToolContext,
	params: ConvertToMarkdownParams,
): Promise<ToolResult<ConvertToMarkdownResult>> {
	const options: PptxConverterOptions = {
		mediaFolderName: params.mediaFolderName ?? 'media',
		includeMetadata: params.includeMetadata !== false,
		slideRange: params.slideRange,
		includeSpeakerNotes: params.includeSpeakerNotes !== false,
		semanticMode: params.semanticMode === true,
		sourceName: params.sourceName ?? 'unknown',
	};

	const safeOutputDir = scopeOutputDir(params.outputDir ?? '.', params.rootDir);
	const converter = new PptxMarkdownConverter(safeOutputDir, options);
	const markdown = await converter.convert(ctx.pptxData);

	return {
		pptxData: ctx.pptxData,
		dirty: false,
		result: {
			markdown,
			slidesConverted: converter.slidesConverted,
			totalSlides: converter.presentationSlides,
			imagesExtracted: converter.imagesExtracted,
		},
	};
}
