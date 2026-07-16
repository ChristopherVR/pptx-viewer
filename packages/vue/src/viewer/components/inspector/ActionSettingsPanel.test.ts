import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ActionSettingsPanel from './ActionSettingsPanel.vue';

const element = {
	id: 'shape-1',
	type: 'shape' as const,
	x: 0,
	y: 0,
	width: 100,
	height: 100,
	actionClick: { url: 'https://example.com' },
};

describe('action settings panel', () => {
	it('edits URL actions through the core action mapping', async () => {
		const wrapper = mount(ActionSettingsPanel, {
			props: { element, slideCount: 5 },
		});
		const url = wrapper.find('input[type="url"]');
		await url.setValue('https://openai.com');
		expect(wrapper.emitted('update')?.at(-1)?.[0]).toMatchObject({
			actionClick: { url: 'https://openai.com' },
		});
	});

	it('writes a zero-based internal slide target', async () => {
		const wrapper = mount(ActionSettingsPanel, {
			props: { element, slideCount: 5 },
		});
		await wrapper.findAll('select')[1].setValue('slide');
		await wrapper.setProps({
			element: {
				...element,
				actionHover: { action: 'ppaction://hlinksldjump', targetSlideIndex: 0 },
			},
		});
		await wrapper.find('input[type="number"]').setValue(4);
		expect(wrapper.emitted('update')?.at(-1)?.[0]).toMatchObject({
			actionHover: { targetSlideIndex: 3 },
		});
	});
});
