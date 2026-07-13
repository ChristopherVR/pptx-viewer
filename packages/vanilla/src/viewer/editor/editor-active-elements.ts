import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import type { ViewerState } from '../state';

/** Return the element collection currently targeted by editing operations. */
export function getActiveElements(state: ViewerState): PptxElement[] {
	const slide = state.slides[state.currentSlide];
	if (!slide) {
		return [];
	}
	return state.editTemplateMode
		? (state.templateElementsBySlideId[slide.id] ?? [])
		: slide.elements;
}

/** Replace the active element collection in its slide or template store. */
export function replaceActiveElements(
	state: ViewerState,
	elements: PptxElement[],
): Pick<ViewerState, 'slides'> | Pick<ViewerState, 'templateElementsBySlideId'> {
	const slide = state.slides[state.currentSlide];
	if (!slide) {
		return { slides: state.slides };
	}
	if (state.editTemplateMode) {
		return {
			templateElementsBySlideId: {
				...state.templateElementsBySlideId,
				[slide.id]: elements,
			},
		};
	}
	return {
		slides: state.slides.map(
			(item, index): PptxSlide => (index === state.currentSlide ? { ...item, elements } : item),
		),
	};
}

/** Resolve an id only from the currently editable element layer. */
export function findActiveElement(state: ViewerState, id: string): PptxElement | undefined {
	return getActiveElements(state).find((element) => element.id === id);
}
