import { applyTemplate, findPlaceholders } from 'pptx-viewer-core';
import type { TemplateData } from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';

// ── findPlaceholdersT ────────────────────────────────────────────────────────

export interface FindPlaceholdersResult {
	placeholders: string[];
	count: number;
}

export function findPlaceholdersT(ctx: ToolContext): ToolResult<FindPlaceholdersResult> {
	const placeholders = findPlaceholders(ctx.pptxData);
	return {
		pptxData: ctx.pptxData,
		dirty: false,
		result: { placeholders, count: placeholders.length },
	};
}

// ── applyTemplateT ───────────────────────────────────────────────────────────

export interface ApplyTemplateParams {
	data: Record<string, unknown>;
}

export interface ApplyTemplateResult {
	applied: boolean;
	slideCount: number;
}

export function applyTemplateT(
	ctx: ToolContext,
	params: ApplyTemplateParams,
): ToolResult<ApplyTemplateResult> {
	applyTemplate(ctx.pptxData, params.data as TemplateData);
	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { applied: true, slideCount: ctx.pptxData.slides.length },
	};
}
