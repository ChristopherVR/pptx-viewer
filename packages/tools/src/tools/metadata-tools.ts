import type { PptxCoreProperties, PptxAppProperties, PptxCustomProperty } from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';

// ── getMetadata ──────────────────────────────────────────────────────────────

export interface MetadataResult {
	coreProperties?: PptxCoreProperties;
	appProperties?: PptxAppProperties;
	customProperties?: PptxCustomProperty[];
	slideCount: number;
}

export function getMetadata(ctx: ToolContext): ToolResult<MetadataResult> {
	return {
		pptxData: ctx.pptxData,
		dirty: false,
		result: {
			coreProperties: ctx.pptxData.coreProperties,
			appProperties: ctx.pptxData.appProperties,
			customProperties: ctx.pptxData.customProperties,
			slideCount: ctx.pptxData.slides.length,
		},
	};
}

// ── updateMetadata ───────────────────────────────────────────────────────────

export interface UpdateMetadataParams {
	title?: string;
	subject?: string;
	creator?: string;
	keywords?: string;
	description?: string;
	lastModifiedBy?: string;
	category?: string;
	company?: string;
	manager?: string;
	customProperties?: Array<{ name: string; value: string | number | boolean }>;
}

export function updateMetadata(
	ctx: ToolContext,
	params: UpdateMetadataParams,
): ToolResult<{ updated: string[] }> {
	const updated: string[] = [];

	// Core properties
	if (
		params.title !== undefined ||
		params.subject !== undefined ||
		params.creator !== undefined ||
		params.keywords !== undefined ||
		params.description !== undefined ||
		params.lastModifiedBy !== undefined ||
		params.category !== undefined
	) {
		if (!ctx.pptxData.coreProperties) {
			(ctx.pptxData as unknown as { coreProperties: PptxCoreProperties }).coreProperties = {};
		}
		const cp = ctx.pptxData.coreProperties!;
		if (params.title !== undefined) {
			cp.title = params.title;
			updated.push('title');
		}
		if (params.subject !== undefined) {
			cp.subject = params.subject;
			updated.push('subject');
		}
		if (params.creator !== undefined) {
			cp.creator = params.creator;
			updated.push('creator');
		}
		if (params.keywords !== undefined) {
			cp.keywords = params.keywords;
			updated.push('keywords');
		}
		if (params.description !== undefined) {
			cp.description = params.description;
			updated.push('description');
		}
		if (params.lastModifiedBy !== undefined) {
			cp.lastModifiedBy = params.lastModifiedBy;
			updated.push('lastModifiedBy');
		}
		if (params.category !== undefined) {
			cp.category = params.category;
			updated.push('category');
		}
	}

	// App properties
	if (params.company !== undefined || params.manager !== undefined) {
		if (!ctx.pptxData.appProperties) {
			(ctx.pptxData as unknown as { appProperties: PptxAppProperties }).appProperties = {};
		}
		const ap = ctx.pptxData.appProperties!;
		if (params.company !== undefined) {
			ap.company = params.company;
			updated.push('company');
		}
		if (params.manager !== undefined) {
			ap.manager = params.manager;
			updated.push('manager');
		}
	}

	// Custom properties
	if (params.customProperties) {
		if (!ctx.pptxData.customProperties) {
			(
				ctx.pptxData as unknown as {
					customProperties: Array<{ name: string; value: string; type: string }>;
				}
			).customProperties = [];
		}
		for (const cp of params.customProperties) {
			const valueStr = String(cp.value);
			const vtType =
				typeof cp.value === 'number' ? 'i4' : typeof cp.value === 'boolean' ? 'bool' : 'lpwstr';
			const existing = ctx.pptxData.customProperties!.find((p) => p.name === cp.name);
			if (existing) {
				existing.value = valueStr;
				existing.type = vtType;
			} else {
				ctx.pptxData.customProperties!.push({ name: cp.name, value: valueStr, type: vtType });
			}
			updated.push(`custom:${cp.name}`);
		}
	}

	return {
		pptxData: ctx.pptxData,
		dirty: updated.length > 0,
		result: { updated },
	};
}
