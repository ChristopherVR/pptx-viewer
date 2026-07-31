import type { PptxSlide } from 'pptx-viewer-core';
import {
	firstShowSlideIndex,
	hasShowSlideAfter,
	lastShowSlideIndex,
	nextShowSlideIndex,
	previousShowSlideIndex,
	resolveShowSlideIndexes,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import type { ComputedRef } from 'vue';

/**
 * usePresentationShowOrder: which slides the running show visits, and what a
 * navigation press resolves to.
 *
 * A thin reactive wrapper over the shared show-order rule (hidden slides are
 * skipped, an active custom show restricts and reorders). It lives here rather
 * than inside `PresentationMode.vue` so the SFC stays presentation-only, and so
 * the same rule cannot drift from the other four bindings.
 *
 * Every accessor falls back to the current index, so a caller can pass the
 * result straight to `goTo` without null handling: staying put is the correct
 * outcome at both ends of the show.
 */
export interface PresentationShowOrder {
	/** Deck indexes the show visits, in show order. */
	readonly indexes: ComputedRef<number[]>;
	/** Whether a forward press has anywhere to go (false raises the end screen). */
	hasNext(current: number): boolean;
	/** The slide a forward press lands on, or `current` at the end. */
	next(current: number): number;
	/** The slide a backward press lands on, or `current` at the start. */
	previous(current: number): number;
	/** Home: the show's first slide. */
	first(fallback: number): number;
	/** End: the show's last slide. */
	last(fallback: number): number;
}

export interface UsePresentationShowOrderInput {
	slides: () => readonly PptxSlide[];
	/** Membership of the running custom show, when one is selected. */
	activeCustomShow?: () => { slideRIds: string[] } | null | undefined;
}

export function usePresentationShowOrder(
	input: UsePresentationShowOrderInput,
): PresentationShowOrder {
	const indexes = computed(() =>
		resolveShowSlideIndexes(input.slides(), input.activeCustomShow?.()),
	);
	return {
		indexes,
		hasNext: (current) => hasShowSlideAfter(current, indexes.value),
		next: (current) => nextShowSlideIndex(current, indexes.value) ?? current,
		previous: (current) => previousShowSlideIndex(current, indexes.value) ?? current,
		first: (fallback) => firstShowSlideIndex(indexes.value) ?? fallback,
		last: (fallback) => lastShowSlideIndex(indexes.value) ?? fallback,
	};
}
