import type { PptxAction } from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';
import { validateSlideIndex } from './helpers.js';

// ── manageHyperlinks ─────────────────────────────────────────────────────────

export interface ManageHyperlinksParams {
	slideIndex: number;
	action: 'list' | 'set' | 'remove';
	elementId?: string;
	trigger?: 'click' | 'hover';
	url?: string;
	tooltip?: string;
	targetSlideIndex?: number;
	actionType?: 'url' | 'slide' | 'nextSlide' | 'prevSlide' | 'firstSlide' | 'lastSlide' | 'endShow';
}

export interface HyperlinkInfo {
	elementId: string;
	trigger: 'click' | 'hover';
	url?: string;
	tooltip?: string;
	targetSlideIndex?: number;
	actionType?: string;
}

export interface ManageHyperlinksResult {
	action: string;
	hyperlinks?: HyperlinkInfo[];
	elementId?: string;
}

export function manageHyperlinks(
	ctx: ToolContext,
	params: ManageHyperlinksParams,
): ToolResult<ManageHyperlinksResult> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];

	switch (params.action) {
		case 'list': {
			const hyperlinks: HyperlinkInfo[] = [];
			for (const el of slide.elements) {
				if (el.actionClick) {
					hyperlinks.push({
						elementId: el.id,
						trigger: 'click',
						url: el.actionClick.url,
						tooltip: el.actionClick.tooltip,
						targetSlideIndex: el.actionClick.targetSlideIndex,
						actionType: el.actionClick.action,
					});
				}
				if (el.actionHover) {
					hyperlinks.push({
						elementId: el.id,
						trigger: 'hover',
						url: el.actionHover.url,
						tooltip: el.actionHover.tooltip,
						targetSlideIndex: el.actionHover.targetSlideIndex,
						actionType: el.actionHover.action,
					});
				}
			}
			return { pptxData: ctx.pptxData, dirty: false, result: { action: 'list', hyperlinks } };
		}

		case 'set': {
			if (!params.elementId) {
				throw new Error('elementId is required for set action.');
			}
			const el = slide.elements.find((e) => e.id === params.elementId);
			if (!el) {
				throw new Error(`Element '${params.elementId}' not found on slide ${params.slideIndex}.`);
			}

			const trigger = params.trigger ?? 'click';
			const action: PptxAction = {};
			if (params.url) {
				action.url = params.url;
			}
			if (params.tooltip) {
				action.tooltip = params.tooltip;
			}
			if (params.targetSlideIndex !== undefined) {
				action.targetSlideIndex = params.targetSlideIndex;
			}
			if (params.actionType) {
				switch (params.actionType) {
					case 'url':
						action.action = 'ppaction://hlinkpres';
						break;
					case 'slide':
						action.action = 'ppaction://hlinksldjump';
						break;
					case 'nextSlide':
						action.action = 'ppaction://hlinkshowjump?jump=nextslide';
						break;
					case 'prevSlide':
						action.action = 'ppaction://hlinkshowjump?jump=previousslide';
						break;
					case 'firstSlide':
						action.action = 'ppaction://hlinkshowjump?jump=firstslide';
						break;
					case 'lastSlide':
						action.action = 'ppaction://hlinkshowjump?jump=lastslide';
						break;
					case 'endShow':
						action.action = 'ppaction://hlinkshowjump?jump=endshow';
						break;
				}
			}

			if (trigger === 'click') {
				el.actionClick = action;
			} else {
				el.actionHover = action;
			}

			return {
				pptxData: ctx.pptxData,
				dirty: true,
				result: { action: 'set', elementId: params.elementId },
			};
		}

		case 'remove': {
			if (!params.elementId) {
				throw new Error('elementId is required for remove action.');
			}
			const el = slide.elements.find((e) => e.id === params.elementId);
			if (!el) {
				throw new Error(`Element '${params.elementId}' not found on slide ${params.slideIndex}.`);
			}

			const trigger = params.trigger ?? 'click';
			if (trigger === 'click') {
				el.actionClick = undefined;
			} else {
				el.actionHover = undefined;
			}

			return {
				pptxData: ctx.pptxData,
				dirty: true,
				result: { action: 'remove', elementId: params.elementId },
			};
		}

		default:
			throw new Error(`Unknown hyperlink action: ${String(params.action)}`);
	}
}
