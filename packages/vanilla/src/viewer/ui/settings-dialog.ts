import type { ThemeCatalogEntry, ViewerSettings, ViewerTheme } from 'pptx-viewer-shared';
import {
	SETTING_TOGGLES,
	SHORTCUT_REFERENCE_ITEMS,
	THEME_CATALOG,
	updateViewerPreference,
} from 'pptx-viewer-shared';
import type { LocaleCatalogEntry } from 'pptx-viewer-shared/i18n';
import { LOCALE_CATALOG } from 'pptx-viewer-shared/i18n';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import {
	appendCheckRow,
	appendDialogButton,
	appendRadioRow,
	appendSwatchRow,
	createParityDialogShell,
} from './parity-dialog-shell';

export type SettingsDialogTab = 'general' | 'shortcuts' | 'appearance' | 'language';

/** File > Options > Appearance wiring: the theme catalog, the active key, and where selections go. */
export interface SettingsDialogThemeOptions {
	catalog: readonly ThemeCatalogEntry[];
	currentKey: string;
	onSelect: (theme: ViewerTheme | undefined, key: string) => void;
}

/** File > Options > Language wiring: the locale catalog, the active code, and where selections go. */
export interface SettingsDialogLocaleOptions {
	catalog: readonly LocaleCatalogEntry[];
	currentCode: string;
	onSelect: (code: string) => void;
}

const DEFAULT_THEME_OPTIONS: SettingsDialogThemeOptions = {
	catalog: THEME_CATALOG,
	currentKey: 'default',
	onSelect: () => {},
};

const DEFAULT_LOCALE_OPTIONS: SettingsDialogLocaleOptions = {
	catalog: LOCALE_CATALOG,
	currentCode: 'en',
	onSelect: () => {},
};

export function openSettingsDialog(
	doc: Document,
	t: Translator,
	settings: ViewerSettings,
	onSave: (settings: ViewerSettings) => void,
	initialTab: SettingsDialogTab = 'general',
	themeOptions: SettingsDialogThemeOptions = DEFAULT_THEME_OPTIONS,
	localeOptions: SettingsDialogLocaleOptions = DEFAULT_LOCALE_OPTIONS,
): void {
	const shell = createParityDialogShell(doc, t, t('pptx.settings.title'));
	const tabs = createEl(doc, 'div', 'pptxv-parity-tabs');
	const content = createEl(doc, 'div');
	shell.body.append(tabs, content);
	let tab = initialTab;
	let selectedThemeKey = themeOptions.currentKey;
	let selectedLocaleCode = localeOptions.currentCode;
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
		if (tab === 'appearance') {
			appendSwatchRow(
				doc,
				content,
				themeOptions.catalog.map((entry) => ({
					key: entry.key,
					label: t(entry.labelKey),
					previewColor: entry.theme?.colors?.primary ?? '#6b7280',
				})),
				selectedThemeKey,
				(key) => {
					const entry = themeOptions.catalog.find((candidate) => candidate.key === key);
					if (!entry) {
						return;
					}
					selectedThemeKey = key;
					themeOptions.onSelect(entry.theme, key);
					render();
				},
			);
			return;
		}
		if (tab === 'language') {
			appendRadioRow(
				doc,
				content,
				'pptxv-settings-locale',
				localeOptions.catalog.map((entry) => ({ value: entry.code, label: entry.nativeLabel })),
				selectedLocaleCode,
				(code) => {
					selectedLocaleCode = code;
					localeOptions.onSelect(code);
					render();
				},
			);
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
			['appearance', 'pptx.settings.appearance'],
			['language', 'pptx.settings.language'],
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
