/**
 * element-store-patch.ts: the "write one element back, without a history entry"
 * primitive the live canvas gestures share.
 *
 * The active slide's elements live in two stores: ordinary content on the slide
 * itself, and inherited master/layout shapes in `templateElementsBySlideId`
 * (they carry a `master-` / `layout-` id prefix). Every live patch has to route
 * to the right one, and getting that wrong silently drops the edit, so the
 * routing lives in exactly one place.
 *
 * Split out of `useElementDrag`, which had grown past the repo's 300-LOC budget.
 *
 * @module composables/element-store-patch
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { isTemplateElementId } from 'pptx-viewer-shared';
import type { Ref } from 'vue';

import { setTemplateElements } from './template-editing';
import type { TemplateElementMap } from './template-editing';

/** The two stores an element patch may land in. */
export interface ElementStores {
	slides: Ref<PptxSlide[]>;
	activeSlideIndex: Ref<number>;
	templateElementsBySlideId: Ref<TemplateElementMap>;
}

/**
 * Build the patcher: map one element in its own store WITHOUT a history entry.
 * History is snapshotted once at gesture start, so the live drag/resize/adjust
 * frames must not add entries of their own.
 */
export function useElementStorePatch(
	stores: ElementStores,
): (id: string, mapElement: (el: PptxElement) => PptxElement) => void {
	const { slides, activeSlideIndex, templateElementsBySlideId } = stores;

	return function patchElementInStore(
		id: string,
		mapElement: (el: PptxElement) => PptxElement,
	): void {
		const index = activeSlideIndex.value;
		const slide = slides.value[index];
		if (!slide) {
			return;
		}
		if (isTemplateElementId(id)) {
			const current = templateElementsBySlideId.value[slide.id];
			if (!current) {
				return;
			}
			const next = current.map((el) => (el.id === id ? mapElement(el) : el));
			templateElementsBySlideId.value = setTemplateElements(
				templateElementsBySlideId.value,
				slide.id,
				next,
			);
			return;
		}
		const nextElements = slide.elements.map((el) => (el.id === id ? mapElement(el) : el));
		const nextSlides = slides.value.slice();
		nextSlides[index] = { ...slide, elements: nextElements };
		slides.value = nextSlides;
	};
}
