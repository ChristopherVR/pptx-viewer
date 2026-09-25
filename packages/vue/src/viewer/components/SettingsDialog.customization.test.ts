import { mount } from '@vue/test-utils';
import { createViewerOptionsStore, resolveCustomization, THEME_CATALOG } from 'pptx-viewer-shared';
import type { ViewerCustomization } from 'pptx-viewer-shared';
import { LOCALE_CATALOG } from 'pptx-viewer-shared/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';

import { ViewerCustomizationKey } from '../composables/useViewerCustomization';
import SettingsDialog from './SettingsDialog.vue';

afterEach(() => {
	document.body.innerHTML = '';
	localStorage.clear();
});

/** Mount File > Options under a host customisation (as `PowerPointViewer` provides it). */
function mountDialog(customization: ViewerCustomization, aiEnabled = false) {
	const resolved = resolveCustomization(customization);
	const store = createViewerOptionsStore({ persist: false });
	store.setConstraints({ locked: resolved.lockedSettings, defaults: resolved.defaultSettings });
	const onOptionChange = vi.fn();
	const wrapper = mount(SettingsDialog, {
		props: {
			open: true,
			options: store.getOptions(),
			onOptionChange,
			onRestoreOptions: vi.fn(),
			onRibbonTabHiddenChange: vi.fn(),
			onQuickAccessCommandsChange: vi.fn(),
			onResetOptions: vi.fn(),
			onClearCache: vi.fn(),
			themeKey: 'default',
			onThemeSelect: vi.fn(),
			localeCode: 'en',
			onLocaleSelect: vi.fn(),
			availableThemes: THEME_CATALOG,
			availableLocales: LOCALE_CATALOG,
			aiEnabled,
		},
		global: { provide: { [ViewerCustomizationKey as symbol]: shallowRef(resolved) } },
		attachTo: document.body,
	});
	return { wrapper, onOptionChange };
}

function railLabels(): string[] {
	return Array.from(
		document.body.querySelectorAll<HTMLElement>('.pptx-vue-options-rail button'),
	).map((button) => button.textContent?.trim() ?? '');
}

describe('settingsDialog under UI customization', () => {
	it('drops a hidden Options page from the rail', () => {
		mountDialog({ options: { hiddenPages: ['trust'] } });
		const labels = railLabels();
		expect(labels).toContain('General');
		expect(labels).not.toContain('Trust Center');
	});

	it('drops a hidden setting from its section', () => {
		mountDialog({ options: { hiddenSettings: ['general.userName'] } });
		expect(document.body.querySelector('input[aria-label="User name"]')).toBeNull();
	});

	it('renders a locked setting disabled with the forced value, and never emits a change', async () => {
		const { onOptionChange } = mountDialog({
			options: { locked: { 'general.userName': 'Kiosk User' } },
		});
		const input = document.body.querySelector<HTMLInputElement>('input[aria-label="User name"]');
		expect(input).not.toBeNull();
		expect(input?.disabled).toBeTruthy();
		expect(input?.value).toBe('Kiosk User');
		expect(input?.title).toBe('This setting is managed by your organization');
		input?.dispatchEvent(new Event('input'));
		expect(onOptionChange).not.toHaveBeenCalled();
	});

	it('hides the AI page when the host disables the ai feature', () => {
		mountDialog({}, true);
		expect(railLabels()).toContain('AI');
		document.body.innerHTML = '';
		mountDialog({ disabledFeatures: ['ai'] }, true);
		expect(railLabels()).not.toContain('AI');
	});
});
