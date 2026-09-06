import type { OlePptxElement } from 'pptx-viewer-core';
import { getOleObjectTypeLabel } from 'pptx-viewer-core';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { openOleEditorDialog } from './ole-editor-dialog';
import type { InspectorHandlers, InspectorState } from './types';

export interface OlePropertiesSection {
	el: HTMLElement;
	update(state: InspectorState): void;
}

/**
 * OLE object summary (type, file name, link status) plus the Object Name
 * editor. A browser cannot run the native application that owns an embedded
 * OLE object, so the object itself stays read-only. Its Object Name IS
 * editable: `p:oleObj/@name` (ECMA-376 SS13.3.4) already parses, saves, and
 * syncs via collaboration, and shared's `getOleDisplayName` / `getOleAriaLabel`
 * already read it, so this field was the only piece missing to make it a
 * real, round-tripping edit.
 */
export function createOlePropertiesSection(
	doc: Document,
	t: Translator,
	section: (label: string) => HTMLElement,
	handlers: InspectorHandlers,
): OlePropertiesSection {
	const el = section(t('pptx.ole.title'));
	el.classList.add('pptxv-ole-info');

	// A browser cannot run the native application that owns an embedded OLE
	// object, but its recovered payload (spreadsheet cells, document
	// paragraphs, nested-deck slide titles) IS editable in place; see
	// `ole-editor-dialog.ts`. Gated the same as every other per-element edit
	// action in this inspector: not locked, and (OLE-specific) not a link,
	// since there is no local payload to edit for a linked object.
	let currentOle: OlePptxElement | undefined;
	const editButton = doc.createElement('button');
	editButton.type = 'button';
	editButton.textContent = t('pptx.ole.editContent');
	editButton.addEventListener('click', () => {
		if (currentOle) {
			openOleEditorDialog(doc, t, currentOle, {
				onUpdateElement: (patch) => handlers.setOleContent(patch),
			});
		}
	});
	el.appendChild(editButton);

	const nameLabel = createEl(doc, 'label', 'pptxv-field pptxv-ole-name');
	const nameCaption = createEl(doc, 'span', 'pptxv-field-label');
	nameCaption.textContent = t('pptx.ole.objectName');
	const nameInput = doc.createElement('input');
	nameInput.type = 'text';
	nameInput.placeholder = t('pptx.ole.objectNamePlaceholder');
	nameInput.setAttribute('aria-label', t('pptx.ole.objectName'));
	nameInput.addEventListener('keydown', (event) => event.stopPropagation());
	nameInput.addEventListener('change', () => handlers.setOleName(nameInput.value));
	nameLabel.append(nameCaption, nameInput);
	el.appendChild(nameLabel);

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
			currentOle = state.oleElement;
			editButton.hidden = state.isLocked || state.oleIsLinked;
			if (doc.activeElement !== nameInput) {
				nameInput.value = state.oleName ?? '';
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
