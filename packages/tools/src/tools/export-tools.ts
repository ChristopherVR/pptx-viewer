import { SvgExporter } from 'pptx-viewer-core';
import type { SvgExportOptions } from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';
import { validateSlideIndex } from './helpers.js';

// ── exportToSvg ──────────────────────────────────────────────────────────────

export interface ExportToSvgParams {
	slideIndices?: number[];
	includeHidden?: boolean;
	defaultFontFamily?: string;
	defaultFontSize?: number;
}

export interface ExportToSvgResult {
	svgStrings: string[];
	slideCount: number;
}

export function exportToSvg(
	ctx: ToolContext,
	params: ExportToSvgParams,
): ToolResult<ExportToSvgResult> {
	if (params.slideIndices) {
		for (const si of params.slideIndices) {
			const err = validateSlideIndex(si, ctx.pptxData.slides.length);
			if (err) {
				throw new Error(err);
			}
		}
	}

	const options: SvgExportOptions = {};
	if (params.slideIndices) {
		options.slideIndices = params.slideIndices;
	}
	if (params.includeHidden !== undefined) {
		options.includeHidden = params.includeHidden;
	}
	if (params.defaultFontFamily) {
		options.defaultFontFamily = params.defaultFontFamily;
	}
	if (params.defaultFontSize) {
		options.defaultFontSize = params.defaultFontSize;
	}

	const svgStrings = SvgExporter.exportAll(ctx.pptxData, options);

	return {
		pptxData: ctx.pptxData,
		dirty: false,
		result: { svgStrings, slideCount: svgStrings.length },
	};
}

// ── exportSlideSvg ───────────────────────────────────────────────────────────

export interface ExportSlideSvgParams {
	slideIndex: number;
	defaultFontFamily?: string;
	defaultFontSize?: number;
}

export interface ExportSlideSvgResult {
	svg: string;
	slideIndex: number;
}

export function exportSlideSvg(
	ctx: ToolContext,
	params: ExportSlideSvgParams,
): ToolResult<ExportSlideSvgResult> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	const width = ctx.pptxData.width ?? 960;
	const height = ctx.pptxData.height ?? 540;
	const options: SvgExportOptions = {};
	if (params.defaultFontFamily) {
		options.defaultFontFamily = params.defaultFontFamily;
	}
	if (params.defaultFontSize) {
		options.defaultFontSize = params.defaultFontSize;
	}

	const svg = SvgExporter.exportSlide(slide, width, height, options);

	return {
		pptxData: ctx.pptxData,
		dirty: false,
		result: { svg, slideIndex: params.slideIndex },
	};
}
