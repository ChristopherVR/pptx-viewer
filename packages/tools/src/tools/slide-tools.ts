import type { PptxSlideTransition, PptxTransitionType } from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';
import {
	generateSlideId,
	generateElementId,
	describeElement,
	validateSlideIndex,
} from './helpers.js';

export interface GetSlideResult {
	slideIndex: number;
	slideNumber: number;
	hidden: boolean;
	layoutName?: string;
	backgroundColor?: string;
	notes: string;
	commentCount: number;
	elements: Record<string, unknown>[];
}

export function getSlide(
	ctx: ToolContext,
	params: { slideIndex: number },
): ToolResult<GetSlideResult> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	return {
		pptxData: ctx.pptxData,
		dirty: false,
		result: {
			slideIndex: params.slideIndex,
			slideNumber: slide.slideNumber,
			hidden: slide.hidden ?? false,
			layoutName: slide.layoutName,
			backgroundColor: slide.backgroundColor,
			notes: slide.notes ?? '',
			commentCount: slide.comments?.length ?? 0,
			elements: slide.elements.map(describeElement),
		},
	};
}

export interface AddSlideParams {
	insertAfterIndex?: number;
	backgroundColor?: string;
}

export interface AddSlideResult {
	newSlideIndex: number;
	slideCount: number;
}

export function addSlide(ctx: ToolContext, params: AddSlideParams): ToolResult<AddSlideResult> {
	const { slides } = ctx.pptxData;
	const insertAt =
		params.insertAfterIndex !== undefined && params.insertAfterIndex >= 0
			? Math.min(params.insertAfterIndex + 1, slides.length)
			: slides.length;

	const newSlide = {
		id: generateSlideId(),
		rId: '',
		slideNumber: insertAt + 1,
		elements: [] as [],
		backgroundColor: params.backgroundColor,
	};

	slides.splice(insertAt, 0, newSlide);
	slides.forEach((s, i) => {
		s.slideNumber = i + 1;
	});

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { newSlideIndex: insertAt, slideCount: slides.length },
	};
}

export interface DeleteSlidesParams {
	slideIndexes: number[];
}

export interface DeleteSlidesResult {
	deletedCount: number;
	slideCount: number;
}

export function deleteSlides(
	ctx: ToolContext,
	params: DeleteSlidesParams,
): ToolResult<DeleteSlidesResult> {
	const { slides } = ctx.pptxData;
	if (!params.slideIndexes || params.slideIndexes.length === 0) {
		throw new Error('slideIndexes is required for the delete action.');
	}
	const indexSet = new Set(params.slideIndexes);
	const invalid = params.slideIndexes.filter((i) => i < 0 || i >= slides.length);
	if (invalid.length > 0) {
		throw new Error(
			`Invalid slide indexes: ${invalid.join(', ')}. Valid range: 0\u2013${slides.length - 1}.`,
		);
	}
	if (indexSet.size >= slides.length) {
		throw new Error('Cannot delete all slides. At least one slide must remain.');
	}

	ctx.pptxData.slides = slides.filter((_, i) => !indexSet.has(i));
	ctx.pptxData.slides.forEach((s, i) => {
		s.slideNumber = i + 1;
	});

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { deletedCount: indexSet.size, slideCount: ctx.pptxData.slides.length },
	};
}

export interface ReorderSlidesParams {
	newOrder: number[];
}

export function reorderSlides(
	ctx: ToolContext,
	params: ReorderSlidesParams,
): ToolResult<{ slideCount: number }> {
	const { slides } = ctx.pptxData;
	if (!params.newOrder || params.newOrder.length !== slides.length) {
		throw new Error(
			`newOrder must have exactly ${slides.length} indexes. Got ${params.newOrder?.length ?? 0}.`,
		);
	}
	const sorted = [...params.newOrder].sort((a, b) => a - b);
	const expected = slides.map((_, i) => i);
	if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
		throw new Error(
			`newOrder must contain each index from 0 to ${slides.length - 1} exactly once.`,
		);
	}

	ctx.pptxData.slides = params.newOrder.map((idx) => slides[idx]);
	ctx.pptxData.slides.forEach((s, i) => {
		s.slideNumber = i + 1;
	});

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { slideCount: ctx.pptxData.slides.length },
	};
}

export interface DuplicateSlideParams {
	slideIndex: number;
	targetIndex?: number;
}

export function duplicateSlide(
	ctx: ToolContext,
	params: DuplicateSlideParams,
): ToolResult<{ newSlideIndex: number; slideCount: number }> {
	const { slides } = ctx.pptxData;
	const err = validateSlideIndex(params.slideIndex, slides.length);
	if (err) {
		throw new Error(err);
	}

	const original = slides[params.slideIndex];
	const clone = structuredClone(original);
	clone.id = generateSlideId();
	clone.rId = '';
	for (const el of clone.elements) {
		el.id = generateElementId();
	}

	const insertIndex = params.targetIndex ?? params.slideIndex + 1;
	slides.splice(insertIndex, 0, clone);
	slides.forEach((s, i) => {
		s.slideNumber = i + 1;
	});

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { newSlideIndex: insertIndex, slideCount: slides.length },
	};
}

export interface UpdateSlidePropertiesParams {
	slideIndex: number;
	backgroundColor?: string;
	backgroundGradient?: string;
	backgroundImage?: string;
	notes?: string;
	hidden?: boolean;
}

export function updateSlideProperties(
	ctx: ToolContext,
	params: UpdateSlidePropertiesParams,
): ToolResult<{ slideIndex: number }> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	if (params.backgroundColor !== undefined) {
		slide.backgroundColor = params.backgroundColor;
	}
	if (params.backgroundGradient !== undefined) {
		slide.backgroundGradient = params.backgroundGradient;
	}
	if (params.backgroundImage !== undefined) {
		slide.backgroundImage = params.backgroundImage;
	}
	if (params.notes !== undefined) {
		slide.notes = params.notes;
	}
	if (params.hidden !== undefined) {
		slide.hidden = params.hidden;
	}

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { slideIndex: params.slideIndex },
	};
}

export interface SetSlideTransitionParams {
	slideIndex: number;
	type: string;
	durationMs?: number;
	direction?: string;
	advanceOnClick?: boolean;
	advanceAfterMs?: number;
}

export function setSlideTransition(
	ctx: ToolContext,
	params: SetSlideTransitionParams,
): ToolResult<{ slideIndex: number; transitionType: string }> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	if (params.type === 'none') {
		slide.transition = undefined;
	} else {
		const transition: PptxSlideTransition = {
			type: params.type as PptxTransitionType,
		};
		if (params.durationMs !== undefined) {
			transition.durationMs = params.durationMs;
		}
		if (params.direction !== undefined) {
			transition.direction = params.direction;
		}
		if (params.advanceOnClick !== undefined) {
			transition.advanceOnClick = params.advanceOnClick;
		}
		if (params.advanceAfterMs !== undefined) {
			transition.advanceAfterMs = params.advanceAfterMs;
		}
		slide.transition = transition;
	}

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { slideIndex: params.slideIndex, transitionType: params.type },
	};
}

export interface SetCanvasSizeParams {
	width: number;
	height: number;
}

export function setCanvasSize(
	ctx: ToolContext,
	params: SetCanvasSizeParams,
): ToolResult<{ canvasWidth: number; canvasHeight: number }> {
	ctx.pptxData.width = params.width;
	ctx.pptxData.height = params.height;
	if (ctx.pptxData.widthEmu !== undefined) {
		ctx.pptxData.widthEmu = Math.round(params.width * 12700);
	}
	if (ctx.pptxData.heightEmu !== undefined) {
		ctx.pptxData.heightEmu = Math.round(params.height * 12700);
	}

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { canvasWidth: params.width, canvasHeight: params.height },
	};
}
