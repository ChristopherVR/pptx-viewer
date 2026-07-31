/**
 * useSlideNavigation: which slide is on screen, and the bounds-checked moves
 * between slides.
 *
 * `goTo` silently ignores out-of-range indexes rather than clamping: a caller
 * asking for slide 99 of a 10-slide deck has a bug, and clamping to the last
 * slide would hide it behind plausible-looking navigation.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import type { ComputedRef, Ref, ShallowRef } from 'vue';
import { computed, ref } from 'vue';

export interface UseSlideNavigationResult {
	activeSlideIndex: Ref<number>;
	slideCount: ComputedRef<number>;
	activeSlide: ComputedRef<PptxSlide | undefined>;
	goTo: (index: number) => void;
	goPrev: () => void;
	goNext: () => void;
}

export function useSlideNavigation(slides: ShallowRef<PptxSlide[]>): UseSlideNavigationResult {
	const activeSlideIndex = ref(0);
	const slideCount = computed(() => slides.value.length);
	const activeSlide = computed(() => slides.value[activeSlideIndex.value]);

	function goTo(index: number): void {
		if (index < 0 || index >= slideCount.value) {
			return;
		}
		activeSlideIndex.value = index;
	}

	return {
		activeSlideIndex,
		slideCount,
		activeSlide,
		goTo,
		goPrev: () => goTo(activeSlideIndex.value - 1),
		goNext: () => goTo(activeSlideIndex.value + 1),
	};
}
