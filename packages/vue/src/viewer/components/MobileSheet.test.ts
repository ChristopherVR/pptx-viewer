import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import MobileSheet from './MobileSheet.vue';

function mountSheet(open = true) {
	return mount(MobileSheet, {
		props: { open, title: 'Format' },
		slots: { default: '<p class="body">content</p>' },
	});
}

describe('mobileSheet', () => {
	it('renders nothing when closed', () => {
		const wrapper = mountSheet(false);
		expect(wrapper.find('.pptx-vue-msheet').exists()).toBeFalsy();
	});

	it('renders the title and slotted body when open', () => {
		const wrapper = mountSheet(true);
		expect(wrapper.find('.pptx-vue-msheet').exists()).toBeTruthy();
		expect(wrapper.text()).toContain('Format');
		expect(wrapper.find('.body').exists()).toBeTruthy();
	});

	it('emits close when the backdrop is tapped', async () => {
		const wrapper = mountSheet(true);
		await wrapper.get('button[aria-label="Close"]').trigger('click');
		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('emits close when dragged past the dismiss threshold', async () => {
		const wrapper = mountSheet(true);
		const grab = wrapper.get('.cursor-grab');
		await grab.trigger('pointerdown', { clientY: 100, pointerId: 1 });
		await grab.trigger('pointermove', { clientY: 280, pointerId: 1 });
		await grab.trigger('pointerup', { clientY: 280, pointerId: 1 });
		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('snaps back (no close) for a short drag', async () => {
		const wrapper = mountSheet(true);
		const grab = wrapper.get('.cursor-grab');
		await grab.trigger('pointerdown', { clientY: 100, pointerId: 1 });
		await grab.trigger('pointermove', { clientY: 150, pointerId: 1 });
		await grab.trigger('pointerup', { clientY: 150, pointerId: 1 });
		expect(wrapper.emitted('close')).toBeUndefined();
	});
});
