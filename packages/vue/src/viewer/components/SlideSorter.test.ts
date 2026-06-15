import { mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { CanvasSize } from '../types';
import SlideSorter from './SlideSorter.vue';

const canvasSize: CanvasSize = { width: 960, height: 540 };

function makeSlides(count: number): PptxSlide[] {
	return Array.from(
		{ length: count },
		(_, i): PptxSlide =>
			({
				id: `slide-${i}`,
				elements: [],
			}) as unknown as PptxSlide,
	);
}

function mountSorter(slides: PptxSlide[], activeIndex = 0) {
	return mount(SlideSorter, {
		props: {
			slides,
			canvasSize,
			mediaDataUrls: new Map<string, string>(),
			activeIndex,
		},
	});
}

describe('slideSorter', () => {
	it('renders one tile per slide', () => {
		const wrapper = mountSorter(makeSlides(4));
		expect(wrapper.findAll('.pptx-vue-sorter-tile')).toHaveLength(4);
	});

	it('marks the active tile with the active class', () => {
		const wrapper = mountSorter(makeSlides(3), 2);
		const tiles = wrapper.findAll('.pptx-vue-sorter-tile');
		expect(tiles[2]!.classes()).toContain('is-active');
		expect(tiles[0]!.classes()).not.toContain('is-active');
	});

	it('emits select with the clicked tile index', async () => {
		const wrapper = mountSorter(makeSlides(3));
		await wrapper.findAll('.pptx-vue-sorter-tile')[1]!.trigger('click');
		expect(wrapper.emitted('select')).toStrictEqual([[1]]);
	});

	it('emits reorder with from and to on a simulated drop', async () => {
		const wrapper = mountSorter(makeSlides(4));
		const tiles = wrapper.findAll('.pptx-vue-sorter-tile');
		const dataTransfer = {
			effectAllowed: '',
			dropEffect: '',
			setData: (): void => undefined,
			getData: (): string => '',
		};

		await tiles[0]!.trigger('dragstart', { dataTransfer });
		await tiles[2]!.trigger('dragover', { dataTransfer });
		await tiles[2]!.trigger('drop', { dataTransfer });

		expect(wrapper.emitted('reorder')).toStrictEqual([[0, 2]]);
	});

	it('does not emit reorder when dropped on the source tile', async () => {
		const wrapper = mountSorter(makeSlides(3));
		const tiles = wrapper.findAll('.pptx-vue-sorter-tile');
		const dataTransfer = {
			effectAllowed: '',
			dropEffect: '',
			setData: (): void => undefined,
			getData: (): string => '',
		};

		await tiles[1]!.trigger('dragstart', { dataTransfer });
		await tiles[1]!.trigger('drop', { dataTransfer });

		expect(wrapper.emitted('reorder')).toBeUndefined();
	});

	it('emits close when the close button is clicked', async () => {
		const wrapper = mountSorter(makeSlides(2));
		await wrapper.find('.pptx-vue-sorter-close').trigger('click');
		expect(wrapper.emitted('close')).toStrictEqual([[]]);
	});
});
