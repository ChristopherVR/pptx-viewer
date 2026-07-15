import type { PptxSlide } from 'pptx-viewer-core';
import { isPresentationAudience, strokeToInkElement } from 'pptx-viewer-shared';
import { ref } from 'vue';
import type { Ref } from 'vue';

import type { SlideAnnotationMap } from './usePresentationAnnotations';

export interface UsePresentationModeWiringInput {
	slides: Ref<PptxSlide[]>;
	activeSlideIndex: Ref<number>;
	pushHistory: () => void;
}

export interface UsePresentationModeWiringResult {
	presenting: Ref<boolean>;
	startPresenting: () => void;
	onPresentClose: (payload?: { annotations: SlideAnnotationMap }) => void;
	onPresentSlideChange: (index: number) => void;
}

/**
 * usePresentationModeWiring: the slideshow presentation-mode lifecycle,
 * including persisting kept ink annotations (drawn during presentation) back
 * onto their slides as real `ink` elements on close. Extracted verbatim from
 * `PowerPointViewer.vue`.
 */
export function usePresentationModeWiring(
	input: UsePresentationModeWiringInput,
): UsePresentationModeWiringResult {
	const { slides, activeSlideIndex, pushHistory } = input;

	const presenting = ref(
		typeof window !== 'undefined' && isPresentationAudience(window.location.hash),
	);
	function startPresenting(): void {
		presenting.value = true;
	}
	function onPresentClose(payload?: { annotations: SlideAnnotationMap }): void {
		presenting.value = false;
		const map = payload?.annotations;
		if (!map || map.size === 0) {
			return;
		}
		// Persist kept ink annotations as `ink` elements on their slides. Strokes
		// are converted with the shared `strokeToInkElement` helper (highlighter when
		// the stroke is translucent), appended per slide, and committed as a single
		// history-tracked change so the whole batch undoes together.
		let mutated = false;
		const nextSlides = slides.value.map((slide, index) => {
			const strokes = map.get(index);
			if (!strokes || strokes.length === 0) {
				return slide;
			}
			const inkElements = strokes
				.map((stroke) =>
					strokeToInkElement({
						points: stroke.points,
						color: stroke.color,
						width: stroke.width,
						tool: stroke.opacity < 1 ? 'highlighter' : 'pen',
					}),
				)
				.filter((el): el is NonNullable<typeof el> => el !== null);
			if (inkElements.length === 0) {
				return slide;
			}
			mutated = true;
			return { ...slide, elements: [...slide.elements, ...inkElements] };
		});
		if (mutated) {
			pushHistory();
			slides.value = nextSlides;
		}
	}
	function onPresentSlideChange(index: number): void {
		activeSlideIndex.value = index;
	}

	return { presenting, startPresenting, onPresentClose, onPresentSlideChange };
}
