/**
 * connector-reroute-store.ts: keep connectors attached to the shapes they point
 * at when one of those shapes finishes a move / resize / rotate gesture.
 *
 * A connector references its endpoints through
 * `shapeStyle.connectorStartConnection` / `connectorEndConnection`, so dragging
 * the shape it is glued to must recompute the connector's own box. The whole
 * calculation already lives in `pptx-viewer-shared`
 * (`rerouteConnectorsForMovedElements` + `applyReroutedConnectors`); Vue simply
 * never called it, so a connector stayed behind while its shape walked away.
 *
 * This module owns only the STORE write: which array the recomputed connectors
 * are mapped into (slide content, or the active slide's template layer). Both
 * shared functions are no-ops on empty input and return the SAME array
 * reference when there is nothing to apply, so calling this at the end of every
 * gesture is free.
 *
 * NOTE: it deliberately takes no history snapshot. Every caller has already
 * snapshotted at gesture start, and a second entry would leave a spurious undo
 * step that only moved the connectors.
 *
 * @module composables/connector-reroute-store
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { applyReroutedConnectors, rerouteConnectorsForMovedElements } from 'pptx-viewer-shared';
import type { Ref } from 'vue';

import { setTemplateElements } from './template-editing';
import type { TemplateElementMap } from './template-editing';

/**
 * Recompute every connector in `elements` that is glued to one of `movedIds`.
 *
 * Returns the SAME array reference when nothing needed rerouting, so a caller
 * can use identity to decide whether to write to its store at all.
 */
export function rerouteConnectorsInElements(
	elements: PptxElement[],
	movedIds: Set<string>,
): PptxElement[] {
	if (movedIds.size === 0) {
		return elements;
	}
	return applyReroutedConnectors(elements, rerouteConnectorsForMovedElements(elements, movedIds));
}

/**
 * Slide list with the active slide's connectors rerouted, or the same reference
 * when nothing moved. Pure, so it is unit-testable without a component.
 */
export function rerouteConnectorsInSlides(
	slides: PptxSlide[],
	index: number,
	movedIds: Set<string>,
): PptxSlide[] {
	const slide = slides[index];
	if (!slide) {
		return slides;
	}
	const nextElements = rerouteConnectorsInElements(slide.elements, movedIds);
	if (nextElements === slide.elements) {
		return slides;
	}
	const nextSlides = slides.slice();
	nextSlides[index] = { ...slide, elements: nextElements };
	return nextSlides;
}

/** The stores a reroute may have to write into. */
export interface ConnectorRerouteStores {
	slides: Ref<PptxSlide[]>;
	activeSlideIndex: Ref<number>;
	templateElementsBySlideId: Ref<TemplateElementMap>;
}

/**
 * Build the "shapes just moved, fix their connectors" callback for a gesture
 * end. Covers both stores: slide content (where connectors normally live) and
 * the active slide's template layer, so a connector authored on a master keeps
 * up when edit-template mode drags the shape it is attached to.
 */
export function useConnectorReroute(
	stores: ConnectorRerouteStores,
): (movedIds: Set<string>) => void {
	const { slides, activeSlideIndex, templateElementsBySlideId } = stores;

	return function rerouteConnectorsFor(movedIds: Set<string>): void {
		if (movedIds.size === 0) {
			return;
		}
		const index = activeSlideIndex.value;
		const nextSlides = rerouteConnectorsInSlides(slides.value, index, movedIds);
		if (nextSlides !== slides.value) {
			slides.value = nextSlides;
		}
		const slide = slides.value[index];
		const templateElements = slide ? templateElementsBySlideId.value[slide.id] : undefined;
		if (!slide || !templateElements) {
			return;
		}
		const nextTemplate = rerouteConnectorsInElements(templateElements, movedIds);
		if (nextTemplate !== templateElements) {
			templateElementsBySlideId.value = setTemplateElements(
				templateElementsBySlideId.value,
				slide.id,
				nextTemplate,
			);
		}
	};
}
