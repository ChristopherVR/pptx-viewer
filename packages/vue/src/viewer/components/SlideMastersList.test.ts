import { mount } from '@vue/test-utils';
import type { PptxSlideMaster } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import SlideMastersList from './SlideMastersList.vue';

const canvasSize = { width: 960, height: 540 };

function master(overrides: Partial<PptxSlideMaster> = {}): PptxSlideMaster {
	return {
		path: 'ppt/slideMasters/slideMaster1.xml',
		name: 'Office Theme',
		elements: [],
		...overrides,
	};
}

function baseProps(slideMasters: PptxSlideMaster[]) {
	return {
		slideMasters,
		activeMasterIndex: 0,
		activeLayoutIndex: null,
		canvasSize,
		mediaDataUrls: new Map<string, string>(),
	};
}

describe('slideMastersList', () => {
	it('renders one tile per master and shows its name', () => {
		const wrapper = mount(SlideMastersList, {
			props: baseProps([master({ name: 'Theme A' }), master({ name: 'Theme B', path: 'm2' })]),
		});
		expect(wrapper.findAll('[data-testid^="master-"]')).toHaveLength(2);
		expect(wrapper.text()).toContain('Theme A');
		expect(wrapper.text()).toContain('Theme B');
	});

	it('renders nested layouts under their master', () => {
		const wrapper = mount(SlideMastersList, {
			props: baseProps([
				master({
					layouts: [
						{ path: 'l1', name: 'Title', elements: [] },
						{ path: 'l2', name: 'Content', elements: [] },
					],
				}),
			]),
		});
		expect(wrapper.findAll('[data-testid^="layout-"]')).toHaveLength(2);
		expect(wrapper.text()).toContain('Title');
		expect(wrapper.text()).toContain('Content');
	});

	it('marks the active master', () => {
		const wrapper = mount(SlideMastersList, {
			props: { ...baseProps([master(), master({ path: 'm2' })]), activeMasterIndex: 1 },
		});
		const tiles = wrapper.findAll('[data-testid^="master-"]');
		expect(tiles[1].classes()).toContain('pptx-vue-masters-list__master--active');
		expect(tiles[0].classes()).not.toContain('pptx-vue-masters-list__master--active');
	});

	it('emits select-master with the master index', async () => {
		const wrapper = mount(SlideMastersList, {
			props: baseProps([master(), master({ path: 'm2' })]),
		});
		await wrapper.get('[data-testid="master-1"]').trigger('click');
		const events = wrapper.emitted('select-master');
		expect(events).toHaveLength(1);
		expect(events![0]).toStrictEqual([1]);
	});

	it('emits select-layout with master and layout indices', async () => {
		const wrapper = mount(SlideMastersList, {
			props: baseProps([master({ layouts: [{ path: 'l1', name: 'Title', elements: [] }] })]),
		});
		await wrapper.get('[data-testid="layout-0-0"]').trigger('click');
		const events = wrapper.emitted('select-layout');
		expect(events).toHaveLength(1);
		expect(events![0]).toStrictEqual([0, 0]);
	});

	it('shows the empty message when there are no masters', () => {
		const wrapper = mount(SlideMastersList, { props: baseProps([]) });
		expect(wrapper.text()).toContain('No slide masters');
	});
});
