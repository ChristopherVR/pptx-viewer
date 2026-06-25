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

import { isTemplateElement } from '../internal/shared';

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
 */
export function isElementInteractive(
	element: PptxElement,
	baseInteractive: boolean,
	editTemplateMode: boolean,
): boolean {
	if (!baseInteractive) {
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
