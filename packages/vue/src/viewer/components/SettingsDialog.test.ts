import { mount } from '@vue/test-utils';
import { createViewerOptionsStore, THEME_CATALOG, VIEWER_OPTIONS_TABS } from 'pptx-viewer-shared';
import { LOCALE_CATALOG } from 'pptx-viewer-shared/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SettingsDialog from './SettingsDialog.vue';

beforeEach(() => localStorage.clear());
afterEach(() => {
	document.body.innerHTML = '';
});

function mountDialog() {
	const store = createViewerOptionsStore();
	const onRestoreOptions = vi.fn();
	const wrapper = mount(SettingsDialog, {
		props: {
			open: true,
			options: store.getOptions(),
			onOptionChange: (group, key, value) => store.setValue(group, key, value),
			onRestoreOptions,
			onRibbonTabHiddenChange: (tabId, hidden) => store.setRibbonTabHidden(tabId, hidden),
			onQuickAccessCommandsChange: (ids) => store.setQuickAccessCommands(ids),
			onResetOptions: (group) => store.reset(group),
			onClearCache: vi.fn(),
			themeKey: 'default',
			onThemeSelect: vi.fn(),
			localeCode: 'en',
			onLocaleSelect: vi.fn(),
			availableThemes: THEME_CATALOG,
			availableLocales: LOCALE_CATALOG,
		},
		attachTo: document.body,
	});
	return { wrapper, store, onRestoreOptions };
}

function clickText(label: string): void {
	const btn = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
		(b) => b.textContent?.trim() === label,
	);
	if (!btn) {
		throw new Error(`button "${label}" not found`);
	}
	btn.click();
}

describe('settingsDialog (File > Options)', () => {
	it('renders all ten PowerPoint categories in the rail', () => {
		mountDialog();
		const railLabels = Array.from(
			document.body.querySelectorAll<HTMLElement>('.pptx-vue-options-rail button'),
		).map((b) => b.textContent?.trim());
		expect(railLabels).toHaveLength(VIEWER_OPTIONS_TABS.length);
		expect(railLabels).toContain('Advanced');
		expect(railLabels).toContain('Trust Center');
	});

	it('writes a toggled option into the store', async () => {
		const { wrapper, store } = mountDialog();
		clickText('Advanced');
		await wrapper.vm.$nextTick();
		const grid = Array.from(document.body.querySelectorAll('label'))
			.find((label) => label.textContent?.includes('Show grid'))
			?.querySelector<HTMLInputElement>('input[type="checkbox"]');
		grid?.click();
		await wrapper.vm.$nextTick();
		expect(store.getOptions().advanced.showGrid).toBeTruthy();
	});

	it('shows the keyboard shortcut reference on the Customize Ribbon pane', async () => {
		const { wrapper } = mountDialog();
		clickText('Customize Ribbon');
		await wrapper.vm.$nextTick();
		expect(document.body.textContent).toContain('Ctrl/Cmd+Z');
	});

	it('restores the opening snapshot on Cancel', async () => {
		const { wrapper, onRestoreOptions } = mountDialog();
		clickText('Cancel');
		await wrapper.vm.$nextTick();
		expect(onRestoreOptions).toHaveBeenCalledOnce();
	});

	it('emits close from the OK button', async () => {
		const { wrapper } = mountDialog();
		clickText('OK');
		await wrapper.vm.$nextTick();
		expect(wrapper.emitted('close')).toHaveLength(1);
	});
});
