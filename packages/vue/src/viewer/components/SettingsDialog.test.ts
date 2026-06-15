import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import SettingsDialog from './SettingsDialog.vue';
import type { ViewerSettings } from './viewer-settings';
import { DEFAULT_VIEWER_SETTINGS } from './viewer-settings';

afterEach(() => {
	document.body.innerHTML = '';
});

function settings(overrides: Partial<ViewerSettings> = {}): ViewerSettings {
	return { ...DEFAULT_VIEWER_SETTINGS, ...overrides };
}

function switchByLabel(label: string): HTMLButtonElement {
	const btn = document.body.querySelector<HTMLButtonElement>(
		`button[role="switch"][aria-label="${label}"]`,
	);
	if (!btn) {
		throw new Error(`switch "${label}" not found`);
	}
	return btn;
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

describe('settingsDialog', () => {
	it('renders a switch per setting reflecting the current values', () => {
		mount(SettingsDialog, {
			props: { open: true, settings: settings({ showGrid: true }) },
			attachTo: document.body,
		});

		expect(switchByLabel('Show grid').getAttribute('aria-checked')).toBe('true');
		expect(switchByLabel('Snap to grid').getAttribute('aria-checked')).toBe('false');
	});

	it('emits update with the full toggled settings when a switch is flipped', async () => {
		const wrapper = mount(SettingsDialog, {
			props: { open: true, settings: settings() },
			attachTo: document.body,
		});

		switchByLabel('Show grid').click();
		await wrapper.vm.$nextTick();

		const updates = wrapper.emitted('update');
		expect(updates).toHaveLength(1);
		const payload = updates?.[0]?.[0] as ViewerSettings;
		expect(payload).toStrictEqual(settings({ showGrid: true }));
	});

	it('toggles off a setting that started enabled', async () => {
		const wrapper = mount(SettingsDialog, {
			props: { open: true, settings: settings({ autoSave: true }) },
			attachTo: document.body,
		});

		switchByLabel('Auto-save').click();
		await wrapper.vm.$nextTick();

		const payload = wrapper.emitted('update')?.[0]?.[0] as ViewerSettings;
		expect(payload.autoSave).toBeFalsy();
	});

	it('shows the keyboard shortcut reference on the Shortcuts tab', async () => {
		const wrapper = mount(SettingsDialog, {
			props: { open: true, settings: settings() },
			attachTo: document.body,
		});

		clickText('Keyboard shortcuts');
		await wrapper.vm.$nextTick();

		expect(document.body.textContent).toContain('Undo');
		expect(document.body.textContent).toContain('Ctrl/Cmd+Z');
	});

	it('emits close from the Done button', async () => {
		const wrapper = mount(SettingsDialog, {
			props: { open: true, settings: settings() },
			attachTo: document.body,
		});

		clickText('Done');
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('re-seeds the draft from settings each time it opens', async () => {
		const wrapper = mount(SettingsDialog, {
			props: { open: false, settings: settings({ showGrid: false }) },
			attachTo: document.body,
		});

		await wrapper.setProps({ open: true, settings: settings({ showGrid: true }) });
		await wrapper.vm.$nextTick();

		expect(switchByLabel('Show grid').getAttribute('aria-checked')).toBe('true');
	});
});
