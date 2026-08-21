import { getOleObjectTypeLabel } from 'pptx-viewer-core';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { InspectorState } from './types';

export interface OlePropertiesSection {
	el: HTMLElement;
	update(state: InspectorState): void;
}

/** Read-only OLE object summary: type, file name (when known), link status. */
export function createOlePropertiesSection(
	doc: Document,
	t: Translator,
	section: (label: string) => HTMLElement,
): OlePropertiesSection {
	const el = section(t('pptx.ole.title'));
	el.classList.add('pptxv-ole-info');

	const buildRow = (label: string): { row: HTMLElement; value: HTMLElement } => {
		const row = createEl(doc, 'div', 'pptxv-ole-row');
		const labelEl = createEl(doc, 'span');
		labelEl.textContent = label;
		const value = createEl(doc, 'span', 'pptxv-ole-value');
		row.append(labelEl, value);
		el.appendChild(row);
		return { row, value };
	};

	const typeRow = buildRow(t('pptx.ole.type'));
	const fileRow = buildRow(t('pptx.ole.fileName'));
	const linkRow = buildRow(t('pptx.ole.linkStatus'));
	linkRow.value.classList.add('pptxv-ole-badge');

	return {
		el,
		update(state) {
			el.hidden = !state.isOle;
			if (!state.isOle) {
				return;
			}
			typeRow.value.textContent = getOleObjectTypeLabel(state.oleObjectType);
			fileRow.row.hidden = !state.oleFileName;
			fileRow.value.textContent = state.oleFileName ?? '';
			fileRow.value.title = state.oleFileName ?? '';
			linkRow.value.textContent = t(state.oleIsLinked ? 'pptx.ole.linked' : 'pptx.ole.embedded');
			linkRow.value.classList.toggle('is-linked', state.oleIsLinked);
		},
	};
}
