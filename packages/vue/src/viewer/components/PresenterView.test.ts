import { mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { CanvasSize } from '../types';
import PresenterView from './PresenterView.vue';

const canvasSize: CanvasSize = { width: 960, height: 540 };

function makeSlide(id: string, overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id,
		elements: [],
		backgroundColor: '#ffffff',
		...overrides,
	} as unknown as PptxSlide;
}

function mountView(props: Partial<Record<string, unknown>> = {}) {
	return mount(PresenterView, {
		props: {
			slides: [makeSlide('s1', { notes: 'Speaker notes here' }), makeSlide('s2')],
			currentSlideIndex: 0,
			canvasSize,
			mediaDataUrls: new Map<string, string>(),
			presentationStartTime: null,
			...props,
		},
	});
}

describe('presenterView', () => {
	it('renders the current slide, counter, and next-slide preview', () => {
		const wrapper = mountView();
		expect(wrapper.find('.pptx-vue-presenter-counter').text()).toBe('1 / 2');
		expect(wrapper.find('.pptx-vue-presenter-slide-label').text()).toContain('Slide 1 of 2');
		// Two stages: current + next preview.
		expect(wrapper.findAll('.pptx-vue-stage')).toHaveLength(2);
	});

	it('shows plain speaker notes', () => {
		const wrapper = mountView();
		expect(wrapper.find('.pptx-vue-presenter-notes').text()).toContain('Speaker notes here');
	});

	it('shows the no-notes placeholder when a slide has none', () => {
		const wrapper = mountView({ currentSlideIndex: 1 });
		expect(wrapper.find('.pptx-vue-presenter-notes-empty').exists()).toBeTruthy();
	});

	it('shows the end-of-presentation marker on the last slide', () => {
		const wrapper = mountView({ currentSlideIndex: 1 });
		expect(wrapper.find('.pptx-vue-presenter-preview-empty').text()).toContain(
			'End of presentation',
		);
	});

	it('emits move and exit intents', async () => {
		const wrapper = mountView({ currentSlideIndex: 0 });
		const buttons = wrapper.findAll('.pptx-vue-presenter-nav-btn');
		// Prev is disabled on the first slide; Next emits +1.
		await buttons[1]?.trigger('click');
		expect(wrapper.emitted('move')?.[0]).toStrictEqual([1]);

		await wrapper.find('.pptx-vue-presenter-icon-btn').trigger('click');
		expect(wrapper.emitted('exit')).toHaveLength(1);
	});

	it('disables prev on the first slide and next on the last', () => {
		const first = mountView({ currentSlideIndex: 0 });
		const firstBtns = first.findAll('.pptx-vue-presenter-nav-btn');
		expect(firstBtns[0]?.attributes('disabled')).toBeDefined();

		const last = mountView({ currentSlideIndex: 1 });
		const lastBtns = last.findAll('.pptx-vue-presenter-nav-btn');
		expect(lastBtns[1]?.attributes('disabled')).toBeDefined();
	});

	it('adjusts the notes font size within bounds', async () => {
		const wrapper = mountView();
		const [decrease, increase] = wrapper.findAll('.pptx-vue-presenter-font-btn');
		await increase?.trigger('click');
		expect(wrapper.find('.pptx-vue-presenter-font-val').text()).toBe('16px');
		await decrease?.trigger('click');
		expect(wrapper.find('.pptx-vue-presenter-font-val').text()).toBe('14px');
	});

	it('renders the empty state when there is no current slide', () => {
		const wrapper = mount(PresenterView, {
			props: {
				slides: [],
				currentSlideIndex: 0,
				canvasSize,
				mediaDataUrls: new Map<string, string>(),
				presentationStartTime: null,
			},
		});
		expect(wrapper.find('.pptx-vue-presenter--empty').exists()).toBeTruthy();
	});

	it('shows the elapsed time when a start time is provided', () => {
		const wrapper = mountView({ presentationStartTime: Date.now() - 65000 });
		// ~01:05 elapsed (allow for clock drift on slow CI).
		expect(wrapper.find('.pptx-vue-presenter-elapsed').text()).toMatch(/^0[01]:\d{2}$/u);
	});
});
