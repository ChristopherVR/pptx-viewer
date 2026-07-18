/**
 * Navigation tool executors: move the viewport and drive selection. These are
 * view-state changes (not document edits), so they act on the bridge directly
 * and never stage a proposal.
 */

import type { AiToolContext, AiToolExecutor } from './executor-base';
import { requireSlide } from './executor-base';

const goToSlide: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as { slideIndex: number };
	requireSlide(ctx.bridge.getSlides(), p.slideIndex);
	ctx.bridge.goToSlide(p.slideIndex);
	return { slideIndex: p.slideIndex, navigated: true };
};

const selectElements: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as { slideIndex: number; elementIds: string[] };
	const slide = requireSlide(ctx.bridge.getSlides(), p.slideIndex);
	const known = new Set(slide.elements.map((e) => e.id));
	const unknownIds = p.elementIds.filter((id) => !known.has(id));
	if (unknownIds.length > 0) {
		throw new Error(`Elements not found on slide ${p.slideIndex}: ${unknownIds.join(', ')}`);
	}
	ctx.bridge.selectElements(p.slideIndex, p.elementIds);
	return { slideIndex: p.slideIndex, selectedCount: p.elementIds.length };
};

/** Navigation executors keyed by tool name. */
export const navExecutors = {
	go_to_slide: goToSlide,
	select_elements: selectElements,
} satisfies Record<string, AiToolExecutor>;
