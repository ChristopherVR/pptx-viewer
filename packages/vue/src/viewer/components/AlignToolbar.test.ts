import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import AlignToolbar from './AlignToolbar.vue';

function mountToolbar(props: { canGroup?: boolean; canUngroup?: boolean } = {}) {
	return mount(AlignToolbar, {
		props: { canGroup: props.canGroup ?? true, canUngroup: props.canUngroup ?? true },
	});
}

describe('alignToolbar', () => {
	it('emits align with the matching edge for each align button', async () => {
		const wrapper = mountToolbar();
		const edges = ['left', 'centerH', 'right', 'top', 'middle', 'bottom'];
		// First six buttons are the align buttons, in order.
		const buttons = wrapper.findAll('button');
		for (let i = 0; i < edges.length; i++) {
			await buttons[i]!.trigger('click');
		}
		const emitted = wrapper.emitted('align');
		expect(emitted).toBeTruthy();
		expect(emitted!.map((args) => args[0])).toStrictEqual(edges);
	});

	it('emits distribute horizontal and vertical', async () => {
		const wrapper = mountToolbar();
		await wrapper.find('[aria-label="Distribute horizontally"]').trigger('click');
		await wrapper.find('[aria-label="Distribute vertically"]').trigger('click');
		const emitted = wrapper.emitted('distribute');
		expect(emitted).toBeTruthy();
		expect(emitted!.map((args) => args[0])).toStrictEqual(['horizontal', 'vertical']);
	});

	it('emits group when the group button is clicked', async () => {
		const wrapper = mountToolbar({ canGroup: true });
		await wrapper.find('[aria-label="Group"]').trigger('click');
		expect(wrapper.emitted('group')).toHaveLength(1);
	});

	it('emits ungroup when the ungroup button is clicked', async () => {
		const wrapper = mountToolbar({ canUngroup: true });
		await wrapper.find('[aria-label="Ungroup"]').trigger('click');
		expect(wrapper.emitted('ungroup')).toHaveLength(1);
	});

	it('disables Group when canGroup is false and never emits', async () => {
		const wrapper = mountToolbar({ canGroup: false });
		const groupBtn = wrapper.find('[aria-label="Group"]');
		expect(groupBtn.attributes('disabled')).toBeDefined();
		await groupBtn.trigger('click');
		expect(wrapper.emitted('group')).toBeUndefined();
	});

	it('disables Ungroup when canUngroup is false', () => {
		const wrapper = mountToolbar({ canUngroup: false });
		expect(wrapper.find('[aria-label="Ungroup"]').attributes('disabled')).toBeDefined();
	});

	it('exposes a labelled toolbar role', () => {
		const wrapper = mountToolbar();
		expect(wrapper.attributes('role')).toBe('toolbar');
		expect(wrapper.attributes('aria-label')).toBe('Align and distribute');
	});
});
