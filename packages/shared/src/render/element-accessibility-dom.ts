import type { PptxElement } from 'pptx-viewer-core';

import { getAriaLabel, getAriaRole, getAriaRoleDescription } from './accessibility';

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
): number {
	let applied = 0;
	for (const element of flattenElements(elements)) {
		const escapedId =
			typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
				? CSS.escape(element.id)
				: element.id.replace(/["\\]/gu, '\\$&');
		const node = stage.querySelector<HTMLElement>(`[data-element-id="${escapedId}"]`);
		if (!node) {
			continue;
		}
		const role = getAriaRole(element);
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
