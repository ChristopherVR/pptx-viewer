import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import type { ViewerState } from '../state';

/** Return the element collection currently targeted by editing operations. */
export function getActiveElements(state: ViewerState): PptxElement[] {
	if (state.masterViewTarget) {
		if (state.masterViewTab === 'notes') {
			return state.notesMaster?.elements ?? [];
		}
		if (state.masterViewTab === 'handout') {
			return state.handoutMaster?.elements ?? [];
		}
		const master = state.slideMasters[state.masterViewTarget.masterIndex];
		return state.masterViewTarget.layoutIndex === null
			? (master?.elements ?? [])
			: (master?.layouts?.[state.masterViewTarget.layoutIndex]?.elements ?? []);
	}
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
):
	| Pick<ViewerState, 'slides'>
	| Pick<ViewerState, 'templateElementsBySlideId'>
	| Pick<ViewerState, 'slideMasters'>
	| Pick<ViewerState, 'notesMaster'>
	| Pick<ViewerState, 'handoutMaster'> {
	if (state.masterViewTarget) {
		if (state.masterViewTab === 'notes') {
			return { notesMaster: state.notesMaster ? { ...state.notesMaster, elements } : undefined };
		}
		if (state.masterViewTab === 'handout') {
			return {
				handoutMaster: state.handoutMaster ? { ...state.handoutMaster, elements } : undefined,
			};
		}
		const { masterIndex, layoutIndex } = state.masterViewTarget;
		return {
			slideMasters: state.slideMasters.map((master, index) => {
				if (index !== masterIndex) {
					return master;
				}
				if (layoutIndex === null) {
					return { ...master, elements };
				}
				return {
					...master,
					layouts: master.layouts?.map((layout, layoutIndexValue) =>
						layoutIndexValue === layoutIndex ? { ...layout, elements } : layout,
					),
				};
			}),
		};
	}
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
		slides: state.slides.map((item, index): PptxSlide =>
			index === state.currentSlide ? { ...item, elements } : item,
		),
	};
}

/** Resolve an id only from the currently editable element layer. */
export function findActiveElement(state: ViewerState, id: string): PptxElement | undefined {
	return getActiveElements(state).find((element) => element.id === id);
}
