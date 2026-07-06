import type { ShapePptxElement } from 'pptx-viewer-core';
import { replaceShapeGeometry, replaceWithCustomGeometry } from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';
import { validateSlideIndex } from './helpers.js';

// ── replaceGeometry ──────────────────────────────────────────────────────────

export interface ReplaceGeometryParams {
	slideIndex: number;
	elementId: string;
	/** New preset shape type (e.g. "roundRect", "star5", "ellipse"). */
	shapeType?: string;
	/** Custom SVG path data (mutually exclusive with shapeType). */
	svgPath?: string;
	/** Width of the custom path coordinate space. */
	pathWidth?: number;
	/** Height of the custom path coordinate space. */
	pathHeight?: number;
	/** Adjustment values for the new geometry. */
	adjustments?: Record<string, number>;
}

export function replaceGeometry(
	ctx: ToolContext,
	params: ReplaceGeometryParams,
): ToolResult<{ elementId: string; geometryType: string }> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	const el = slide.elements.find((e) => e.id === params.elementId);
	if (!el) {
		throw new Error(`Element '${params.elementId}' not found on slide ${params.slideIndex}.`);
	}
	if (el.type !== 'shape') {
		throw new Error(`Element '${params.elementId}' is not a shape.`);
	}

	const shape = el as ShapePptxElement;

	if (params.svgPath) {
		replaceWithCustomGeometry(shape, params.svgPath, params.pathWidth, params.pathHeight);
		return {
			pptxData: ctx.pptxData,
			dirty: true,
			result: { elementId: params.elementId, geometryType: 'custom' },
		};
	}

	if (params.shapeType) {
		replaceShapeGeometry(shape, params.shapeType, params.adjustments);
		return {
			pptxData: ctx.pptxData,
			dirty: true,
			result: { elementId: params.elementId, geometryType: params.shapeType },
		};
	}

	throw new Error('Either shapeType or svgPath must be provided.');
}
