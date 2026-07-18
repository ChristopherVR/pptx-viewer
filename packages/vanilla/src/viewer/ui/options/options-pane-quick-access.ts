import type { ViewerOptionsStore } from 'pptx-viewer-shared';
import {
	DEFAULT_QUICK_ACCESS_COMMAND_IDS,
	QUICK_ACCESS_COMMAND_CATALOG,
	addQuickAccessCommand,
	availableQuickAccessCommands,
	moveQuickAccessCommand,
	removeQuickAccessCommand,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { appendOptionsAction } from './options-controls';

/** Listbox selection state kept by the dialog so it survives pane re-renders. */
export interface QuickAccessPaneState {
	selectedAvailable: string | null;
	selectedCurrent: string | null;
}

export function createQuickAccessPaneState(): QuickAccessPaneState {
	return { selectedAvailable: null, selectedCurrent: null };
}

function appendCommandList(
	doc: Document,
	t: Translator,
	parent: HTMLElement,
	title: string,
	commandIds: readonly string[],
	selectedId: string | null,
	onSelect: (id: string) => void,
): void {
	const col = createEl(doc, 'div', 'pptxv-options-qa-col');
	const heading = createEl(doc, 'p', 'pptxv-options-qa-title');
	heading.textContent = title;
	const list = createEl(doc, 'div', 'pptxv-options-qa-list');
	list.setAttribute('role', 'listbox');
	list.setAttribute('aria-label', title);
	for (const id of commandIds) {
		const command = QUICK_ACCESS_COMMAND_CATALOG.find((entry) => entry.id === id);
		if (!command) {
			continue;
		}
		const button = createEl(doc, 'button', selectedId === id ? 'is-selected' : '');
		button.type = 'button';
		button.setAttribute('role', 'option');
		button.setAttribute('aria-selected', String(selectedId === id));
		button.textContent = t(command.labelKey);
		button.addEventListener('click', () => onSelect(id));
		list.appendChild(button);
	}
	col.append(heading, list);
	parent.appendChild(col);
}

/**
 * Options > Quick Access Toolbar: PowerPoint's dual-list command chooser with
 * Add/Remove, reorder arrows, and Reset over the shared command catalog.
 * Vanilla counterpart of React's `OptionsQuickAccessPane`; every mutation goes
 * through the store, whose change notification re-renders the pane.
 */
export function renderQuickAccessPane(
	doc: Document,
	t: Translator,
	parent: HTMLElement,
	store: ViewerOptionsStore,
	state: QuickAccessPaneState,
	rerender: () => void,
): void {
	const current = store.getOptions().quickAccess.commandIds;
	const available = availableQuickAccessCommands(current).map((entry) => entry.id);
	const row = createEl(doc, 'div', 'pptxv-options-qa');

	appendCommandList(
		doc,
		t,
		row,
		t('pptx.options.quickAccess.chooseCommands'),
		available,
		state.selectedAvailable,
		(id) => {
			state.selectedAvailable = id;
			rerender();
		},
	);

	const middle = createEl(doc, 'div', 'pptxv-options-qa-arrows');
	const add = appendOptionsAction(doc, middle, `${t('pptx.options.quickAccess.add')} »`, () => {
		if (state.selectedAvailable) {
			store.setQuickAccessCommands(addQuickAccessCommand(current, state.selectedAvailable));
			state.selectedAvailable = null;
		}
	});
	add.disabled = !state.selectedAvailable;
	const remove = appendOptionsAction(
		doc,
		middle,
		`« ${t('pptx.options.quickAccess.remove')}`,
		() => {
			if (state.selectedCurrent) {
				store.setQuickAccessCommands(removeQuickAccessCommand(current, state.selectedCurrent));
				state.selectedCurrent = null;
			}
		},
	);
	remove.disabled = !state.selectedCurrent;
	row.appendChild(middle);

	appendCommandList(
		doc,
		t,
		row,
		t('pptx.options.quickAccess.currentCommands'),
		current,
		state.selectedCurrent,
		(id) => {
			state.selectedCurrent = id;
			rerender();
		},
	);

	const arrows = createEl(doc, 'div', 'pptxv-options-qa-arrows');
	const up = appendOptionsAction(doc, arrows, '↑', () => {
		if (state.selectedCurrent) {
			store.setQuickAccessCommands(moveQuickAccessCommand(current, state.selectedCurrent, 'up'));
		}
	});
	up.setAttribute('aria-label', t('pptx.options.quickAccess.moveUp'));
	up.disabled = !state.selectedCurrent;
	const down = appendOptionsAction(doc, arrows, '↓', () => {
		if (state.selectedCurrent) {
			store.setQuickAccessCommands(moveQuickAccessCommand(current, state.selectedCurrent, 'down'));
		}
	});
	down.setAttribute('aria-label', t('pptx.options.quickAccess.moveDown'));
	down.disabled = !state.selectedCurrent;
	row.appendChild(arrows);

	parent.appendChild(row);
	appendOptionsAction(doc, parent, t('pptx.options.quickAccess.reset'), () => {
		store.setQuickAccessCommands([...DEFAULT_QUICK_ACCESS_COMMAND_IDS]);
	});
}
