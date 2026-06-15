import { mount } from '@vue/test-utils';
import type { PptxHandoutMaster } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import HandoutMasterCanvas from './HandoutMasterCanvas.vue';

const canvasSize = { width: 800, height: 600 };

function master(overrides: Partial<PptxHandoutMaster> = {}): PptxHandoutMaster {
	return { path: 'handout', ...overrides };
}

describe('handoutMasterCanvas', () => {
	it('shows an empty message when there is no handout master', () => {
		const wrapper = mount(HandoutMasterCanvas, {
			props: { handoutMaster: undefined, canvasSize, slidesPerPage: 6 },
		});
		expect(wrapper.find('[data-testid="handout-master-empty"]').exists()).toBeTruthy();
	});

	it('renders the correct number of slots for slides-per-page', () => {
		const wrapper = mount(HandoutMasterCanvas, {
			props: { handoutMaster: master(), canvasSize, slidesPerPage: 6 },
		});
		expect(wrapper.findAll('[data-testid="handout-slot"]')).toHaveLength(6);
	});

	it('renders a single centred slot for slides-per-page 1', () => {
		const wrapper = mount(HandoutMasterCanvas, {
			props: { handoutMaster: master(), canvasSize, slidesPerPage: 1 },
		});
		expect(wrapper.findAll('[data-testid="handout-slot"]')).toHaveLength(1);
	});

	it('fills slots with supplied thumbnails', () => {
		const wrapper = mount(HandoutMasterCanvas, {
			props: {
				handoutMaster: master(),
				canvasSize,
				slidesPerPage: 2,
				slideThumbnails: ['data:image/png;base64,AAA'],
			},
		});
		const imgs = wrapper.findAll('.pptx-vue-handout-master-canvas__slot-img');
		expect(imgs).toHaveLength(1);
		expect(imgs[0].attributes('src')).toBe('data:image/png;base64,AAA');
	});

	it('shows the page number in the bottom-right corner when provided', () => {
		const wrapper = mount(HandoutMasterCanvas, {
			props: { handoutMaster: master(), canvasSize, slidesPerPage: 4, pageNumber: 3 },
		});
		expect(wrapper.find('.pptx-vue-handout-master-canvas__corner--br').text()).toBe('3');
	});
});
