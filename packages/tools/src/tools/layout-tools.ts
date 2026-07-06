import { findLayoutByName, findLayoutByType } from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';
import { validateSlideIndex } from './helpers.js';

// ── getLayouts ───────────────────────────────────────────────────────────────

export interface LayoutInfo {
	name: string;
	path?: string;
	type?: string;
}

export interface GetLayoutsResult {
	layouts: LayoutInfo[];
	count: number;
}

export function getLayouts(ctx: ToolContext): ToolResult<GetLayoutsResult> {
	const layouts: LayoutInfo[] = [];

	// Extract layout info from slideMasters if available
	if (ctx.pptxData.slideMasters) {
		for (const master of ctx.pptxData.slideMasters) {
			if (master.layouts) {
				for (const layout of master.layouts) {
					layouts.push({
						name: layout.name ?? 'Unknown',
						path: layout.path,
					});
				}
			}
		}
	}

	// Also check layoutOptions (populated during load)
	if (ctx.pptxData.layoutOptions) {
		for (const opt of ctx.pptxData.layoutOptions) {
			if (!layouts.some((l) => l.path === opt.path)) {
				layouts.push({ name: opt.name, path: opt.path, type: opt.type });
			}
		}
	}

	return {
		pptxData: ctx.pptxData,
		dirty: false,
		result: { layouts, count: layouts.length },
	};
}

// ── applyLayout ──────────────────────────────────────────────────────────────

export interface ApplyLayoutParams {
	slideIndex: number;
	layoutName?: string;
	layoutType?: string;
}

export interface ApplyLayoutResult {
	slideIndex: number;
	layoutName: string;
}

export function applyLayout(
	ctx: ToolContext,
	params: ApplyLayoutParams,
): ToolResult<ApplyLayoutResult> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	let layout;
	if (params.layoutName) {
		layout = findLayoutByName(ctx.pptxData, params.layoutName);
	} else if (params.layoutType) {
		layout = findLayoutByType(ctx.pptxData, params.layoutType);
	} else {
		throw new Error('Either layoutName or layoutType must be provided.');
	}

	if (!layout) {
		throw new Error(
			`Layout not found: ${params.layoutName ?? params.layoutType}. Use get_layouts to see available layouts.`,
		);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	slide.layoutName = layout.name;
	if (layout.path) {
		slide.layoutPath = layout.path;
	}

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { slideIndex: params.slideIndex, layoutName: layout.name ?? 'Unknown' },
	};
}
