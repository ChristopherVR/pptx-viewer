import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import {
	isTemplateElementId,
	masterViewElements,
	replaceMasterViewElements,
	slideSpaceElement,
	updateElementInTree,
} from 'pptx-viewer-shared';
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

/**
 * The element collection that OWNS `elementId`. Slide elements stay selectable
 * while edit-template mode is on, so resolving the store from the mode flag
 * handed a slide element's z-order op the template store, where it does not
 * exist, and the command silently did nothing.
 */
export function getElementsOwning(state: ViewerState, elementId: string): PptxElement[] {
	if (masterViewOf(state) || !state.editTemplateMode || isTemplateElementId(elementId)) {
		return getActiveElements(state);
	}
	return state.slides[state.currentSlide]?.elements ?? [];
}

/** Replace the element collection that owns `elementId` (see {@link getElementsOwning}). */
export function replaceElementsOwning(
	state: ViewerState,
	elementId: string,
	elements: PptxElement[],
): ReturnType<typeof replaceActiveElements> {
	if (masterViewOf(state) || !state.editTemplateMode || isTemplateElementId(elementId)) {
		return replaceActiveElements(state, elements);
	}
	return {
		slides: state.slides.map((item, index): PptxSlide =>
			index === state.currentSlide ? { ...item, elements } : item,
		),
	};
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

/**
 * Resolve an id only from the currently editable element layer. A member of an
 * enterable group (selected by clicking into its group, shared `group-drill`)
 * resolves too, in SLIDE space (absolute x/y), so the selection chrome, lock
 * gates, gestures and the inline editor treat it like a top-level element.
 */
export function findActiveElement(state: ViewerState, id: string): PptxElement | undefined {
	const elements = getActiveElements(state);
	return (
		elements.find((element) => element.id === id) ?? slideSpaceElement(elements, id) ?? undefined
	);
}

/**
 * The active elements named by `ids`: the top-level ones in slide order, then
 * any group members among them (in slide space, see {@link findActiveElement}).
 */
export function findActiveElementsByIds(state: ViewerState, ids: readonly string[]): PptxElement[] {
	const elements = getActiveElements(state);
	const wanted = new Set(ids);
	const topLevel = elements.filter((element) => wanted.has(element.id));
	const found = new Set(topLevel.map((element) => element.id));
	const members = ids
		.filter((id) => !found.has(id))
		.map((id) => slideSpaceElement(elements, id))
		.filter((element): element is PptxElement => element !== null);
	return [...topLevel, ...members];
}

/**
 * The active element list with `id` replaced by `update(element)`. A group
 * member is handed to `update` in slide space and written back into its
 * group's coordinate space (shared `updateElementInTree`), so a member moved,
 * resized or text-edited on the canvas lands where the user left it. Returns
 * the same list when `id` is nowhere in the active layer.
 */
export function mapActiveElement(
	state: ViewerState,
	id: string,
	update: (element: PptxElement) => PptxElement,
): PptxElement[] {
	const elements = getActiveElements(state);
	if (elements.some((element) => element.id === id)) {
		return elements.map((element) => (element.id === id ? update(element) : element));
	}
	const member = slideSpaceElement(elements, id);
	return member ? updateElementInTree(elements, id, update(member)) : elements;
}
