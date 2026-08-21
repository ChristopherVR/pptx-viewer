import { mount } from '@vue/test-utils';
import type { PptxSlideTransition } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import TransitionPreview from './TransitionPreview.vue';

function transition(overrides: Partial<PptxSlideTransition> = {}): PptxSlideTransition {
	return { type: 'fade', durationMs: 500, ...overrides } as PptxSlideTransition;
}

describe('transitionPreview', () => {
	it('renders the play stage for a real transition', () => {
		const wrapper = mount(TransitionPreview, { props: { transition: transition() } });
		expect(wrapper.find('button').exists()).toBeTruthy();
	});

	it('renders nothing for "none" or "cut"', () => {
		const none = mount(TransitionPreview, {
			props: { transition: transition({ type: 'none' } as Partial<PptxSlideTransition>) },
		});
		expect(none.find('button').exists()).toBeFalsy();

		const cut = mount(TransitionPreview, {
			props: { transition: transition({ type: 'cut' } as Partial<PptxSlideTransition>) },
		});
		expect(cut.find('button').exists()).toBeFalsy();
	});

	it('starts the incoming/outgoing animation on click and clears it after the duration', async () => {
		vi.useFakeTimers();
		const wrapper = mount(TransitionPreview, {
			props: { transition: transition({ durationMs: 300 }) },
		});
		await wrapper.get('button').trigger('click');

		const layers = wrapper.findAll('.pptx-vue-transition-layer');
		expect(layers.some((l) => (l.attributes('style') ?? '').includes('animation'))).toBeTruthy();

		vi.advanceTimersByTime(500);
		await wrapper.vm.$nextTick();
		vi.useRealTimers();
	});
});
