import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import SlidesPaneControls from './SlidesPaneControls.vue';

function mountControls(canDelete = true) {
	return mount(SlidesPaneControls, { props: { canDelete } });
}

describe('slidesPaneControls', () => {
	it('renders three action buttons', () => {
		const wrapper = mountControls();
		expect(wrapper.findAll('button')).toHaveLength(3);
	});

	it('emits "add" when the add button is clicked', async () => {
		const wrapper = mountControls();
		await wrapper.get('[aria-label="Add slide"]').trigger('click');
		expect(wrapper.emitted('add')).toHaveLength(1);
	});

	it('emits "duplicate" when the duplicate button is clicked', async () => {
		const wrapper = mountControls();
		await wrapper.get('[aria-label="Duplicate slide"]').trigger('click');
		expect(wrapper.emitted('duplicate')).toHaveLength(1);
	});

	it('emits "delete" when delete is clicked and deletion is allowed', async () => {
		const wrapper = mountControls(true);
		await wrapper.get('[aria-label="Delete slide"]').trigger('click');
		expect(wrapper.emitted('delete')).toHaveLength(1);
	});

	it('disables the delete button and suppresses "delete" when canDelete is false', async () => {
		const wrapper = mountControls(false);
		const del = wrapper.get('[aria-label="Delete slide"]');
		expect((del.element as HTMLButtonElement).disabled).toBeTruthy();
		await del.trigger('click');
		expect(wrapper.emitted('delete')).toBeUndefined();
	});
});
