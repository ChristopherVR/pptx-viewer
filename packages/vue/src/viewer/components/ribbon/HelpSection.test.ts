import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import HelpSection from './HelpSection.vue';

/**
 * HelpSection: the Help ribbon tab.
 *
 * Settings was offered by angular, vanilla and svelte but by neither react nor
 * vue, which is the exact shape of divergence `ribbon-control-inventory` was
 * written to catch: the Options dialog existed in all five, only the way in did
 * not.
 */
describe('helpSection', () => {
	it('offers Settings alongside Keyboard Shortcuts and Accessibility Check', () => {
		const wrapper = mount(HelpSection, {
			props: { onToggleShortcuts: () => {}, onRunAccessibilityCheck: () => {} },
		});
		const labels = wrapper.findAll('button').map((b) => b.text());
		expect(labels).toStrictEqual(['Settings', 'Keyboard Shortcuts', 'Accessibility Check']);
	});

	it('opens the options dialog when the host wires it', async () => {
		const onOpenSettings = vi.fn();
		const onToggleShortcuts = vi.fn();
		const wrapper = mount(HelpSection, {
			props: { onOpenSettings, onToggleShortcuts, onRunAccessibilityCheck: () => {} },
		});
		await wrapper.findAll('button')[0].trigger('click');
		expect(onOpenSettings).toHaveBeenCalledOnce();
		expect(onToggleShortcuts).not.toHaveBeenCalled();
	});

	it('falls back to the shortcuts sheet when the host wires no options dialog', async () => {
		const onToggleShortcuts = vi.fn();
		const wrapper = mount(HelpSection, {
			props: { onToggleShortcuts, onRunAccessibilityCheck: () => {} },
		});
		await wrapper.findAll('button')[0].trigger('click');
		expect(onToggleShortcuts).toHaveBeenCalledOnce();
	});
});
