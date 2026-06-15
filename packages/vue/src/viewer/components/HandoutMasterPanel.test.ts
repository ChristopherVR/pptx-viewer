import { mount } from '@vue/test-utils';
import type { PptxHandoutMaster } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import HandoutMasterPanel from './HandoutMasterPanel.vue';

function master(overrides: Partial<PptxHandoutMaster> = {}): PptxHandoutMaster {
	return { path: 'handout', ...overrides };
}

describe('handoutMasterPanel', () => {
	it('shows an empty message when there is no handout master', () => {
		const wrapper = mount(HandoutMasterPanel, {
			props: { handoutMaster: undefined, slidesPerPage: 6 },
		});
		expect(wrapper.find('[data-testid="handout-master-panel-empty"]').exists()).toBeTruthy();
	});

	it('marks the active slides-per-page option', () => {
		const wrapper = mount(HandoutMasterPanel, {
			props: { handoutMaster: master(), slidesPerPage: 4 },
		});
		expect(wrapper.get('[data-testid="slides-per-page-4"]').classes()).toContain(
			'pptx-vue-handout-master-panel__option--active',
		);
		expect(wrapper.get('[data-testid="slides-per-page-6"]').classes()).not.toContain(
			'pptx-vue-handout-master-panel__option--active',
		);
	});

	it('emits slides-per-page-change with the chosen count', async () => {
		const wrapper = mount(HandoutMasterPanel, {
			props: { handoutMaster: master(), slidesPerPage: 6 },
		});
		await wrapper.get('[data-testid="slides-per-page-9"]').trigger('click');
		const events = wrapper.emitted('slides-per-page-change');
		expect(events).toHaveLength(1);
		expect(events![0]).toStrictEqual([9]);
	});

	it('renders the background swatch and placeholders', () => {
		const wrapper = mount(HandoutMasterPanel, {
			props: {
				handoutMaster: master({
					backgroundColor: '#ff0000',
					placeholders: [{ type: 'hdr' }, { type: 'ftr' }],
				}),
				slidesPerPage: 6,
			},
		});
		expect(wrapper.find('[data-testid="handout-master-bg-swatch"]').exists()).toBeTruthy();
		expect(wrapper.findAll('[data-testid="handout-master-placeholder"]')).toHaveLength(2);
	});
});
