import { mount } from '@vue/test-utils';
import type { PptxAiChatStore } from 'pptx-viewer-shared/ai';
import { describe, expect, it } from 'vitest';

import SettingsAiTab from './SettingsAiTab.vue';

describe('settingsAiTab', () => {
	it('uses the shared labeled checkbox and updates its checked state', async () => {
		const store = {
			listChats: async () => [],
		} as unknown as PptxAiChatStore;
		const wrapper = mount(SettingsAiTab, { props: { store } });
		const checkbox = wrapper.find<HTMLElement>('pptx-ui-checkbox');

		expect(checkbox.exists()).toBeTruthy();
		expect(checkbox.attributes('role')).toBe('checkbox');
		expect(checkbox.attributes('aria-label')).toBe('Include tool call inputs and outputs');
		expect(wrapper.find('input[type="checkbox"]').exists()).toBeFalsy();
		await checkbox.trigger('click');
		await wrapper.vm.$nextTick();
		expect(checkbox.attributes('checked')).toBeUndefined();
	});
});
