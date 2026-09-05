import type { PptxElement } from 'pptx-viewer-core';

import {
	getAriaLabel,
	getAriaRole,
	getAriaRoleDescription,
	isElementMarkedDecorative,
} from './accessibility';
import type { ElementActionabilityOptions } from './element-actionability';
import { isElementActionable } from './element-actionability';

/**
 * The accessibility attributes one rendered element wrapper carries.
 *
 * A pure descriptor: `applyRenderedElementAccessibility` stamps it onto the DOM
 * for the four bindings that render first and annotate afterwards, and React
 * maps it straight onto its wrapper's props. Both paths therefore agree on the
 * one rule that used to drift (a decorative picture is `aria-hidden` in four
 * bindings and announced in the fifth).
 */
export interface ElementAriaAttributes {
	/** Click/hover action, text hyperlink or zoom tile: announced as a control. */
	readonly actionable: boolean;
	/** `role`, or undefined when the element should carry none. */
	readonly role: string | undefined;
	/** `aria-label`; empty for a decorative element that is not actionable. */
	readonly label: string;
	/** `aria-roledescription`, or undefined when there is nothing to add. */
	readonly roleDescription: string | undefined;
	/**
	 * "Mark as decorative" (issue G16): skip the element entirely for
	 * assistive tech, matching PowerPoint's own behaviour. Actionable wins
	 * (PowerPoint disables the decorative flag once an action is attached), so
	 * a decorative-but-clickable shape stays announced.
	 */
	readonly hidden: boolean;
}

/**
 * Resolve the ARIA attributes a rendered element wrapper must carry.
 *
 * @param options - Which action handlers the host wired up; an action with no
 *   handler is not actionable (see {@link isElementActionable}).
 */
export function resolveElementAriaAttributes(
	element: PptxElement,
	options?: ElementActionabilityOptions,
): ElementAriaAttributes {
	const actionable = isElementActionable(element, options);
	return {
		actionable,
		role: getAriaRole(element, { actionable }) || undefined,
		label: getAriaLabel(element, { actionable }),
		roleDescription: getAriaRoleDescription(element) || undefined,
		hidden: !actionable && isElementMarkedDecorative(element),
	};
}
