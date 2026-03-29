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

	const converter = new PptxMarkdownConverter(params.outputDir ?? '.', options);
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
