import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import { isTemplateElement, isTemplateElementId } from './element';

export type TemplateElementMap = Record<string, PptxElement[]>;

/** Slides and inherited template elements separated for interaction gating. */
export interface TemplateElementPartition {
	slides: PptxSlide[];
	templateElementsBySlideId: TemplateElementMap;
}

/** Immutably replace one slide's inherited element list. */
export function setTemplateElements(
	map: TemplateElementMap,
	slideId: string,
	elements: PptxElement[],
): TemplateElementMap {
	return { ...map, [slideId]: elements };
}

/** Find an inherited element on one slide. */
export function findTemplateElement(
	map: Readonly<TemplateElementMap>,
	slideId: string | undefined,
	elementId: string,
): PptxElement | undefined {
	return slideId ? map[slideId]?.find((element) => element.id === elementId) : undefined;
}

/** Gate layout/master hits unless template editing is enabled. */
export function isElementIdInteractive(elementId: string, editTemplateMode: boolean): boolean {
	return !isTemplateElementId(elementId) || editTemplateMode;
}

/**
 * Template (layout/master) elements to actually paint for `slide`, honouring
 * PowerPoint's "Hide Background Graphics" (`p:sld/@showMasterSp="0"`,
 * `slide.showMasterShapes === false`, ECMA-376 §19.3.1.38).
 *
 * `templateElementsBySlideId` is partitioned once, at load time (see
 * {@link partitionTemplateElements}); toggling the flag afterwards does not
 * re-partition it. Every render site that paints the template layer must
 * funnel the slide's entry through this before use, so flipping the toggle
 * takes effect immediately instead of requiring a full reload.
 */
export function visibleTemplateElements(
	slide: Pick<PptxSlide, 'showMasterShapes'> | undefined,
	templateElements: readonly PptxElement[],
): readonly PptxElement[] {
	return slide?.showMasterShapes === false ? [] : templateElements;
}

/** Split layout/master elements out of each loaded slide while preserving order. */
export function partitionTemplateElements(slides: PptxSlide[]): TemplateElementPartition {
	const templateElementsBySlideId: Record<string, PptxElement[]> = {};
	const nextSlides = slides.map((slide) => {
		const template = slide.elements.filter(isTemplateElement);
		if (template.length === 0) {
			return slide;
		}
		templateElementsBySlideId[slide.id] = template;
		return { ...slide, elements: slide.elements.filter((element) => !isTemplateElement(element)) };
	});
	return { slides: nextSlides, templateElementsBySlideId };
}

/** Merge editable layout/master elements behind slide-owned elements for save/export. */
export function buildSaveSlides(
	slides: PptxSlide[],
	templateElementsBySlideId: Readonly<Record<string, PptxElement[]>>,
): PptxSlide[] {
	return slides.map((slide) => {
		const template = templateElementsBySlideId[slide.id];
		return template?.length ? { ...slide, elements: [...template, ...slide.elements] } : slide;
	});
}
