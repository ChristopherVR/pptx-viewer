import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import FindReplaceBar from './FindReplaceBar.vue';

function mountBar(props: Partial<{ matchCount: number; currentIndex: number }> = {}) {
	return mount(FindReplaceBar, {
		props: { matchCount: 3, currentIndex: 0, ...props },
	});
}

describe('findReplaceBar', () => {
	it('renders the n / total counter', () => {
		const wrapper = mountBar({ matchCount: 5, currentIndex: 2 });
		expect(wrapper.find('.pptx-vue-fr-counter').text()).toBe('3 / 5');
	});

	it('shows 0 / 0 when there are no matches', () => {
		const wrapper = mountBar({ matchCount: 0, currentIndex: 0 });
		expect(wrapper.find('.pptx-vue-fr-counter').text()).toBe('0 / 0');
	});

	it('updates the query model when typing', async () => {
		const wrapper = mountBar();
		const input = wrapper.find('input[aria-label="Find"]');
		await input.setValue('hello');
		expect(wrapper.emitted('update:query')?.at(-1)).toStrictEqual(['hello']);
	});

	it('updates the replacement model when typing', async () => {
		const wrapper = mountBar();
		const input = wrapper.find('input[aria-label="Replace"]');
		await input.setValue('world');
		expect(wrapper.emitted('update:replacement')?.at(-1)).toStrictEqual(['world']);
	});

	it('toggles match case', async () => {
		const wrapper = mountBar();
		await wrapper.find('.pptx-vue-fr-case input[type="checkbox"]').setValue(true);
		expect(wrapper.emitted('update:matchCase')?.at(-1)).toStrictEqual([true]);
	});

	it('emits next and prev on the nav buttons', async () => {
		const wrapper = mountBar();
		await wrapper.find('button[aria-label="Next match"]').trigger('click');
		await wrapper.find('button[aria-label="Previous match"]').trigger('click');
		expect(wrapper.emitted('next')).toHaveLength(1);
		expect(wrapper.emitted('prev')).toHaveLength(1);
	});

	it('emits replace and replace-all', async () => {
		const wrapper = mountBar();
		const buttons = wrapper.findAll('.pptx-vue-fr-text');
		await buttons[0].trigger('click');
		await buttons[1].trigger('click');
		expect(wrapper.emitted('replace')).toHaveLength(1);
		expect(wrapper.emitted('replace-all')).toHaveLength(1);
	});

	it('emits close on the close button', async () => {
		const wrapper = mountBar();
		await wrapper.find('button[aria-label="Close find and replace"]').trigger('click');
		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('disables nav and replace actions when there are no matches', () => {
		const wrapper = mountBar({ matchCount: 0, currentIndex: 0 });
		expect(wrapper.find('button[aria-label="Next match"]').attributes('disabled')).toBeDefined();
		expect(wrapper.findAll('.pptx-vue-fr-text')[0].attributes('disabled')).toBeDefined();
	});
});
