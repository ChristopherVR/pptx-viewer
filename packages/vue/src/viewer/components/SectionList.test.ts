import { mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { SectionGroup } from '../composables/useSectionOperations';
import type { CanvasSize } from '../types';
import SectionList from './SectionList.vue';

const canvasSize: CanvasSize = { width: 960, height: 540 };

function makeSlide(id: string, slideNumber: number): PptxSlide {
	return { id, rId: '', slideNumber, elements: [] };
}

function mountList(groups: SectionGroup[], activeIndex = 0, canEdit = true) {
	return mount(SectionList, {
		props: {
			groups,
			canvasSize,
			mediaDataUrls: new Map<string, string>(),
			activeIndex,
			canEdit,
		},
	});
}

function sampleGroups(): SectionGroup[] {
	return [
		{
			section: { id: 'sec1', name: 'Intro', slideIds: ['1'] },
			slides: [makeSlide('s1', 1)],
			slideIndexes: [0],
		},
		{
			section: { id: 'sec2', name: 'Body', slideIds: ['2'], collapsed: true },
			slides: [makeSlide('s2', 2)],
			slideIndexes: [1],
		},
	];
}

describe('sectionList', () => {
	it('renders one header per section group', () => {
		const wrapper = mountList(sampleGroups());
		expect(wrapper.findAll('.pptx-vue-section-header')).toHaveLength(2);
	});

	it('hides the slide list for a collapsed section', () => {
		const wrapper = mountList(sampleGroups());
		const lists = wrapper.findAll('.pptx-vue-section-slides');
		// v-show keeps the element but hides it via display:none.
		expect(lists[1]!.attributes('style')).toContain('display: none');
		expect(lists[0]!.attributes('style') ?? '').not.toContain('display: none');
	});

	it('emits select with the deck index when a thumbnail is clicked', async () => {
		const wrapper = mountList(sampleGroups());
		await wrapper.findAll('.pptx-vue-section-thumb')[0]!.trigger('click');
		expect(wrapper.emitted('select')).toStrictEqual([[0]]);
	});

	it('emits toggle-collapse when a header is clicked', async () => {
		const wrapper = mountList(sampleGroups());
		await wrapper.findAll('.pptx-vue-section-toggle')[0]!.trigger('click');
		expect(wrapper.emitted('toggle-collapse')).toStrictEqual([['sec1']]);
	});

	/** The section menu teleports to the body; read it from there. */
	const menuItems = (): HTMLButtonElement[] =>
		Array.from(
			document.body.querySelectorAll<HTMLButtonElement>('[role="menu"] [role="menuitem"]'),
		);
	const itemNamed = (label: string): HTMLButtonElement =>
		menuItems().find((candidate) => candidate.textContent?.trim() === label)!;

	it('opens the shared five-command menu on right-click and has no inline buttons', async () => {
		const wrapper = mountList(sampleGroups());
		const header = wrapper.findAll('.pptx-vue-section-header')[0]!;
		expect(header.findAll('button')).toHaveLength(1);
		await wrapper.findAll('.pptx-vue-section-toggle')[0]!.trigger('contextmenu');
		expect(menuItems().map((candidate) => candidate.textContent?.trim())).toStrictEqual([
			'Rename',
			'Delete',
			'Move Up',
			'Move Down',
			'Add Section After',
		]);
		expect(itemNamed('Move Up').disabled).toBeTruthy();
		expect(itemNamed('Move Down').disabled).toBeFalsy();
		wrapper.unmount();
	});

	it('emits move-down, delete-section and add-section from the menu', async () => {
		const wrapper = mountList(sampleGroups());
		const toggles = wrapper.findAll('.pptx-vue-section-toggle');
		await toggles[0]!.trigger('contextmenu');
		itemNamed('Move Down').click();
		await toggles[0]!.trigger('contextmenu');
		itemNamed('Delete').click();
		await toggles[0]!.trigger('contextmenu');
		itemNamed('Add Section After').click();
		expect(wrapper.emitted('move-down')).toStrictEqual([['sec1']]);
		expect(wrapper.emitted('delete-section')).toStrictEqual([['sec1']]);
		// The new section starts at the slide after the section's last one.
		expect(wrapper.emitted('add-section')).toStrictEqual([[1]]);
		wrapper.unmount();
	});

	it('starts an inline rename from the menu', async () => {
		const wrapper = mountList(sampleGroups());
		await wrapper.findAll('.pptx-vue-section-toggle')[0]!.trigger('contextmenu');
		itemNamed('Rename').click();
		await wrapper.vm.$nextTick();
		expect(wrapper.find('.pptx-vue-section-rename').exists()).toBeTruthy();
		wrapper.unmount();
	});

	it('emits rename after a double-click + Enter', async () => {
		const wrapper = mountList(sampleGroups());
		await wrapper.findAll('.pptx-vue-section-toggle')[0]!.trigger('dblclick');
		const input = wrapper.find('.pptx-vue-section-rename');
		await input.setValue('Renamed');
		await input.trigger('keydown', { key: 'Enter' });
		expect(wrapper.emitted('rename')).toStrictEqual([['sec1', 'Renamed']]);
	});

	it('opens no menu when canEdit is false', async () => {
		const wrapper = mountList(sampleGroups(), 0, false);
		await wrapper.findAll('.pptx-vue-section-toggle')[0]!.trigger('contextmenu');
		expect(menuItems()).toHaveLength(0);
		wrapper.unmount();
	});

	/**
	 * `p15:sectionPr/@clr` is parsed and round-tripped by core and painted by
	 * React's sorter, and the Vue rail showed nothing at all, so a colour-coded
	 * deck lost its coding here.
	 */
	it('paints a swatch for a section that carries a colour', () => {
		const groups = sampleGroups();
		groups[0]!.section = { ...groups[0]!.section!, color: '#ff0000' };
		const wrapper = mountList(groups);
		const swatches = wrapper.findAll('[data-pptx-section-color]');
		expect(swatches).toHaveLength(1);
		expect(swatches[0]!.attributes('style')).toContain('#ff0000');
	});

	it('paints no swatch for a section with no colour', () => {
		const wrapper = mountList(sampleGroups());
		expect(wrapper.findAll('[data-pptx-section-color]')).toHaveLength(0);
	});
});
