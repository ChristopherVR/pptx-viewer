import { mount } from '@vue/test-utils';
import { resolveCustomization } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';

import { ViewerCustomizationKey } from '../../composables/useViewerCustomization';
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
	it('reacts to host dialog availability and updated command callbacks', async () => {
		const old = vi.fn();
		const next = vi.fn();
		const shortcuts = vi.fn();
		const accessibility = vi.fn();
		const customization = shallowRef(resolveCustomization({ hiddenDialogs: ['options'] }));
		const wrapper = mount(HelpSection, {
			props: {
				onOpenSettings: old,
				onToggleShortcuts: shortcuts,
				onRunAccessibilityCheck: accessibility,
			},
			global: { provide: { [ViewerCustomizationKey as symbol]: customization } },
		});
		expect(wrapper.find('[data-ribbon-control="help.help.options"]').exists()).toBeFalsy();
		customization.value = resolveCustomization({});
		await wrapper.setProps({ onOpenSettings: next });
		for (const command of wrapper.findAll('pptx-ui-ribbon-command')) {
			(command.element as HTMLElement).shadowRoot!.querySelector('button')!.click();
		}
		expect(old).not.toHaveBeenCalled();
		expect(next).toHaveBeenCalledOnce();
		expect(shortcuts).toHaveBeenCalledOnce();
		expect(accessibility).toHaveBeenCalledOnce();
		wrapper.unmount();
	});

	it('offers Settings alongside Keyboard Shortcuts and Accessibility Check', () => {
		const wrapper = mount(HelpSection, {
			props: { onToggleShortcuts: () => {}, onRunAccessibilityCheck: () => {} },
		});
		const labels = wrapper.findAll('pptx-ui-ribbon-command').map((b) => b.attributes('label'));
		expect(labels).toStrictEqual(['Settings', 'Keyboard Shortcuts', 'Accessibility Check']);
	});

	it('opens the options dialog when the host wires it', async () => {
		const onOpenSettings = vi.fn();
		const onToggleShortcuts = vi.fn();
		const wrapper = mount(HelpSection, {
			props: { onOpenSettings, onToggleShortcuts, onRunAccessibilityCheck: () => {} },
		});
		(wrapper.findAll('pptx-ui-ribbon-command')[0].element as HTMLElement)
			.shadowRoot!.querySelector('button')!
			.click();
		expect(onOpenSettings).toHaveBeenCalledOnce();
		expect(onToggleShortcuts).not.toHaveBeenCalled();
	});

	it('falls back to the shortcuts sheet when the host wires no options dialog', async () => {
		const onToggleShortcuts = vi.fn();
		const wrapper = mount(HelpSection, {
			props: { onToggleShortcuts, onRunAccessibilityCheck: () => {} },
		});
		(wrapper.findAll('pptx-ui-ribbon-command')[0].element as HTMLElement)
			.shadowRoot!.querySelector('button')!
			.click();
		expect(onToggleShortcuts).toHaveBeenCalledOnce();
	});
});
