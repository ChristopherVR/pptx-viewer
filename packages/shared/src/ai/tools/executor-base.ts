/**
 * Shared plumbing for tool executors: the execution context, the write-policy
 * router that decides whether a mutation is staged or applied, and small typed
 * helpers for locating slides / elements inside an updater.
 */

import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import type { PptxAiBridge, PptxAiSlidesUpdater } from '../bridge';
import type { AiChangeAnimator } from '../change-animator';
import type { PptxAiWritePolicy } from '../config';
import type { ProposalStore } from '../proposals';

/** Context every tool executor receives. */
export interface AiToolContext {
	bridge: PptxAiBridge;
	proposals: ProposalStore;
	writePolicy: PptxAiWritePolicy;
	/** Optional canvas change animator (present when the host enables it). */
	animator?: AiChangeAnimator;
}

/** A tool executor: validated `input` in, JSON-serialisable output out. */
export type AiToolExecutor = (ctx: AiToolContext, input: unknown) => unknown | Promise<unknown>;

/** Result of routing a write through the policy. */
export interface WriteRouteResult {
	/** True when the change was applied straight to the deck. */
	applied?: boolean;
	/** True when the change was staged for review. */
	staged?: boolean;
	/** Proposal id (present when staged). */
	proposalId?: string;
	/** Whether an explicit user approval is required before applying. */
	requiresApproval?: boolean;
	/** Human-readable change summary. */
	summary: string[];
}

/**
 * Route a slides mutation through the active write policy.
 *
 * `'auto'` applies immediately (unless `forceApproval`); `'stage'` / `'approve'`
 * (and any `forceApproval` tool such as `delete_slides`) register a proposal.
 */
export function routeWrite(
	ctx: AiToolContext,
	label: string,
	updater: PptxAiSlidesUpdater,
	forceApproval = false,
): WriteRouteResult {
	if (ctx.writePolicy === 'auto' && !forceApproval) {
		const before = ctx.bridge.getSlides();
		const after = ctx.animator ? updater(structuredClone(before)) : null;
		ctx.bridge.applySlidesUpdate(updater, label);
		if (after) {
			ctx.animator?.publish(before, after);
		}
		return { applied: true, summary: [label] };
	}
	const proposal = ctx.proposals.stage(label, updater);
	return {
		staged: true,
		proposalId: proposal.id,
		requiresApproval: forceApproval || ctx.writePolicy === 'approve',
		summary: proposal.summary,
	};
}

/** Assert a slide index is in range, returning the slide. */
export function requireSlide(slides: PptxSlide[], slideIndex: number): PptxSlide {
	if (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex >= slides.length) {
		throw new Error(`Slide index ${slideIndex} out of range (0-${slides.length - 1}).`);
	}
	return slides[slideIndex];
}

/** Find an element by id on a slide, or throw. */
export function requireElement(slide: PptxSlide, elementId: string): PptxElement {
	const el = slide.elements.find((e) => e.id === elementId);
	if (!el) {
		throw new Error(`Element '${elementId}' not found on slide ${slide.slideNumber}.`);
	}
	return el;
}

/** Generate a fresh element id. */
export function newElementId(): string {
	return `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Generate a fresh slide id. */
export function newSlideId(): string {
	return `slide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
