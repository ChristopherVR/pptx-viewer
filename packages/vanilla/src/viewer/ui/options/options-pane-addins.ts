import type { ViewerAddinRow, ViewerAddinStatus } from 'pptx-viewer-shared';
import { resolveViewerAddinRows } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';

/** Selection state kept by the dialog so it survives pane re-renders. */
export interface AddinsPaneState {
	selectedId: string | null;
}

export function createAddinsPaneState(): AddinsPaneState {
	return { selectedId: null };
}

function appendAddinTable(
	doc: Document,
	t: Translator,
	parent: HTMLElement,
	title: string,
	rows: ViewerAddinRow[],
	state: AddinsPaneState,
	rerender: () => void,
): void {
	const heading = createEl(doc, 'h4');
	heading.textContent = title;
	parent.appendChild(heading);
	if (rows.length === 0) {
		const empty = createEl(doc, 'p', 'pptxv-options-addins-empty');
		empty.textContent = t('pptx.options.addIns.description');
		parent.appendChild(empty);
		return;
	}
	const table = doc.createElement('table');
	const tbody = doc.createElement('tbody');
	for (const row of rows) {
		const tr = doc.createElement('tr');
		tr.className = state.selectedId === row.id ? 'is-selected' : '';
		const name = doc.createElement('td');
		name.textContent = t(row.nameKey);
		const location = doc.createElement('td');
		location.textContent = row.location;
		const type = doc.createElement('td');
		type.textContent = t(`pptx.options.addInType.${row.type}`);
		tr.append(name, location, type);
		tr.addEventListener('click', () => {
			state.selectedId = row.id;
			rerender();
		});
		tbody.appendChild(tr);
	}
	table.appendChild(tbody);
	parent.appendChild(table);
}

/**
 * Options > Add-ins: the viewer's optional capability modules presented like
 * PowerPoint's add-in inventory (grouped active/inactive, details for the
 * selected row). Vanilla counterpart of React's `OptionsAddInsPane`.
 */
export function renderAddInsPane(
	doc: Document,
	t: Translator,
	parent: HTMLElement,
	addinStatus: ViewerAddinStatus | undefined,
	state: AddinsPaneState,
	rerender: () => void,
): void {
	const host = createEl(doc, 'div', 'pptxv-options-addins');
	const head = createEl(doc, 'div', 'pptxv-options-addins-head');
	for (const key of ['name', 'location', 'type'] as const) {
		const cell = createEl(doc, 'span');
		cell.textContent = t(`pptx.options.addIns.${key}`);
		head.appendChild(cell);
	}
	host.appendChild(head);

	const rows = resolveViewerAddinRows(addinStatus);
	appendAddinTable(
		doc,
		t,
		host,
		t('pptx.options.addIns.active'),
		rows.filter((row) => row.active),
		state,
		rerender,
	);
	appendAddinTable(
		doc,
		t,
		host,
		t('pptx.options.addIns.inactive'),
		rows.filter((row) => !row.active),
		state,
		rerender,
	);

	const selected = rows.find((row) => row.id === state.selectedId);
	if (selected) {
		const detail = createEl(doc, 'div', 'pptxv-options-addins-detail');
		const name = createEl(doc, 'p');
		name.textContent = t(selected.nameKey);
		const description = createEl(doc, 'p');
		description.textContent = t(selected.descriptionKey);
		const location = createEl(doc, 'p');
		location.textContent = selected.location;
		detail.append(name, description, location);
		host.appendChild(detail);
	}
	parent.appendChild(host);
}
