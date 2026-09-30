import { findLayoutByName, findLayoutByType } from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';
import { generateElementId, validateSlideIndex } from './helpers.js';

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
	const master = ctx.pptxData.slideMasters?.find((candidate) =>
		candidate.layouts?.some((definition) => definition.path === layout.path),
	);
	const definition = master?.layouts?.find((candidate) => candidate.path === layout.path);
	for (const frame of definition?.placeholders ?? []) {
		if (['dt', 'ftr', 'sldnum', 'hdr'].includes(frame.type)) {
			continue;
		}
		const ph = {
			'@_type': frame.type === 'ctrtitle' ? 'ctrTitle' : frame.type,
			...(frame.idx !== undefined ? { '@_idx': frame.idx } : {}),
		};
		if (
			slide.elements.some((element) => {
				const nv = element.rawXml?.['p:nvSpPr'] as Record<string, unknown> | undefined;
				const nvPr = nv?.['p:nvPr'] as Record<string, unknown> | undefined;
				const existing = nvPr?.['p:ph'] as Record<string, unknown> | undefined;
				return (
					element.placeholderType === frame.type &&
					String(existing?.['@_idx'] ?? '0') === String(frame.idx ?? '0')
				);
			})
		) {
			continue;
		}
		const inherited =
			master?.placeholders?.find(
				(candidate) =>
					candidate.type === frame.type && (candidate.idx ?? '0') === (frame.idx ?? '0'),
			) ?? master?.placeholders?.find((candidate) => candidate.type === frame.type);
		slide.elements.push({
			id: generateElementId(),
			type: 'text',
			placeholderType: frame.type,
			x: frame.x ?? inherited?.x ?? 0,
			y: frame.y ?? inherited?.y ?? 0,
			width: frame.width ?? inherited?.width ?? ctx.pptxData.width,
			height: frame.height ?? inherited?.height ?? ctx.pptxData.height,
			text: '',
			textSegments: [{ text: '', style: {} }],
			rawXml: {
				'p:nvSpPr': {
					'p:cNvPr': { '@_name': frame.type },
					'p:cNvSpPr': {},
					'p:nvPr': { 'p:ph': ph },
				},
				'p:spPr': {},
			},
		});
	}

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { slideIndex: params.slideIndex, layoutName: layout.name ?? 'Unknown' },
	};
}
