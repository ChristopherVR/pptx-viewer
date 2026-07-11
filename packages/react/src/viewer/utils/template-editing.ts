/**
 * template-editing.ts: helpers for the separate-state editTemplateMode feature.
 *
 * Template elements (decorative shapes a slide inherits from its layout or
 * master) carry a `layout-` / `master-` id prefix. The core loader merges them
 * into `slide.elements`; at load time the React viewer partitions them OUT into
 * a dedicated `templateElementsBySlideId` store so they get their own editable
 * render layer that is interaction-locked unless the user turns on "edit
 * template" mode. Because editing one mutates the shared master/layout part,
 * the separate store is merged BACK in front of each slide's own elements at
 * save time via {@link buildSaveSlides} so template edits persist.
 *
 * This module owns the pure logic so the components and hooks stay thin (repo
 * rule: presentation-only components, framework-agnostic logic shared). It
 * mirrors the Vue / Angular bindings.
 *
 * @module utils/template-editing
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { isTemplateElement } from 'pptx-viewer-shared';

// The clone-id builder (template-prefix aware paste/duplicate ids) moved to
// `pptx-viewer-shared` (render/element-clipboard.ts); re-exported here for the
// existing React import sites.
export { makeCloneId } from 'pptx-viewer-shared';

/** Result of {@link partitionTemplateElements}. */
export interface TemplatePartition {
	/** Slides with template (master/layout) elements removed from `elements`. */
	slides: PptxSlide[];
	/** The removed template elements, keyed by slide id, preserving order. */
	templateElementsBySlideId: Record<string, PptxElement[]>;
}

/**
 * Split the loaded deck into its own slide content and the inherited template
 * (master/layout) elements.
 *
 * The core loader merges template elements (id prefixed `layout-` / `master-`)
 * into `slide.elements`. The separate-state architecture moves them OUT into a
 * dedicated per-slide store so they get their own gated, editable render layer;
 * {@link buildSaveSlides} merges them back at save time. Relative order is
 * preserved on both sides. Slides without template elements keep their original
 * identity.
 */
export function partitionTemplateElements(slides: PptxSlide[]): TemplatePartition {
	const templateElementsBySlideId: Record<string, PptxElement[]> = {};
	const nextSlides = slides.map((slide) => {
		const template = slide.elements.filter((el) => isTemplateElement(el));
		if (template.length === 0) {
			return slide;
		}
		templateElementsBySlideId[slide.id] = template;
		return { ...slide, elements: slide.elements.filter((el) => !isTemplateElement(el)) };
	});
	return { slides: nextSlides, templateElementsBySlideId };
}

/**
 * Merge the separated template (master/layout) elements back into each slide's
 * `elements` array so a `handler.save(...)` call persists template edits.
 *
 * Template elements are placed BEHIND the slide's own elements (first in
 * document order), matching the order the core loader produced on load. Slides
 * with no template elements are returned unchanged (referentially stable) so
 * callers can keep cheap identity checks.
 */
export function buildSaveSlides(
	slides: PptxSlide[],
	templateElementsBySlideId: Record<string, PptxElement[]>,
): PptxSlide[] {
	return slides.map((slide) => {
		const template = templateElementsBySlideId[slide.id];
		if (!template || template.length === 0) {
			return slide;
		}
		return { ...slide, elements: [...template, ...slide.elements] };
	});
}
