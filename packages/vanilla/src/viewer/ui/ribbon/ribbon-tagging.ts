import type { RibbonControlId, RibbonGroupId } from 'pptx-viewer-shared';
import { RIBBON_CONTROL_ATTR, RIBBON_GROUP_ATTR } from 'pptx-viewer-shared';

import { createEl } from '../../render';

/**
 * Tag ribbon markup with the shared catalogue ids
 * (`ribbon-control-catalog.ts`), which is what the shared
 * `ribbonCustomizationCss` hides by. The id parameters are the catalogue's own
 * union types, so a typo is a compile error rather than a control that can
 * never be hidden.
 */
export function tagRibbonGroup<T extends HTMLElement>(el: T, id: RibbonGroupId): T {
	el.setAttribute(RIBBON_GROUP_ATTR, id);
	return el;
}

export function tagRibbonControl<T extends HTMLElement>(el: T, id: RibbonControlId): T {
	el.setAttribute(RIBBON_CONTROL_ATTR, id);
	return el;
}

/**
 * A `display: contents` wrapper, for a group or a multi-element control whose
 * markup has no single element of its own; it never changes layout.
 */
export function contentsWrapper(doc: Document, ...children: HTMLElement[]): HTMLElement {
	const el = createEl(doc, 'div', 'pptxv-ribbon-contents');
	el.append(...children);
	return el;
}

/** A `display: contents` group wrapper around `children`. */
export function wrapRibbonGroup(
	doc: Document,
	id: RibbonGroupId,
	...children: HTMLElement[]
): HTMLElement {
	return tagRibbonGroup(contentsWrapper(doc, ...children), id);
}

/** A `display: contents` control wrapper around `children`. */
export function wrapRibbonControl(
	doc: Document,
	id: RibbonControlId,
	...children: HTMLElement[]
): HTMLElement {
	return tagRibbonControl(contentsWrapper(doc, ...children), id);
}
