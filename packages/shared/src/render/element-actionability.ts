/**
 * Is a rendered slide element *actionable*: does activating it do something?
 *
 * PowerPoint lets a shape carry a click action (`a:hlinkClick` on `p:cNvPr`,
 * including the `ppaction://` verbs), a hover action (`a:hlinkHover`), a
 * run-level text hyperlink, or be a slide/section zoom tile. Such an element is
 * a control, not a graphic, so the viewer must expose it to assistive
 * technology as `role="button"` rather than as the `img` / `group` its element
 * type would otherwise get.
 *
 * The rule lives here, in shared, because all five bindings have to agree on it
 * by construction: React derived it inside its own `ElementRenderer` while the
 * other four never derived it at all, so the same deck advertised 37 buttons in
 * React and none anywhere else.
 *
 * @module render/element-actionability
 */

import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import { isNoOpPresentationAction } from './presentation-action';

/**
 * Whether the element actually carries a run-level text hyperlink
 * (`a:hlinkClick` on any text run).
 *
 * This must reflect the ELEMENT's data, not the presence of a hyperlink
 * handler: the handler is always supplied by the canvas, so keying off it alone
 * would make every element (including inert layout/master template shapes)
 * report as actionable and defeat the `editTemplateMode` interaction gate.
 */
export function elementHasTextHyperlink(element: PptxElement): boolean {
	if (!hasTextProperties(element)) {
		return false;
	}
	return Boolean(element.textSegments?.some((segment) => Boolean(segment.style?.hyperlink)));
}

/**
 * Which of the host canvas's activation handlers are wired up.
 *
 * A binding that cannot follow an action should not advertise the element as a
 * button. Every flag defaults to `true` so a caller with no handler plumbing of
 * its own (for example the post-render DOM pass the non-React bindings use)
 * classifies purely from the element's own data.
 */
export interface ElementActionabilityOptions {
	/** The canvas can follow a shape-level click action (`actionClick`). */
	hasActionHandler?: boolean;
	/** The canvas can follow a run-level text hyperlink. */
	hasHyperlinkHandler?: boolean;
	/** The canvas can follow a slide/section zoom tile. */
	hasZoomHandler?: boolean;
}

/**
 * True when activating this element navigates, plays, or otherwise acts.
 *
 * Hover actions need no handler flag: PowerPoint fires them from the element's
 * own data, so an element carrying one is actionable in every binding.
 */
export function isElementActionable(
	element: PptxElement,
	options: ElementActionabilityOptions = {},
): boolean {
	const { hasActionHandler = true, hasHyperlinkHandler = true, hasZoomHandler = true } = options;
	// `ppaction://noaction` is PowerPoint's "Action: None" - the shape keeps an
	// `a:hlinkClick` entry (usually to carry a highlight or a sound) but does
	// nothing. Announcing it as a button was wrong, and in a slide show it made
	// the shape swallow the click-to-advance instead of letting it through.
	if (element.actionClick && hasActionHandler && !isNoOpPresentationAction(element.actionClick)) {
		return true;
	}
	if (element.actionHover && !isNoOpPresentationAction(element.actionHover)) {
		return true;
	}
	if (hasHyperlinkHandler && elementHasTextHyperlink(element)) {
		return true;
	}
	return element.type === 'zoom' && hasZoomHandler;
}
