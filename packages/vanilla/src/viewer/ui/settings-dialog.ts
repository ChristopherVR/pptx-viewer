import type {
	ThemeCatalogEntry,
	ViewerAddinStatus,
	ViewerOptionsSection,
	ViewerOptionsStore,
	ViewerOptionsTabDefinition,
	ViewerOptionsTabId,
	ViewerTheme,
} from 'pptx-viewer-shared';
import { cloneViewerOptions, VIEWER_OPTIONS_TABS } from 'pptx-viewer-shared';
import type { PptxAiChatStore } from 'pptx-viewer-shared/ai';
import type { LocaleCatalogEntry } from 'pptx-viewer-shared/i18n';

import { createAiSettingsSection } from '../ai/ai-settings-section';
import type { Translator } from '../i18n';
import { createEl } from '../render';
import { appendOptionsAction, appendOptionsSection } from './options/options-controls';
import { createAddinsPaneState, renderAddInsPane } from './options/options-pane-addins';
import {
	createQuickAccessPaneState,
	renderQuickAccessPane,
} from './options/options-pane-quick-access';
import { appendShortcutReference, renderRibbonPane } from './options/options-pane-ribbon';
import {
	appendDialogButton,
	appendRadioRow,
	appendSwatchRow,
	createParityDialogShell,
} from './parity-dialog-shell';

/** File > Options > General appearance wiring: theme catalog + active key + selection sink. */
export interface SettingsDialogThemeOptions {
	catalog: readonly ThemeCatalogEntry[];
	currentKey: string;
	onSelect: (theme: ViewerTheme | undefined, key: string) => void;
}

/** File > Options > Language wiring: locale catalog + active code + selection sink. */
export interface SettingsDialogLocaleOptions {
	catalog: readonly LocaleCatalogEntry[];
	currentCode: string;
	onSelect: (code: string) => void;
}

export interface ViewerOptionsDialogDeps {
	/** The shared File > Options store; changes apply live, Cancel restores. */
	store: ViewerOptionsStore;
	themeOptions: SettingsDialogThemeOptions;
	localeOptions: SettingsDialogLocaleOptions;
	/** Availability flags for the Add-ins pane (unset ids default to active). */
	addinStatus?: ViewerAddinStatus;
	/** Options > Save > "Delete cached files". */
	onClearCache: () => void;
	initialTab?: ViewerOptionsTabId;
	/** When true, an "AI" section is appended for exporting detailed chat logs. */
	aiEnabled?: boolean;
	/** Chat store the AI export reads from (defaults to the shared store). */
	aiChatStore?: PptxAiChatStore;
}

/**
 * The PowerPoint "File > Options" parity dialog: the ten shared categories in
 * a left rail with schema-driven panes on the right (vanilla counterpart of
 * React's `SettingsDialog`). Changes apply to the store live; Cancel restores
 * the snapshot taken when the dialog opened; OK (and Escape/backdrop) confirm.
 */
export function openSettingsDialog(
	doc: Document,
	t: Translator,
	deps: ViewerOptionsDialogDeps,
): void {
	const { store } = deps;
	const shell = createParityDialogShell(doc, t, t('pptx.options.title'));
	shell.dialog.classList.add('pptxv-options-dialog');
	const body = createEl(doc, 'div', 'pptxv-options-body');
	const nav = createEl(doc, 'nav', 'pptxv-options-nav');
	nav.setAttribute('aria-label', t('pptx.options.title'));
	const pane = createEl(doc, 'div', 'pptxv-options-pane');
	body.append(nav, pane);
	shell.body.appendChild(body);

	const snapshot = cloneViewerOptions(store.getOptions());
	let activeTabId: ViewerOptionsTabId = deps.initialTab ?? 'general';
	// The AI export lives in a synthetic tab appended after the schema tabs.
	let aiActive = false;
	let aiNavButton: HTMLButtonElement | null = null;
	let selectedThemeKey = deps.themeOptions.currentKey;
	let selectedLocaleCode = deps.localeOptions.currentCode;
	const quickAccessState = createQuickAccessPaneState();
	const addinsState = createAddinsPaneState();

	const renderSpecial = (section: ViewerOptionsSection, host: HTMLElement): void => {
		if (section.special === 'themePicker') {
			appendSwatchRow(
				doc,
				host,
				deps.themeOptions.catalog.map((entry) => ({
					key: entry.key,
					label: t(entry.labelKey),
					previewColor: entry.theme?.colors?.primary ?? '#6b7280',
				})),
				selectedThemeKey,
				(key) => {
					const entry = deps.themeOptions.catalog.find((candidate) => candidate.key === key);
					if (entry) {
						selectedThemeKey = key;
						deps.themeOptions.onSelect(entry.theme, key);
						renderPane();
					}
				},
			);
		} else if (section.special === 'clearCache') {
			const description = createEl(doc, 'p', 'pptxv-options-section-desc');
			description.textContent = t('pptx.options.save.clearCacheDescription');
			host.appendChild(description);
			appendOptionsAction(doc, host, t('pptx.options.save.clearCacheNow'), deps.onClearCache);
		} else if (section.special === 'shortcutReference') {
			appendShortcutReference(doc, t, host);
		}
	};

	const renderLanguagePane = (): void => {
		const section = createEl(doc, 'section', 'pptxv-options-section');
		const title = createEl(doc, 'h3');
		title.textContent = t('pptx.options.language.displayLanguage');
		const description = createEl(doc, 'p', 'pptxv-options-section-desc');
		description.textContent = t('pptx.options.language.displayLanguageDescription');
		section.append(title, description);
		appendRadioRow(
			doc,
			section,
			'pptxv-options-locale',
			deps.localeOptions.catalog.map((entry) => ({
				value: entry.code,
				label: entry.nativeLabel,
			})),
			selectedLocaleCode,
			(code) => {
				selectedLocaleCode = code;
				deps.localeOptions.onSelect(code);
				renderPane();
			},
		);
		pane.appendChild(section);
	};

	const renderGenericSections = (tab: ViewerOptionsTabDefinition): void => {
		for (const section of tab.sections) {
			appendOptionsSection(doc, t, pane, section, store, renderSpecial);
		}
	};

	const renderAiPane = (): void => {
		for (const button of nav.querySelectorAll('button')) {
			button.classList.remove('is-active');
			button.setAttribute('aria-current', 'false');
		}
		aiNavButton?.classList.add('is-active');
		aiNavButton?.setAttribute('aria-current', 'true');
		pane.replaceChildren();
		const headline = createEl(doc, 'p', 'pptxv-options-headline');
		headline.textContent = t('pptx.ai.exportLogsHint');
		pane.append(headline, createAiSettingsSection({ doc, t, store: deps.aiChatStore }));
	};

	function renderPane(): void {
		if (aiActive) {
			renderAiPane();
			return;
		}
		const tab =
			VIEWER_OPTIONS_TABS.find((entry) => entry.id === activeTabId) ?? VIEWER_OPTIONS_TABS[0];
		if (!tab) {
			return;
		}
		for (const button of nav.querySelectorAll('button')) {
			const active = button.getAttribute('data-tab') === tab.id;
			button.classList.toggle('is-active', active);
			button.setAttribute('aria-current', String(active));
		}
		pane.replaceChildren();
		const headline = createEl(doc, 'p', 'pptxv-options-headline');
		headline.textContent = t(tab.descriptionKey);
		pane.appendChild(headline);
		if (tab.custom === 'language') {
			renderLanguagePane();
		} else if (tab.custom === 'ribbon') {
			renderRibbonPane(doc, t, pane, store);
		} else if (tab.custom === 'addIns') {
			renderAddInsPane(doc, t, pane, deps.addinStatus, addinsState, renderPane);
		} else {
			renderGenericSections(tab);
			if (tab.custom === 'quickAccess') {
				renderQuickAccessPane(doc, t, pane, store, quickAccessState, renderPane);
			}
		}
	}

	const selectTab = (tabId: ViewerOptionsTabId): void => {
		activeTabId = tabId;
		aiActive = false;
		renderPane();
	};
	for (const tab of VIEWER_OPTIONS_TABS) {
		const button = appendDialogButton(doc, nav, t(tab.labelKey), () => selectTab(tab.id));
		button.dataset.tab = tab.id;
	}
	if (deps.aiEnabled) {
		aiNavButton = appendDialogButton(doc, nav, t('pptx.ai.settingsSectionTitle'), () => {
			aiActive = true;
			renderPane();
		});
		aiNavButton.dataset.tab = 'ai';
	}

	// Live re-render on any store commit (a control edit, reset, or an external
	// change); self-detaches once the dialog leaves the document.
	const unsubscribe = store.subscribe(() => {
		if (!shell.dialog.isConnected) {
			unsubscribe();
			return;
		}
		renderPane();
	});

	appendDialogButton(doc, shell.footer, t('pptx.options.resetAll'), () => {
		store.reset();
	});
	appendDialogButton(doc, shell.footer, t('pptx.common.cancel'), () => {
		store.setOptions(snapshot);
		shell.close();
		unsubscribe();
	});
	appendDialogButton(
		doc,
		shell.footer,
		t('pptx.common.ok'),
		() => {
			shell.close();
			unsubscribe();
		},
		true,
	);
	renderPane();
}
