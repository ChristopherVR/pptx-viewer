import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { masterViewElements, replaceMasterViewElements } from 'pptx-viewer-shared';
import type { MasterViewDocument, MasterViewTarget } from 'pptx-viewer-shared';

import type { ViewerState } from '../state';

/** The document + target shape the shared master-view rules operate on. */
function masterViewOf(state: ViewerState): {
	document: MasterViewDocument;
	target: MasterViewTarget;
} | null {
	if (!state.masterViewTarget) {
		return null;
	}
	return {
		document: {
			slideMasters: state.slideMasters,
			notesMaster: state.notesMaster,
			handoutMaster: state.handoutMaster,
		},
		target: {
			tab: state.masterViewTab,
			masterIndex: state.masterViewTarget.masterIndex,
			layoutIndex: state.masterViewTarget.layoutIndex,
		},
	};
}

/** Return the element collection currently targeted by editing operations. */
export function getActiveElements(state: ViewerState): PptxElement[] {
	const masterView = masterViewOf(state);
	if (masterView) {
		return masterViewElements(masterView.document, masterView.target);
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
	const masterView = masterViewOf(state);
	if (masterView) {
		// A layout view paints its master's artwork behind its own, so the
		// shared rule routes each element back to the part that owns it.
		const write = replaceMasterViewElements(masterView.document, masterView.target, elements);
		if (write?.slideMasters) {
			return { slideMasters: write.slideMasters };
		}
		if (write?.notesMaster) {
			return { notesMaster: write.notesMaster };
		}
		if (write?.handoutMaster) {
			return { handoutMaster: write.handoutMaster };
		}
		return { slideMasters: state.slideMasters };
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
