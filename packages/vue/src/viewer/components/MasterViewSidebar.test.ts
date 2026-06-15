import { mount } from '@vue/test-utils';
import type { MasterViewTab, PptxHandoutMaster, PptxNotesMaster } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import MasterViewSidebar from './MasterViewSidebar.vue';

const canvasSize = { width: 960, height: 540 };

function baseProps(tab: MasterViewTab = 'slides') {
	const notesMaster: PptxNotesMaster = { path: 'notes', placeholders: [{ type: 'body' }] };
	const handoutMaster: PptxHandoutMaster = { path: 'handout' };
	return {
		slideMasters: [{ path: 'm1', name: 'Office', elements: [] }],
		activeMasterIndex: 0,
		activeLayoutIndex: null,
		canvasSize,
		mediaDataUrls: new Map<string, string>(),
		masterViewTab: tab,
		notesMaster,
		handoutMaster,
		handoutSlidesPerPage: 6,
	};
}

describe('masterViewSidebar', () => {
	it('renders the slide masters list on the slides tab', () => {
		const wrapper = mount(MasterViewSidebar, { props: baseProps('slides') });
		expect(wrapper.findComponent({ name: 'SlideMastersList' }).exists()).toBeTruthy();
		expect(wrapper.text()).toContain('Slide Masters');
	});

	it('renders the notes panel on the notes tab', () => {
		const wrapper = mount(MasterViewSidebar, { props: baseProps('notes') });
		expect(wrapper.findComponent({ name: 'NotesMasterPanel' }).exists()).toBeTruthy();
		expect(wrapper.text()).toContain('Notes Master');
	});

	it('renders the handout panel on the handout tab', () => {
		const wrapper = mount(MasterViewSidebar, { props: baseProps('handout') });
		expect(wrapper.findComponent({ name: 'HandoutMasterPanel' }).exists()).toBeTruthy();
		expect(wrapper.text()).toContain('Handout Master');
	});

	it('emits tab-change when a tab is clicked', async () => {
		const wrapper = mount(MasterViewSidebar, { props: baseProps('slides') });
		await wrapper.get('[data-testid="master-tab-notes"]').trigger('click');
		const events = wrapper.emitted('tab-change');
		expect(events).toHaveLength(1);
		expect(events![0]).toStrictEqual(['notes']);
	});

	it('emits collapse when the collapse button is clicked', async () => {
		const wrapper = mount(MasterViewSidebar, { props: baseProps('slides') });
		await wrapper.get('[data-testid="master-collapse"]').trigger('click');
		expect(wrapper.emitted('collapse')).toHaveLength(1);
	});

	it('forwards select-master from the list', async () => {
		const wrapper = mount(MasterViewSidebar, { props: baseProps('slides') });
		await wrapper.get('[data-testid="master-0"]').trigger('click');
		const events = wrapper.emitted('select-master');
		expect(events).toHaveLength(1);
		expect(events![0]).toStrictEqual([0]);
	});

	it('forwards handout-slides-per-page-change from the handout panel', async () => {
		const wrapper = mount(MasterViewSidebar, { props: baseProps('handout') });
		await wrapper.get('[data-testid="slides-per-page-9"]').trigger('click');
		const events = wrapper.emitted('handout-slides-per-page-change');
		expect(events).toHaveLength(1);
		expect(events![0]).toStrictEqual([9]);
	});
});
