/**
 * template-mode.ts: per-element interactivity gate for the editTemplateMode
 * feature.
 *
 * Inherited master/layout (template) elements are merged BEHIND the slide's own
 * elements by the core loader and carry ids prefixed `layout-` / `master-`. They
 * always render, but should only be selectable/draggable/deletable when the user
 * has explicitly turned on "edit template" mode; otherwise they are inert so
 * normal slide editing never disturbs the shared template.
 *
 * Pure (no Angular), so it stays unit-testable in isolation and the components
 * remain thin.
 *
 * @module viewer/template-mode
 */
import type { PptxElement } from 'pptx-viewer-core';

import { isTemplateElement } from '../internal/shared';

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
