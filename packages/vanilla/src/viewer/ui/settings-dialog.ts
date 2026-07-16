import type { ViewerSettings } from 'pptx-viewer-shared';
import {
	SETTING_TOGGLES,
	SHORTCUT_REFERENCE_ITEMS,
	updateViewerPreference,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { appendCheckRow, appendDialogButton, createParityDialogShell } from './parity-dialog-shell';

export function openSettingsDialog(
	doc: Document,
	t: Translator,
	settings: ViewerSettings,
	onSave: (settings: ViewerSettings) => void,
	initialTab: 'general' | 'shortcuts' = 'general',
): void {
	const shell = createParityDialogShell(doc, t, t('pptx.settings.title'));
	const tabs = createEl(doc, 'div', 'pptxv-parity-tabs');
	const content = createEl(doc, 'div');
	shell.body.append(tabs, content);
	let tab = initialTab;
	const render = (): void => {
		content.replaceChildren();
		for (const button of tabs.querySelectorAll('button')) {
			button.classList.toggle('is-active', button.getAttribute('data-tab') === tab);
		}
		if (tab === 'shortcuts') {
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
			content.appendChild(list);
			return;
		}
		SETTING_TOGGLES.forEach(({ key, labelKey }) => {
			const input = appendCheckRow(doc, content, t(labelKey), settings[key]);
			input.addEventListener('change', () => {
				settings = updateViewerPreference(settings, key, input.checked);
				onSave(settings);
			});
		});
	};
	(
		[
			['general', 'pptx.settings.general'],
			['shortcuts', 'pptx.settings.keyboardShortcuts'],
		] as const
	).forEach(([id, key]) => {
		const button = appendDialogButton(doc, tabs, t(key), () => {
			tab = id;
			render();
		});
		button.dataset.tab = id;
	});
	appendDialogButton(doc, shell.footer, t('pptx.settings.done'), shell.close, true);
	render();
}
