/**
 * Slide-level tool executors: add / duplicate / delete / reorder slides, plus
 * notes, background, transition, and per-element animation. `delete_slides`
 * always forces approval regardless of the configured write policy.
 */

import type { PptxElementAnimation, PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';

import type { AiToolContext, AiToolExecutor } from './executor-base';
import { newElementId, newSlideId, requireSlide, routeWrite } from './executor-base';
import { renumberSlides } from './mutations';

const addSlide: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as { insertAfterIndex?: number; backgroundColor?: string };
	const id = newSlideId();
	const result = routeWrite(ctx, 'Add slide', (slides) => {
		const at =
			p.insertAfterIndex !== undefined && p.insertAfterIndex >= 0
				? Math.min(p.insertAfterIndex + 1, slides.length)
				: slides.length;
		const slide = {
			id,
			rId: '',
			slideNumber: at + 1,
			elements: [],
			backgroundColor: p.backgroundColor,
		} as unknown as PptxSlide;
		slides.splice(at, 0, slide);
		renumberSlides(slides);
		return slides;
	});
	return { ...result, slideId: id };
};

const duplicateSlide: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as { slideIndex: number; targetIndex?: number };
	return routeWrite(ctx, `Duplicate slide ${p.slideIndex + 1}`, (slides) => {
		const original = requireSlide(slides, p.slideIndex);
		const clone = structuredClone(original);
		clone.id = newSlideId();
		clone.rId = '';
		for (const el of clone.elements) {
			el.id = newElementId();
		}
		slides.splice(p.targetIndex ?? p.slideIndex + 1, 0, clone);
		renumberSlides(slides);
		return slides;
	});
};

const deleteSlides: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as { slideIndexes: number[] };
	// delete_slides is destructive: always require explicit approval.
	return routeWrite(
		ctx,
		`Delete ${p.slideIndexes.length} slide(s)`,
		(slides) => {
			const set = new Set(p.slideIndexes);
			if (set.size >= slides.length) {
				throw new Error('Cannot delete all slides; at least one must remain.');
			}
			const invalid = p.slideIndexes.filter((i) => i < 0 || i >= slides.length);
			if (invalid.length > 0) {
				throw new Error(`Invalid slide indexes: ${invalid.join(', ')}.`);
			}
			const next = slides.filter((_, i) => !set.has(i));
			renumberSlides(next);
			return next;
		},
		true,
	);
};

const reorderSlides: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as { newOrder: number[] };
	return routeWrite(ctx, 'Reorder slides', (slides) => {
		if (p.newOrder.length !== slides.length) {
			throw new Error(`newOrder must have exactly ${slides.length} indexes.`);
		}
		const sorted = [...p.newOrder].sort((a, b) => a - b);
		if (sorted.some((v, i) => v !== i)) {
			throw new Error('newOrder must be a permutation of all slide indexes.');
		}
		const next = p.newOrder.map((idx) => slides[idx]);
		renumberSlides(next);
		return next;
	});
};

const setSpeakerNotes: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as { slideIndex: number; notes: string };
	return routeWrite(ctx, `Set notes on slide ${p.slideIndex + 1}`, (slides) => {
		requireSlide(slides, p.slideIndex).notes = p.notes;
		return slides;
	});
};

const updateSlideProperties: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as {
		slideIndex: number;
		backgroundColor?: string;
		hidden?: boolean;
		notes?: string;
	};
	return routeWrite(ctx, `Update slide ${p.slideIndex + 1} properties`, (slides) => {
		const slide = requireSlide(slides, p.slideIndex);
		if (p.backgroundColor !== undefined) {
			slide.backgroundColor = p.backgroundColor;
		}
		if (p.hidden !== undefined) {
			slide.hidden = p.hidden;
		}
		if (p.notes !== undefined) {
			slide.notes = p.notes;
		}
		return slides;
	});
};

const setSlideTransition: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as { slideIndex: number; type: string; durationMs?: number };
	return routeWrite(ctx, `Set transition on slide ${p.slideIndex + 1}`, (slides) => {
		const slide = requireSlide(slides, p.slideIndex);
		if (p.type === 'none') {
			slide.transition = undefined;
		} else {
			slide.transition = {
				type: p.type,
				...(p.durationMs !== undefined ? { durationMs: p.durationMs } : {}),
			} as PptxSlideTransition;
		}
		return slides;
	});
};

const setElementAnimation: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as {
		slideIndex: number;
		elementId: string;
		entrance?: string;
		exit?: string;
		durationMs?: number;
		delayMs?: number;
	};
	return routeWrite(ctx, `Animate element on slide ${p.slideIndex + 1}`, (slides) => {
		const slide = requireSlide(slides, p.slideIndex);
		if (!slide.elements.some((e) => e.id === p.elementId)) {
			throw new Error(`Element '${p.elementId}' not found.`);
		}
		slide.animations ??= [];
		const anim = (slide.animations.find((a) => a.elementId === p.elementId) ??
			addAnimation(slide, p.elementId)) as PptxElementAnimation;
		if (p.entrance !== undefined) {
			anim.entrance = p.entrance as PptxElementAnimation['entrance'];
		}
		if (p.exit !== undefined) {
			anim.exit = p.exit as PptxElementAnimation['exit'];
		}
		if (p.durationMs !== undefined) {
			anim.durationMs = p.durationMs;
		}
		if (p.delayMs !== undefined) {
			anim.delayMs = p.delayMs;
		}
		return slides;
	});
};

function addAnimation(slide: PptxSlide, elementId: string): PptxElementAnimation {
	const anim = { elementId } as PptxElementAnimation;
	slide.animations ??= [];
	slide.animations.push(anim);
	return anim;
}

/** Slide-level executors keyed by tool name. */
export const slideExecutors = {
	add_slide: addSlide,
	duplicate_slide: duplicateSlide,
	delete_slides: deleteSlides,
	reorder_slides: reorderSlides,
	set_speaker_notes: setSpeakerNotes,
	update_slide_properties: updateSlideProperties,
	set_slide_transition: setSlideTransition,
	set_element_animation: setElementAnimation,
} satisfies Record<string, AiToolExecutor>;
