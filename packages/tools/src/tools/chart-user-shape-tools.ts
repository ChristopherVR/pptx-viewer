import type { ChartPptxElement, PptxChartUserShape } from 'pptx-viewer-core';
import {
	addChartUserShape,
	listChartUserShapes,
	removeChartUserShape,
	updateChartUserShape,
} from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';
import { validateSlideIndex } from './helpers.js';

/**
 * Chart drawing-overlay (`c:userShapes`) tools (C2-G10 edit/serialize
 * follow-up). Follows the exact `chart-tools.ts` pattern: resolve the slide
 * and chart element, run a core SDK op, and let the save pipeline
 * (`PptxHandlerRuntimeChartUserShapes`) reconcile the drawing part.
 *
 * `packages/tools` cannot depend on `pptx-viewer-shared` (the dependency runs
 * the other way: shared's AI tool registry imports this package), so the
 * flat "add" input shape below is a small, deliberate duplicate of shared's
 * `createDefaultChartUserShape` convenience default rather than a shared
 * import.
 */

function findChartElement(
	ctx: ToolContext,
	slideIndex: number,
	elementId: string,
): ChartPptxElement {
	const err = validateSlideIndex(slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}
	const slide = ctx.pptxData.slides[slideIndex];
	const el = slide.elements.find((e) => e.id === elementId);
	if (!el) {
		throw new Error(`Element '${elementId}' not found on slide ${slideIndex}.`);
	}
	if (el.type !== 'chart') {
		throw new Error(`Element '${elementId}' is not a chart.`);
	}
	return el as ChartPptxElement;
}

/** The overlay-shape fields an AI tool call can set, flattened from `PptxChartUserShape`. */
export interface ChartUserShapeInput {
	kind?: 'sp' | 'cxnSp';
	anchor?: 'rel' | 'abs';
	from: { x: number; y: number };
	to?: { x: number; y: number };
	ext?: { cx: number; cy: number };
	prst?: string;
	fill?: string;
	stroke?: string;
	strokeWidth?: number;
	/** Plain text content; mapped onto a single centred paragraph. */
	text?: string;
}

function buildShape(input: ChartUserShapeInput): PptxChartUserShape {
	return {
		kind: input.kind ?? 'sp',
		anchor: input.anchor ?? 'rel',
		from: input.from,
		...(input.to ? { to: input.to } : {}),
		...(input.ext ? { ext: input.ext } : {}),
		...(input.prst ? { prst: input.prst } : {}),
		...(input.fill ? { fill: input.fill } : {}),
		...(input.stroke ? { stroke: input.stroke } : {}),
		...(input.strokeWidth !== undefined ? { strokeWidth: input.strokeWidth } : {}),
		...(input.text ? { paragraphs: [{ text: input.text, align: 'ctr' }] } : {}),
	};
}

// ── chart_user_shape_list ───────────────────────────────────────────────────

export interface ListChartUserShapesParams {
	slideIndex: number;
	elementId: string;
}

export function listChartUserShapesT(
	ctx: ToolContext,
	params: ListChartUserShapesParams,
): ToolResult<{ shapes: PptxChartUserShape[] }> {
	const chart = findChartElement(ctx, params.slideIndex, params.elementId);
	return { pptxData: ctx.pptxData, dirty: false, result: { shapes: listChartUserShapes(chart) } };
}

// ── chart_user_shape_add ────────────────────────────────────────────────────

export interface AddChartUserShapeParams {
	slideIndex: number;
	elementId: string;
	shape: ChartUserShapeInput;
}

export function addChartUserShapeT(
	ctx: ToolContext,
	params: AddChartUserShapeParams,
): ToolResult<{ elementId: string; index: number }> {
	const chart = findChartElement(ctx, params.slideIndex, params.elementId);
	addChartUserShape(chart, buildShape(params.shape));
	const index = (chart.chartData?.userShapes?.length ?? 1) - 1;
	return { pptxData: ctx.pptxData, dirty: true, result: { elementId: params.elementId, index } };
}

// ── chart_user_shape_update ─────────────────────────────────────────────────

export interface UpdateChartUserShapeParams {
	slideIndex: number;
	elementId: string;
	index: number;
	patch: Partial<ChartUserShapeInput>;
}

export function updateChartUserShapeT(
	ctx: ToolContext,
	params: UpdateChartUserShapeParams,
): ToolResult<{ elementId: string }> {
	const chart = findChartElement(ctx, params.slideIndex, params.elementId);
	const patch: Partial<PptxChartUserShape> = {
		...(params.patch.kind ? { kind: params.patch.kind } : {}),
		...(params.patch.anchor ? { anchor: params.patch.anchor } : {}),
		...(params.patch.from ? { from: params.patch.from } : {}),
		...(params.patch.to ? { to: params.patch.to } : {}),
		...(params.patch.ext ? { ext: params.patch.ext } : {}),
		...(params.patch.prst ? { prst: params.patch.prst } : {}),
		...(params.patch.fill ? { fill: params.patch.fill } : {}),
		...(params.patch.stroke ? { stroke: params.patch.stroke } : {}),
		...(params.patch.strokeWidth !== undefined ? { strokeWidth: params.patch.strokeWidth } : {}),
		...(params.patch.text !== undefined
			? { paragraphs: [{ text: params.patch.text, align: 'ctr' as const }] }
			: {}),
	};
	updateChartUserShape(chart, params.index, patch);
	return { pptxData: ctx.pptxData, dirty: true, result: { elementId: params.elementId } };
}

// ── chart_user_shape_remove ─────────────────────────────────────────────────

export interface RemoveChartUserShapeParams {
	slideIndex: number;
	elementId: string;
	index: number;
}

export function removeChartUserShapeT(
	ctx: ToolContext,
	params: RemoveChartUserShapeParams,
): ToolResult<{ elementId: string }> {
	const chart = findChartElement(ctx, params.slideIndex, params.elementId);
	removeChartUserShape(chart, params.index);
	return { pptxData: ctx.pptxData, dirty: true, result: { elementId: params.elementId } };
}
