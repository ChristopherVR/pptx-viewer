import type { PptxPresentationProperties } from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';

// ── getPresentationProperties ────────────────────────────────────────────────

export function getPresentationProperties(ctx: ToolContext): ToolResult<{
	properties: PptxPresentationProperties | undefined;
	slideCount: number;
	width?: number;
	height?: number;
}> {
	return {
		pptxData: ctx.pptxData,
		dirty: false,
		result: {
			properties: ctx.pptxData.presentationProperties,
			slideCount: ctx.pptxData.slides.length,
			width: ctx.pptxData.width,
			height: ctx.pptxData.height,
		},
	};
}

// ── updatePresentationProperties ─────────────────────────────────────────────

export interface UpdatePresentationPropertiesParams {
	showType?: 'presented' | 'browsed' | 'kiosk';
	loopContinuously?: boolean;
	showWithNarration?: boolean;
	showWithAnimation?: boolean;
	advanceMode?: 'manual' | 'useTimings';
	showSlidesMode?: 'all' | 'customShow' | 'range';
	showSlidesFrom?: number;
	showSlidesTo?: number;
	penColor?: string;
}

export function updatePresentationProperties(
	ctx: ToolContext,
	params: UpdatePresentationPropertiesParams,
): ToolResult<{ properties: PptxPresentationProperties }> {
	if (!ctx.pptxData.presentationProperties) {
		(
			ctx.pptxData as { presentationProperties: PptxPresentationProperties }
		).presentationProperties = {};
	}
	const pp = ctx.pptxData.presentationProperties!;

	if (params.showType !== undefined) {
		pp.showType = params.showType;
	}
	if (params.loopContinuously !== undefined) {
		pp.loopContinuously = params.loopContinuously;
	}
	if (params.showWithNarration !== undefined) {
		pp.showWithNarration = params.showWithNarration;
	}
	if (params.showWithAnimation !== undefined) {
		pp.showWithAnimation = params.showWithAnimation;
	}
	if (params.advanceMode !== undefined) {
		pp.advanceMode = params.advanceMode;
	}
	if (params.showSlidesMode !== undefined) {
		pp.showSlidesMode = params.showSlidesMode;
	}
	if (params.showSlidesFrom !== undefined) {
		pp.showSlidesFrom = params.showSlidesFrom;
	}
	if (params.showSlidesTo !== undefined) {
		pp.showSlidesTo = params.showSlidesTo;
	}
	if (params.penColor !== undefined) {
		pp.penColor = params.penColor;
	}

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { properties: pp },
	};
}
