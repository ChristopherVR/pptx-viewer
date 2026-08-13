/**
 * template-mode.ts: separate-state model + per-element interactivity gate for the
 * editTemplateMode feature.
 *
 * Inherited master/layout (template) elements are merged BEHIND the slide's own
 * elements by the core loader and carry ids prefixed `layout-` / `master-`. At
 * load time we PARTITION them out of `slide.elements` into a dedicated
 * `templateElementsBySlideId` store ({@link partitionSlides}); the editor then
 * holds a template-free deck and renders the template store as a separate layer
 * behind the slide. They should only be selectable/draggable/deletable when the
 * user has explicitly turned on "edit template" mode; otherwise they are inert so
 * normal slide editing never disturbs the shared template. Every save merges the
 * two stores back together ({@link buildSaveSlides}).
 *
 * Pure (no Angular), so it stays unit-testable in isolation and the components
 * remain thin.
 *
 * @module viewer/template-mode
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import { canInteractWithElement, isTemplateElement } from '../internal/shared';

/** Map of slide id -> the inherited template (master/layout) elements for it. */
export type TemplateElementsBySlideId = Record<string, PptxElement[]>;

/** Result of {@link partitionSlides}: the template-free deck + the template store. */
export interface PartitionedSlides {
	/** The deck with template elements removed from every slide's `elements`. */
	readonly slides: PptxSlide[];
	/** Slide id -> the template elements separated out of that slide (order preserved). */
	readonly templateElementsBySlideId: TemplateElementsBySlideId;
}

/**
 * Split inherited template (master/layout) elements out of each loaded slide.
 *
 * Core merges template elements to the FRONT of `slide.elements`; this separates
 * them into a per-slide store keyed by slide id, leaving each slide with only its
 * own (non-template) elements. Relative order is preserved within both groups, so
 * re-merging via {@link buildSaveSlides} reproduces the original element order.
 */
export function partitionSlides(slides: readonly PptxSlide[]): PartitionedSlides {
	const templateElementsBySlideId: TemplateElementsBySlideId = {};
	const next = slides.map((slide) => {
		const template = slide.elements.filter((el) => isTemplateElement(el));
		const kept = slide.elements.filter((el) => !isTemplateElement(el));
		if (template.length > 0) {
			templateElementsBySlideId[slide.id] = template;
		}
		return template.length > 0 ? { ...slide, elements: kept } : slide;
	});
	return { slides: next, templateElementsBySlideId };
}

/**
 * Fold a slide that core has re-mapped onto a new layout back into the editor's
 * two stores.
 *
 * `applyLayoutToSlide` returns the slide with the TARGET layout's inherited
 * artwork merged in, because that is how core delivers every slide. This editor
 * keeps that artwork in its own store, so the result has to be partitioned again
 * on the way in: the deck takes the slide's own elements, and the store's entry
 * for that slide is REPLACED (not merged) so the previous layout's decoration
 * stops being painted.
 *
 * @param slides - The current template-free deck.
 * @param index - Index of the slide that was re-mapped.
 * @param remapped - The slide as core returned it.
 * @param templateElementsBySlideId - The current template store.
 * @returns The updated deck and store, or `null` when `index` is out of range.
 */
export function slidesWithReappliedLayout(
	slides: readonly PptxSlide[],
	index: number,
	remapped: PptxSlide,
	templateElementsBySlideId: TemplateElementsBySlideId,
): PartitionedSlides | null {
	if (index < 0 || index >= slides.length) {
		return null;
	}
	const partitioned = partitionSlides([remapped]);
	const nextSlides = [...slides];
	nextSlides[index] = partitioned.slides[0]!;
	return {
		slides: nextSlides,
		templateElementsBySlideId: {
			...templateElementsBySlideId,
			[remapped.id]: partitioned.templateElementsBySlideId[remapped.id] ?? [],
		},
	};
}

/**
 * Re-merge the separated template store back into the deck for serialization.
 *
 * Each slide's `elements` become `[...template, ...own]` so template elements sit
 * BEHIND the slide's own elements, exactly as core delivered them. Routing every
 * save through this is what makes template edits persist; a save that bypasses it
 * would silently drop them.
 */
export function buildSaveSlides(
	slides: readonly PptxSlide[],
	templateElementsBySlideId: TemplateElementsBySlideId,
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
 * Resolve whether a single element should participate in selection / drag /
 * resize / delete given the canvas-wide `baseInteractive` flag and the current
 * `editTemplateMode`.
 *
 * - Normal slide elements: follow `baseInteractive` unchanged.
 * - Template (master/layout) elements: interactive only when `baseInteractive`
 *   is set AND `editTemplateMode` is on.
 * - An element whose authored `a:spLocks/@noSelect` is set is NEVER interactive:
 *   PowerPoint treats a no-select shape as part of the backdrop, so it must not
 *   answer a click hit-test nor be swept up by a marquee. Routing that through
 *   the shared {@link canInteractWithElement} keeps the composition rule
 *   (`noSelect` subsumes every other lock) in one place for all five bindings.
 */
export function isElementInteractive(
	element: PptxElement,
	baseInteractive: boolean,
	editTemplateMode: boolean,
): boolean {
	if (!baseInteractive) {
		return false;
	}
	if (!canInteractWithElement(element, 'select')) {
		return false;
	}
	return isTemplateElement(element) ? editTemplateMode : true;
}

/**
 * True when the element is an inherited template element that should show the
 * "editable template" visual affordance (outline ring / reduced opacity). Only
 * ever true while `editTemplateMode` is on, so normal (OFF) rendering is never
 * affected.
 */
export function showsTemplateAffordance(element: PptxElement, editTemplateMode: boolean): boolean {
	return editTemplateMode && isTemplateElement(element);
}
