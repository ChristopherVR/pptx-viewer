import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { InspectorDeckState } from './types';

export interface ElementsTab {
	el: HTMLElement;
	update(state: InspectorDeckState): void;
}

/** Short display label for a layer row: leading text if any, else the type. */
function elementLabel(element: PptxElement): string {
	if (hasTextProperties(element) && element.text) {
		return element.text.slice(0, 24);
	}
	return element.type;
}

/**
 * The inspector's Elements tab: the active slide's layer order, top-most
 * first, with click-to-select (React's `InspectorPane` "Elements" tab).
 */
export function createElementsTab(
	doc: Document,
	t: Translator,
	onSelect: (id: string) => void,
): ElementsTab {
	const el = createEl(doc, 'div', 'pptxv-inspector-elements');
	const heading = createEl(doc, 'h4', 'pptxv-inspector-section-title');
	heading.textContent = t('pptx.inspector.layerOrder');
	el.appendChild(heading);
	const list = createEl(doc, 'div', 'pptxv-inspector-layer-list');
	el.appendChild(list);
	const empty = createEl(doc, 'p', 'pptxv-inspector-empty');
	empty.textContent = t('pptx.selectionPane.empty');
	el.appendChild(empty);

	return {
		el,
		update(state) {
			list.replaceChildren();
			empty.hidden = state.elements.length > 0;
			[...state.elements].reverse().forEach((element, reversedIndex) => {
				const index = state.elements.length - reversedIndex - 1;
				const row = createEl(doc, 'button', 'pptxv-inspector-layer-row');
				row.type = 'button';
				row.title = `${element.type}: ${element.id}`;
				row.classList.toggle('is-selected', state.selectedIds.includes(element.id));
				const num = createEl(doc, 'span', 'pptxv-inspector-layer-num');
				num.textContent = String(index + 1);
				const label = createEl(doc, 'span', 'pptxv-inspector-layer-label');
				label.textContent = elementLabel(element);
				row.append(num, label);
				row.addEventListener('click', () => onSelect(element.id));
				list.appendChild(row);
			});
		},
	};
}
