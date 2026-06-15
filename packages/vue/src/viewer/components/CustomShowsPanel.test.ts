import { mount } from '@vue/test-utils';
import type { PptxCustomShow, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import CustomShowsPanel from './CustomShowsPanel.vue';

function makeSlide(id: string, rId: string, slideNumber: number): PptxSlide {
	return { id, rId, slideNumber, elements: [] };
}

const slides: PptxSlide[] = [
	makeSlide('s1', 'rId2', 1),
	makeSlide('s2', 'rId5', 2),
	makeSlide('s3', 'rId8', 3),
];

const shows: PptxCustomShow[] = [
	{ id: 'show1', name: 'Exec', slideRIds: ['rId5', 'rId2'] },
	{ id: 'show2', name: 'Demo', slideRIds: [] },
];

function mountPanel(activeShowId: string | null = 'show1') {
	return mount(CustomShowsPanel, {
		props: { customShows: shows, slides, activeShowId },
	});
}

describe('customShowsPanel', () => {
	it('lists every custom show as an option', () => {
		const wrapper = mountPanel();
		expect(wrapper.findAll('.pptx-vue-cs-select option')).toHaveLength(2);
	});

	it('emits create with the typed name and clears the field', async () => {
		const wrapper = mountPanel();
		const input = wrapper.find('.pptx-vue-cs-create-row .pptx-vue-cs-input');
		await input.setValue('New Show');
		await wrapper.find('.pptx-vue-cs-create-row').trigger('submit');
		expect(wrapper.emitted('create')).toStrictEqual([['New Show']]);
	});

	it('emits delete for the active show', async () => {
		const wrapper = mountPanel();
		await wrapper.find('.pptx-vue-cs-btn--danger').trigger('click');
		expect(wrapper.emitted('delete')).toStrictEqual([['show1']]);
	});

	it('emits select when a different show is chosen', async () => {
		const wrapper = mountPanel();
		await wrapper.find('.pptx-vue-cs-select').setValue('show2');
		expect(wrapper.emitted('select')).toStrictEqual([['show2']]);
	});

	it('renders the ordered show membership and emits move-slide', async () => {
		const wrapper = mountPanel();
		const items = wrapper.findAll('.pptx-vue-cs-order-item');
		expect(items).toHaveLength(2);
		// First item's down arrow → move (0 → 1).
		const downBtn = items[0]!.findAll('.pptx-vue-cs-mini')[1]!;
		await downBtn.trigger('click');
		expect(wrapper.emitted('move-slide')).toStrictEqual([['show1', 0, 1]]);
	});

	it('emits toggle-slide when a checklist item is toggled', async () => {
		const wrapper = mountPanel();
		const checkbox = wrapper.findAll('.pptx-vue-cs-all-item input[type="checkbox"]')[2]!;
		await checkbox.setValue(true);
		expect(wrapper.emitted('toggle-slide')).toStrictEqual([['show1', 'rId8']]);
	});

	it('emits rename after Rename + Save', async () => {
		const wrapper = mountPanel();
		await wrapper.findAll('.pptx-vue-cs-btn')[0]!.trigger('click');
		const input = wrapper.find('.pptx-vue-cs-rename-row .pptx-vue-cs-input');
		await input.setValue('Renamed');
		await wrapper.find('.pptx-vue-cs-rename-row .pptx-vue-cs-btn').trigger('click');
		expect(wrapper.emitted('rename')).toStrictEqual([['show1', 'Renamed']]);
	});
});
