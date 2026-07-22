import { PptxMarkdownConverter } from 'pptx-viewer-core';
import type { PptxConverterOptions } from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';

/** True when running under Node (has a real filesystem to scope paths against). */
function isNodeRuntime(): boolean {
	return typeof process !== 'undefined' && Boolean(process.versions?.node);
}

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

/**
 * Resolve `outputDir` under `rootDir` and reject any traversal escape. This is a
 * filesystem-security concern that only applies on the server (Node): the
 * `node:path` module is imported lazily so this tool stays browser-safe (the
 * in-viewer AI assistant calls it for the markdown string, with no filesystem,
 * so the output dir is just a prefix for image links).
 */
async function scopeOutputDir(outputDir: string, rootDir?: string): Promise<string> {
	if (!isNodeRuntime()) {
		return outputDir;
	}
	const { isAbsolute, resolve, sep } = await import('node:path');
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

	const safeOutputDir = await scopeOutputDir(params.outputDir ?? '.', params.rootDir);
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
