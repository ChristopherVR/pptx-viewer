import type { PptxElement, PptxElementAnimation } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import { animationEffectLabel, getElementLabel } from 'pptx-viewer-shared';
import type { AnimationLabelTranslate } from 'pptx-viewer-shared';

import { updateSlide } from '../../editor/editor-mutations';
import type { EditorState } from '../../editor/editor-state.svelte';

/**
 * Svelte-side glue for the docked inspector AnimationPanel: the slide-level
 * commit path plus the small pure bits of React's `useAnimationHandlers` that
 * are not yet in `pptx-viewer-shared` (timeline-bar maths, timeline labels,
 * index-based drag reorder). All field/effect mutations themselves come from
 * the shared `animation-authoring` setters; everything here is orchestration.
 */

/**
 * Write a new `animations` array onto the current slide as a single undoable
 * step (the Svelte equivalent of React's `onUpdateSlide({ animations })`,
 * which routes through the editor history the same way).
 */
export function commitSlideAnimations(
	editor: EditorState,
	animations: PptxElementAnimation[],
): void {
	const index = editor.currentSlideIndex;
	if (!editor.slides[index]) {
		return;
	}
	editor.commitSlides(updateSlide(editor.slides, index, { animations }));
}

/** Animations sorted by their `order` field (React's `sortedAnimations`). */
export function sortAnimations(
	animations: readonly PptxElementAnimation[],
): PptxElementAnimation[] {
	return [...animations].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** One proportional bar in the horizontal timeline strip. */
export interface TimelineBarDatum {
	anim: PptxElementAnimation;
	leftPercent: number;
	widthPercent: number;
}

/**
 * Delay/duration of each animation as percentages of the longest end time
 * (React's `timelineBarData` memo, verbatim maths).
 */
export function buildTimelineBarData(sorted: readonly PptxElementAnimation[]): TimelineBarDatum[] {
	if (sorted.length === 0) {
		return [];
	}
	let maxEndMs = 0;
	const entries = sorted.map((anim) => {
		const startMs = anim.delayMs ?? 0;
		const durationMs = anim.durationMs ?? 500;
		maxEndMs = Math.max(maxEndMs, startMs + durationMs);
		return { anim, startMs, durationMs };
	});
	const totalMs = Math.max(maxEndMs, 1);
	return entries.map((entry) => ({
		anim: entry.anim,
		leftPercent: (entry.startMs / totalMs) * 100,
		widthPercent: (entry.durationMs / totalMs) * 100,
	}));
}

/**
 * Human label for a timeline row: the element's text when it has any,
 * otherwise its type label, falling back to a truncated id (React's
 * `getTimelineLabel`).
 */
export function timelineLabel(
	anim: PptxElementAnimation,
	elements: readonly PptxElement[],
): string {
	const el = elements.find((candidate) => candidate.id === anim.elementId);
	if (!el) {
		return anim.elementId.slice(0, 8);
	}
	const text = hasTextProperties(el) ? el.text : undefined;
	return text || getElementLabel(el);
}

/**
 * Effect name shown in a bar's tooltip (React's `animationTypeLabel`).
 *
 * It used to print the preset token verbatim, so the tooltip read `fadeIn`
 * rather than "Fade In" and never translated; the shared resolver names both
 * the editor and the OOXML catalogue vocabularies.
 */
export function animationTypeLabel(anim: PptxElementAnimation, t: AnimationLabelTranslate): string {
	return animationEffectLabel(anim, t);
}

/**
 * Move the animation at `sourceIndex` (in `order`-sorted position) to
 * `targetIndex` and re-normalise `order` (React's drag-drop
 * `reorderAnimations`).
 */
export function reorderAnimationsByIndex(
	animations: readonly PptxElementAnimation[],
	sourceIndex: number,
	targetIndex: number,
): PptxElementAnimation[] {
	const sorted = sortAnimations(animations);
	const [moved] = sorted.splice(sourceIndex, 1);
	if (!moved) {
		return [...animations];
	}
	sorted.splice(targetIndex, 0, moved);
	return sorted.map((anim, order) => ({ ...anim, order }));
}
