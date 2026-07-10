import { getContainerStyle } from 'pptx-viewer-shared';

import { createEl } from '../dom';
import type { ElementRenderer } from '../types';

/**
 * Renderer for `group` elements: an absolutely positioned container that
 * recurses into `children` through the registry (so custom renderers apply
 * inside groups too).
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
		element.children.forEach((child, index) => {
			const childEl = context.renderElement(child, index);
			if (childEl) {
				el.appendChild(childEl);
			}
		});
	}

	return el;
};
