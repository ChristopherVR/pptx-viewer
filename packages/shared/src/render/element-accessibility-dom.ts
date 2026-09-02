import type { PptxElement } from 'pptx-viewer-core';

import { getAriaLabel, getAriaRole, getAriaRoleDescription } from './accessibility';
import { elementIdSelector } from './css-escape';
import { isElementActionable } from './element-actionability';
import { PRESENTATION_STAGE_ATTRIBUTE } from './presentation-hit-test';

/** Options for {@link applyRenderedElementAccessibility}. */
export interface RenderedElementAccessibilityOptions {
	/**
	 * True when this stage is a RUNNING slide show, which marks it so
	 * {@link PRESENTATION_HIT_TEST_CSS} can make its scenery pointer-
	 * transparent (only action shapes, media transport and links stay
	 * clickable, exactly as in PowerPoint).
	 */
	presenting?: boolean;
}

function flattenElements(elements: readonly PptxElement[]): PptxElement[] {
	const flattened: PptxElement[] = [];
	for (const element of elements) {
		flattened.push(element);
		if (element.type === 'group' && element.children) {
			flattened.push(...flattenElements(element.children));
		}
	}
	return flattened;
}

/** Apply the shared role and accessible-name model at a rendered stage boundary. */
export function applyRenderedElementAccessibility(
	stage: ParentNode,
	elements: readonly PptxElement[],
	options: RenderedElementAccessibilityOptions = {},
): number {
	if (typeof Element !== 'undefined' && stage instanceof Element) {
		if (options.presenting) {
			stage.setAttribute(PRESENTATION_STAGE_ATTRIBUTE, 'true');
		} else {
			stage.removeAttribute(PRESENTATION_STAGE_ATTRIBUTE);
		}
	}
	let applied = 0;
	for (const element of flattenElements(elements)) {
		const node = stage.querySelector<HTMLElement>(elementIdSelector(element.id));
		if (!node) {
			continue;
		}
		// Actionable elements (click/hover action, text hyperlink, zoom tile) are
		// announced as buttons, matching React's element renderer.
		const actionable = isElementActionable(element);
		// `data-pptx-action` is the neutral marker
		// `PRESENTATION_INERT_CLICK_SELECTOR` keys off: an element that owns its
		// own click must never ALSO step the slide show on. Only React stamped it
		// (and only on its static renderer), so on a deck whose navigation is
		// on-slide action shapes every other binding advanced the show instead of
		// following the link.
		if (actionable) {
			node.setAttribute('data-pptx-action', 'click');
		} else {
			node.removeAttribute('data-pptx-action');
		}
		const role = getAriaRole(element, { actionable });
		if (role) {
			node.setAttribute('role', role);
		} else {
			node.removeAttribute('role');
		}
		node.setAttribute('aria-label', getAriaLabel(element));
		const roleDescription = getAriaRoleDescription(element);
		if (roleDescription) {
			node.setAttribute('aria-roledescription', roleDescription);
		} else {
			node.removeAttribute('aria-roledescription');
		}
		applied += 1;
	}
	return applied;
}
