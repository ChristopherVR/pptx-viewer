import { mergePresentation, diffPresentations } from 'pptx-viewer-core';
import type { PresentationDiff, MergeOptions, PptxData } from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';

// ── mergePresentationT ───────────────────────────────────────────────────────

export interface MergePresentationParams {
	/** The source presentation data to merge FROM. */
	sourceData: PptxData;
	/** Specific slide indices from source to merge. If omitted, all slides. */
	slideIndices?: number[];
	/** Where to insert in the target (0-based). Defaults to end. */
	insertAt?: number;
	/** Whether to keep the source theme. */
	keepSourceTheme?: boolean;
}

export interface MergePresentationResult {
	slidesAdded: number;
	totalSlides: number;
}

export function mergePresentationT(
	ctx: ToolContext,
	params: MergePresentationParams,
): ToolResult<MergePresentationResult> {
	const options: MergeOptions = {};
	if (params.slideIndices) {
		options.slideIndices = params.slideIndices;
	}
	if (params.insertAt !== undefined) {
		options.insertAt = params.insertAt;
	}
	if (params.keepSourceTheme !== undefined) {
		options.keepSourceTheme = params.keepSourceTheme;
	}

	const added = mergePresentation(ctx.pptxData, params.sourceData, options);

	return {
		pptxData: ctx.pptxData,
		dirty: added > 0,
		result: { slidesAdded: added, totalSlides: ctx.pptxData.slides.length },
	};
}

// ── diffPresentationsT ───────────────────────────────────────────────────────

export interface DiffPresentationsParams {
	/** The other presentation data to diff against. */
	otherData: PptxData;
}

export function diffPresentationsT(
	ctx: ToolContext,
	params: DiffPresentationsParams,
): ToolResult<PresentationDiff> {
	const diff = diffPresentations(ctx.pptxData, params.otherData);
	return {
		pptxData: ctx.pptxData,
		dirty: false,
		result: diff,
	};
}
