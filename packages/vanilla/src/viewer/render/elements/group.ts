import type { PptxElement } from 'pptx-viewer-core';
import type { ComputedFillStyle } from 'pptx-viewer-shared';
import {
	getContainerStyle,
	getGroupChildParentFill,
	resolveGroupChildFill,
} from 'pptx-viewer-shared';

import { createEl } from '../dom';
import type { ElementRenderer } from '../types';

/**
 * Paint a group child's `a:grpFill` inheritance onto its already-rendered node.
 *
 * The registry's `renderElement` contract is fixed (element, zIndex, context),
 * so the group renderer cannot thread the parent fill down as an argument the
 * way the component bindings do. Instead we resolve the inherited fill here and
 * apply it directly to the child's root node, overriding its (transparent)
 * self-fill. A no-op unless the child is a shape painted with `a:grpFill`.
 */
function applyGroupChildFill(node: HTMLElement | SVGElement, fill: ComputedFillStyle): void {
	if (fill.backgroundColor !== undefined) {
		node.style.backgroundColor = fill.backgroundColor;
	}
	if (fill.backgroundImage !== undefined) {
		node.style.backgroundImage = fill.backgroundImage;
	}
	if (fill.backgroundRepeat !== undefined) {
		node.style.backgroundRepeat = fill.backgroundRepeat;
	}
	if (fill.backgroundSize !== undefined) {
		node.style.backgroundSize = fill.backgroundSize;
	}
}

/**
 * Renderer for `group` elements: an absolutely positioned container that
 * recurses into `children` through the registry (so custom renderers apply
 * inside groups too). Children painted with `a:grpFill` inherit this group's
 * own fill.
 */
export const renderGroupElement: ElementRenderer = (element, zIndex, context) => {
	const el = createEl(
		context.document,
		'div',
		'pptxv-element pptxv-group',
		getContainerStyle(element, zIndex),
	);
	el.dataset.elementId = element.id;

	if (element.type === 'group' && element.children?.length) {
		const parentGroupFill = getGroupChildParentFill(element);
		element.children.forEach((child: PptxElement, index) => {
			const childEl = context.renderElement(child, index);
			if (childEl) {
				const inherited = resolveGroupChildFill(child, parentGroupFill);
				if (inherited) {
					applyGroupChildFill(childEl, inherited);
				}
				el.appendChild(childEl);
			}
		});
	}

	return el;
};
