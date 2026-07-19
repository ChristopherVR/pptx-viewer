import type { ViewerOptionsStore } from 'pptx-viewer-shared';
import { SHORTCUT_REFERENCE_ITEMS, TOOLBAR_TABS } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { appendOptionsAction } from './options-controls';

/**
 * Options > Customize Ribbon: PowerPoint's "Main Tabs" checkbox tree over the
 * shared `TOOLBAR_TABS` registry (the File tab can never be hidden), a reset
 * button, and the keyboard-shortcut reference. Vanilla counterpart of React's
 * `OptionsRibbonPane`.
 */
export function renderRibbonPane(
	doc: Document,
	t: Translator,
	parent: HTMLElement,
	store: ViewerOptionsStore,
): void {
	const section = createEl(doc, 'section', 'pptxv-options-section');
	const title = createEl(doc, 'h3');
	title.textContent = t('pptx.options.ribbon.tabsTitle');
	const description = createEl(doc, 'p', 'pptxv-options-section-desc');
	description.textContent = t('pptx.options.ribbon.tabsDescription');
	section.append(title, description);

	const hidden = new Set(store.getOptions().ribbon.hiddenTabIds);
	const list = createEl(doc, 'div', 'pptxv-options-ribbon-list');
	for (const tab of TOOLBAR_TABS) {
		const isFile = tab.id === 'file';
		const row = createEl(doc, 'label', `pptxv-parity-check${isFile ? ' is-locked' : ''}`);
		const input = doc.createElement('input');
		input.type = 'checkbox';
		input.checked = isFile || !hidden.has(tab.id);
		input.disabled = isFile;
		input.addEventListener('change', () => {
			store.setRibbonTabHidden(tab.id, !input.checked);
		});
		row.append(input, doc.createTextNode(t(tab.labelKey)));
		list.appendChild(row);
	}
	section.appendChild(list);
	appendOptionsAction(doc, section, t('pptx.options.ribbon.reset'), () => {
		store.reset('ribbon');
	});
	parent.appendChild(section);

	appendShortcutReference(doc, t, parent);
}

/** The keyboard-shortcut reference list (shared with the ribbon tab schema's special section). */
export function appendShortcutReference(doc: Document, t: Translator, parent: HTMLElement): void {
	const section = createEl(doc, 'section', 'pptxv-options-section');
	const title = createEl(doc, 'h3');
	title.textContent = t('pptx.settings.keyboardShortcuts');
	section.appendChild(title);
	const list = createEl(doc, 'div', 'pptxv-shortcut-list');
	for (const { actionKey, shortcut } of SHORTCUT_REFERENCE_ITEMS) {
		const row = createEl(doc, 'div');
		const action = createEl(doc, 'span');
		action.textContent = t(actionKey);
		const keys = createEl(doc, 'kbd');
		keys.textContent = shortcut;
		row.append(action, keys);
		list.appendChild(row);
	}
	section.appendChild(list);
	parent.appendChild(section);
}
