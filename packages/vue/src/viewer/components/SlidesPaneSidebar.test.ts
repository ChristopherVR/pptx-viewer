import { mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import SlidesPaneSidebar from './SlidesPaneSidebar.vue';

/**
 * SlidesPaneSidebar (Vue port of React's slide rail) — number-left thumbnails,
 * active highlight, Add Slide button, drag-reorder, and the slide context menu.
 */
function slide(id: string): PptxSlide {
	return { id, elements: [] } as unknown as PptxSlide;
}

const base = {
	slides: [slide('a'), slide('b'), slide('c')],
	activeIndex: 1,
	canvasSize: { width: 960, height: 540 },
	mediaDataUrls: new Map<string, string>(),
	canEdit: true,
};

describe('slidesPaneSidebar', () => {
	it('renders one numbered row per slide', () => {
		const wrapper = mount(SlidesPaneSidebar, { props: base });
		const rows = wrapper.findAll('[aria-label^="Slide "]');
		expect(rows).toHaveLength(3);
		expect(rows[0].text()).toContain('1');
		expect(rows[2].text()).toContain('3');
	});

	it('marks the active slide with aria-current', () => {
		const wrapper = mount(SlidesPaneSidebar, { props: base });
		const rows = wrapper.findAll('[aria-label^="Slide "]');
		expect(rows[1].attributes('aria-current')).toBe('true');
		expect(rows[0].attributes('aria-current')).toBeUndefined();
	});

	it('emits select with the clicked index', async () => {
		const wrapper = mount(SlidesPaneSidebar, { props: base });
		await wrapper.findAll('[aria-label^="Slide "]')[2].trigger('click');
		expect(wrapper.emitted('select')?.[0]).toStrictEqual([2]);
	});

	it('emits add-slide from the bottom button', async () => {
		const wrapper = mount(SlidesPaneSidebar, { props: base });
		await wrapper.get('button').trigger('click');
		// The Add Slide button is the only <button> in the sidebar shell (rows are divs).
		expect(wrapper.emitted('add-slide')).toHaveLength(1);
	});

	it('emits reorder on drag + drop between rows', async () => {
		const wrapper = mount(SlidesPaneSidebar, { props: base });
		const rows = wrapper.findAll('[aria-label^="Slide "]');
		await rows[0].trigger('dragstart', { dataTransfer: {} });
		await rows[2].trigger('drop');
		expect(wrapper.emitted('reorder')?.[0]).toStrictEqual([{ from: 0, to: 2 }]);
	});

	it('hides the Add Slide button when not editable', () => {
		const wrapper = mount(SlidesPaneSidebar, { props: { ...base, canEdit: false } });
		expect(wrapper.find('button').exists()).toBeFalsy();
	});
});
