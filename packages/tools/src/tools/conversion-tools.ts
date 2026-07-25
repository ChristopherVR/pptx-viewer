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
	 * Root directory under which `outputDir` must resolve. Only meaningful when
	 * {@link ConvertToMarkdownParams.scopeOutputDir} is supplied. Defaults to
	 * `process.env.PPTX_TOOLS_ROOT` if set, else `process.cwd()`.
	 */
	rootDir?: string;
	/**
	 * Optional host-supplied guard that resolves `outputDir` under `rootDir` and
	 * rejects traversal escapes.
	 *
	 * Confining an output directory is a filesystem concern that only exists on
	 * the server, and it needs `node:path` to do correctly. This module is also
	 * reached from the browser (the in-viewer AI assistant calls this tool for
	 * the markdown string, with no filesystem, so `outputDir` is just a prefix
	 * for image links), and a `node:path` import here (even a lazy one behind a
	 * runtime check) puts a Node builtin into every bundler's module graph and
	 * makes browser builds warn. So the MCP server injects
	 * {@link resolveScopedDir} instead and browsers simply omit it.
	 */
	scopeOutputDir?: (outputDir: string, rootDir?: string) => string;
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

	const outputDir = params.outputDir ?? '.';
	const safeOutputDir = params.scopeOutputDir
		? params.scopeOutputDir(outputDir, params.rootDir)
		: outputDir;
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
