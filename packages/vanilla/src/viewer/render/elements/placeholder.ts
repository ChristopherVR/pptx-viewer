import { getContainerStyle } from 'pptx-viewer-shared';
import { keyToLabel } from 'pptx-viewer-shared/i18n';

import { createEl } from '../dom';
import type { ElementRenderer } from '../types';

/**
 * Fallback renderer for element types without a dedicated renderer yet
 * (`table`, `chart`, `smartArt`, `media`, `ink`, `ole`, ...): a typed,
 * visually distinct placeholder box positioned exactly where the element
 * belongs, labelled with the element type.
 *
 * The box carries `data-element-id` and `data-element-type` so tests (and
 * follow-up renderer work) can find and replace it precisely.
 */
export const renderPlaceholderElement: ElementRenderer = (element, zIndex, context) => {
	const el = createEl(
		context.document,
		'div',
		'pptxv-element pptxv-placeholder',
		getContainerStyle(element, zIndex),
	);
	el.dataset.elementId = element.id;
	el.dataset.elementType = element.type;

	const label = createEl(context.document, 'div', 'pptxv-placeholder-label');
	label.textContent = keyToLabel(element.type);
	el.appendChild(label);

	return el;
};
