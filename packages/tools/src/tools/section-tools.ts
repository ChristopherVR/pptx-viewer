import {
	addSection,
	removeSection,
	reorderSections,
	getSectionForSlide,
	moveSlidesToSection,
} from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';

// ── manageSections ───────────────────────────────────────────────────────────

export interface ManageSectionsParams {
	action: 'list' | 'add' | 'remove' | 'reorder' | 'moveSlides' | 'getForSlide';
	name?: string;
	slideIndices?: number[];
	sectionId?: string;
	sectionIds?: string[];
	slideIndex?: number;
}

export interface SectionInfo {
	id: string;
	name: string;
	slideIds: string[];
	collapsed?: boolean;
	color?: string;
}

export interface ManageSectionsResult {
	action: string;
	sections?: SectionInfo[];
	section?: SectionInfo | null;
	success?: boolean;
}

export function manageSections(
	ctx: ToolContext,
	params: ManageSectionsParams,
): ToolResult<ManageSectionsResult> {
	switch (params.action) {
		case 'list': {
			const sections: SectionInfo[] = (ctx.pptxData.sections ?? []).map((s) => ({
				id: s.id,
				name: s.name,
				slideIds: s.slideIds,
				collapsed: s.collapsed,
				color: s.color,
			}));
			return { pptxData: ctx.pptxData, dirty: false, result: { action: 'list', sections } };
		}

		case 'add': {
			if (!params.name) {
				throw new Error('name is required for add action.');
			}
			const section = addSection(ctx.pptxData, params.name, params.slideIndices ?? []);
			return {
				pptxData: ctx.pptxData,
				dirty: true,
				result: {
					action: 'add',
					section: { id: section.id, name: section.name, slideIds: section.slideIds },
				},
			};
		}

		case 'remove': {
			if (!params.sectionId) {
				throw new Error('sectionId is required for remove action.');
			}
			const success = removeSection(ctx.pptxData, params.sectionId);
			return { pptxData: ctx.pptxData, dirty: success, result: { action: 'remove', success } };
		}

		case 'reorder': {
			if (!params.sectionIds) {
				throw new Error('sectionIds is required for reorder action.');
			}
			reorderSections(ctx.pptxData, params.sectionIds);
			return { pptxData: ctx.pptxData, dirty: true, result: { action: 'reorder', success: true } };
		}

		case 'moveSlides': {
			if (!params.sectionId) {
				throw new Error('sectionId is required for moveSlides action.');
			}
			if (!params.slideIndices) {
				throw new Error('slideIndices is required for moveSlides action.');
			}
			const success = moveSlidesToSection(ctx.pptxData, params.slideIndices, params.sectionId);
			return { pptxData: ctx.pptxData, dirty: success, result: { action: 'moveSlides', success } };
		}

		case 'getForSlide': {
			if (params.slideIndex === undefined) {
				throw new Error('slideIndex is required for getForSlide action.');
			}
			const section = getSectionForSlide(ctx.pptxData, params.slideIndex);
			const info = section
				? { id: section.id, name: section.name, slideIds: section.slideIds }
				: null;
			return {
				pptxData: ctx.pptxData,
				dirty: false,
				result: { action: 'getForSlide', section: info },
			};
		}

		default:
			throw new Error(`Unknown section action: ${String(params.action)}`);
	}
}
