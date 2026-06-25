/**
 * template-editing.ts: pure gating logic for the editTemplateMode feature.
 *
 * Template elements (decorative shapes a slide inherits from its layout or
 * master) are merged into `slide.elements` by the core loader, each carrying a
 * `layout-` / `master-` id prefix. They render on every slide that inherits the
 * same template part, so editing one mutates the shared part. To avoid
 * accidental edits, they are interaction-locked unless the user explicitly
 * turns on "edit template" mode.
 *
 * This module owns the gate so the SFCs stay thin (repo rule: presentation-only
 * components, no non-trivial logic inline).
 *
 * @module composables/template-editing
 */
import type { PptxElement } from 'pptx-viewer-core';
import { isTemplateElement, isTemplateElementId } from 'pptx-viewer-shared';

/**
 * Whether `element` may be selected / dragged / deleted / edited on the canvas.
 *
 * - The canvas as a whole must be interactive (`canvasInteractive`); thumbnails,
 *   the export stage and presentation mode pass `false` and gate everything off.
 * - Normal (non-template) slide elements are always interactive when the canvas
 *   is.
 * - Template elements are interactive only while `editTemplateMode` is on.
 */
export function isElementInteractive(
	element: PptxElement,
	canvasInteractive: boolean,
	editTemplateMode: boolean,
): boolean {
	if (!canvasInteractive) {
		return false;
	}
	return isTemplateElement(element) ? editTemplateMode : true;
}

/**
 * Whether the element id may be selected on the canvas. Mirrors
 * {@link isElementInteractive} but keyed on the id alone, for the pointer-down
 * delegation path (which only knows the `data-element-id`).
 */
export function isElementIdInteractive(elementId: string, editTemplateMode: boolean): boolean {
	return isTemplateElementId(elementId) ? editTemplateMode : true;
}

/**
 * Whether the element should show the "editable template" visual affordance:
 * only template elements, and only while edit-template mode is on.
 */
export function isTemplateEditingHighlight(
	element: PptxElement,
	editTemplateMode: boolean,
): boolean {
	return editTemplateMode && isTemplateElement(element);
}
