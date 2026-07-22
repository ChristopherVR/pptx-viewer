/**
 * Structured element-level diff for AI change animations. Given the deck's
 * slides before and after an AI edit, {@link diffChangedElements} returns a flat
 * list of what changed per element (added / removed / moved / resized /
 * restyled / text), with the old and new bounds where relevant. A binding turns
 * that list into on-canvas motion (glide old->new, fade/scale in-out) plus a
 * glow-pulse highlight, so the user watches the edit happen.
 *
 * Pure and framework-agnostic: no DOM, no timing. The animator
 * ({@link createAiChangeAnimator}) owns timing; the binding owns rendering.
 */

import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

/** What kind of change an element underwent. */
export type AiChangeKind = 'added' | 'removed' | 'moved' | 'resized' | 'restyled' | 'text';

/** Axis-aligned bounds in slide (CSS pixel) coordinates. */
export interface AiChangeBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** One element's change, with old/new bounds for motion. */
export interface AiElementChange {
	slideIndex: number;
	elementId: string;
	kind: AiChangeKind;
	/** Bounds before the edit (present for removed / moved / resized). */
	from?: AiChangeBounds;
	/** Bounds after the edit (present for added / moved / resized / restyled / text). */
	to?: AiChangeBounds;
}

function bounds(el: PptxElement): AiChangeBounds {
	return { x: el.x, y: el.y, width: el.width, height: el.height };
}

/** True when x/y differ by more than a sub-pixel rounding wobble. */
function moved(a: PptxElement, b: PptxElement): boolean {
	return Math.abs(a.x - b.x) > 0.5 || Math.abs(a.y - b.y) > 0.5;
}

/** True when width/height differ by more than a sub-pixel rounding wobble. */
function resized(a: PptxElement, b: PptxElement): boolean {
	return Math.abs(a.width - b.width) > 0.5 || Math.abs(a.height - b.height) > 0.5;
}

/** The element's own text, when it carries one. */
function textOf(el: PptxElement): string | undefined {
	return 'text' in el && typeof el.text === 'string' ? el.text : undefined;
}

/** Serialise everything EXCEPT geometry + id, to detect a style/content change. */
function styleSignature(el: PptxElement): string {
	const rest = { ...el } as Record<string, unknown>;
	delete rest['x'];
	delete rest['y'];
	delete rest['width'];
	delete rest['height'];
	delete rest['id'];
	delete rest['rotation'];
	return JSON.stringify(rest);
}

/** Classify one matched (same-id) element pair, or null when unchanged. */
function classify(before: PptxElement, after: PptxElement): AiChangeKind | null {
	if (moved(before, after)) {
		return 'moved';
	}
	if (resized(before, after)) {
		return 'resized';
	}
	if (textOf(before) !== textOf(after)) {
		return 'text';
	}
	if (styleSignature(before) !== styleSignature(after)) {
		return 'restyled';
	}
	return null;
}

/**
 * Diff two slide arrays into per-element changes. Slides are matched by id (then
 * falls back to index), elements by id. Returns an empty array when nothing an
 * animation would show changed.
 */
export function diffChangedElements(before: PptxSlide[], after: PptxSlide[]): AiElementChange[] {
	const changes: AiElementChange[] = [];
	const beforeById = new Map(before.map((s) => [s.id, s]));

	after.forEach((afterSlide, slideIndex) => {
		const beforeSlide = beforeById.get(afterSlide.id) ?? before[slideIndex];
		const beforeEls = new Map((beforeSlide?.elements ?? []).map((e) => [e.id, e]));
		const afterIds = new Set(afterSlide.elements.map((e) => e.id));

		for (const el of afterSlide.elements) {
			const prev = beforeEls.get(el.id);
			if (!prev) {
				changes.push({ slideIndex, elementId: el.id, kind: 'added', to: bounds(el) });
				continue;
			}
			const kind = classify(prev, el);
			if (kind) {
				changes.push({ slideIndex, elementId: el.id, kind, from: bounds(prev), to: bounds(el) });
			}
		}

		for (const prev of beforeSlide?.elements ?? []) {
			if (!afterIds.has(prev.id)) {
				changes.push({
					slideIndex,
					elementId: prev.id,
					kind: 'removed',
					from: bounds(prev),
				});
			}
		}
	});

	return changes;
}
