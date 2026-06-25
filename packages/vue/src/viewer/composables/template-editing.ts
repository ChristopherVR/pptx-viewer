/**
 * template-editing.ts: separate-state logic for the editTemplateMode feature.
 *
 * Template elements (decorative shapes a slide inherits from its layout or
 * master) are merged into `slide.elements` by the core loader, each carrying a
 * `layout-` / `master-` id prefix. They render on every slide that inherits the
 * same template part, so editing one mutates the shared part. To keep them out
 * of the normal editing flow, the viewer PARTITIONS them into their own store at
 * load time, renders them in a dedicated layer behind the slide content, routes
 * edits to that store, and merges them back in front of (behind) the slide
 * elements when serialising.
 *
 * This module owns the partition / merge-back / routing helpers so the SFCs and
 * composables stay thin (repo rule: presentation-only components, no non-trivial
 * logic inline).
 *
 * @module composables/template-editing
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { isTemplateElement, isTemplateElementId } from 'pptx-viewer-shared';

/**
 * Per-slide store of the master/layout (template) elements pulled out of each
 * slide at load time, keyed by `slide.id`. Owned by the load composable and
 * threaded into the render / edit / save / history paths.
 */
export type TemplateElementMap = Record<string, PptxElement[]>;

/** The result of splitting a deck into editable slides + their template store. */
export interface PartitionedSlides {
	/** Slides whose `.elements` no longer contain any template element. */
	slides: PptxSlide[];
	/** Template elements pulled out of each slide, keyed by `slide.id`. */
	templateElementsBySlideId: TemplateElementMap;
}

/**
 * Split every slide's `elements` into normal content (kept on the slide) and
 * template elements (accumulated into a per-slide store). The core loader merges
 * template elements to the front of `slide.elements` (behind the content); this
 * reverses that merge while preserving order. Pure: returns new arrays and never
 * mutates the input.
 */
export function partitionTemplateElements(slides: PptxSlide[]): PartitionedSlides {
	const templateElementsBySlideId: TemplateElementMap = {};
	const nextSlides = slides.map((slide) => {
		const template = slide.elements.filter(isTemplateElement);
		if (template.length === 0) {
			return slide;
		}
		const kept = slide.elements.filter((el) => !isTemplateElement(el));
		templateElementsBySlideId[slide.id] = template;
		return { ...slide, elements: kept };
	});
	return { slides: nextSlides, templateElementsBySlideId };
}

/**
 * Re-assemble the slides for serialisation by prepending each slide's template
 * elements (so they sit behind the slide content, matching the core loader's
 * ordering). Every save path must route through this so template edits persist.
 * Pure: returns new slide objects and never mutates the input.
 */
export function buildSaveSlides(
	slides: PptxSlide[],
	templateElementsBySlideId: TemplateElementMap,
): PptxSlide[] {
	return slides.map((slide) => {
		const template = templateElementsBySlideId[slide.id];
		if (!template || template.length === 0) {
			return slide;
		}
		return { ...slide, elements: [...template, ...slide.elements] };
	});
}

/**
 * Immutably replace one slide's template-element list in the map.
 */
export function setTemplateElements(
	map: TemplateElementMap,
	slideId: string,
	elements: PptxElement[],
): TemplateElementMap {
	return { ...map, [slideId]: elements };
}

/**
 * Look up an element by id in the template store for a given slide. Returns
 * `undefined` when the slide has no template store or the id is absent.
 */
export function findTemplateElement(
	map: TemplateElementMap,
	slideId: string | undefined,
	elementId: string,
): PptxElement | undefined {
	if (!slideId) {
		return undefined;
	}
	return map[slideId]?.find((el) => el.id === elementId);
}

/**
 * Whether the element id may be selected on the canvas. Template ids
 * (`master-` / `layout-` prefix) are selectable only while edit-template mode is
 * on; normal ids are always selectable. Keyed on the id alone, for the
 * pointer-down delegation path (which only knows the `data-element-id`).
 */
export function isElementIdInteractive(elementId: string, editTemplateMode: boolean): boolean {
	return isTemplateElementId(elementId) ? editTemplateMode : true;
}
