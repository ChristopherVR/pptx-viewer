/* oxlint-disable eslint/one-var -- each exported helper below declares its own
   independent locals; merging unrelated declarations across the many
   functions here would hurt readability, not help it. */
import type { PptxElement, PptxElementAnimation } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import {
	animationEffectLabel,
	buildAnimationTimelineBars,
	getElementLabel,
	updateSlide,
} from 'pptx-viewer-shared';
import type { AnimationLabelTranslate } from 'pptx-viewer-shared';

import type { EditorState } from '../../editor/editor-state.svelte';

/**
 * Svelte-side glue for the docked inspector AnimationPanel: the slide-level
 * commit path plus the small pure bits (timeline labels) that stay
 * binding-local. Timeline-bar layout, field/effect mutations, and the
 * drag-reorder algorithm itself all come from the shared `animation-authoring`
 * module; everything here is orchestration.
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
 * (shared's `buildAnimationTimelineBars`).
 */
export function buildTimelineBarData(sorted: readonly PptxElementAnimation[]): TimelineBarDatum[] {
	const bars = buildAnimationTimelineBars(sorted);
	const barsByElementId = new Map(bars.map((bar) => [bar.elementId, bar]));
	return sorted.flatMap((anim) => {
		const bar = barsByElementId.get(anim.elementId);
		return bar ? [{ anim, leftPercent: bar.leftPercent, widthPercent: bar.widthPercent }] : [];
	});
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
