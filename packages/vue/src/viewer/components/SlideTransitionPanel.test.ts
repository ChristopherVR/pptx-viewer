import { mount } from '@vue/test-utils';
import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import SlideTransitionPanel from './SlideTransitionPanel.vue';

function slide(transition?: PptxSlideTransition): PptxSlide {
	return {
		id: 'slide-1',
		rId: 'rId1',
		slideNumber: 1,
		elements: [],
		transition,
	} as PptxSlide;
}

describe('slideTransitionPanel', () => {
	it('prefills the controls from slide.transition', () => {
		const wrapper = mount(SlideTransitionPanel, {
			props: { slide: slide({ type: 'fade', durationMs: 700 }) },
		});

		const select = wrapper.get<HTMLSelectElement>('[data-testid="transition-type"]');
		expect(select.element.value).toBe('fade');

		const duration = wrapper.get<HTMLInputElement>('[data-testid="transition-duration"]');
		expect(duration.element.value).toBe('700');
		expect(duration.element.disabled).toBeFalsy();
	});

	it('defaults to "None" with a disabled duration when there is no transition', () => {
		const wrapper = mount(SlideTransitionPanel, { props: { slide: slide(undefined) } });

		const select = wrapper.get<HTMLSelectElement>('[data-testid="transition-type"]');
		expect(select.element.value).toBe('__none__');

		const duration = wrapper.get<HTMLInputElement>('[data-testid="transition-duration"]');
		expect(duration.element.disabled).toBeTruthy();
	});

	it('emits an update with the chosen type when the type changes', async () => {
		const wrapper = mount(SlideTransitionPanel, { props: { slide: slide(undefined) } });

		const select = wrapper.get<HTMLSelectElement>('[data-testid="transition-type"]');
		await select.setValue('push');

		const events = wrapper.emitted('update');
		expect(events).toHaveLength(1);
		const [transition] = events![0] as [PptxSlideTransition | undefined];
		expect(transition).toMatchObject({ type: 'push', durationMs: 1000 });
	});

	it('preserves the existing duration when switching effect type', async () => {
		const wrapper = mount(SlideTransitionPanel, {
			props: { slide: slide({ type: 'fade', durationMs: 700 }) },
		});

		const select = wrapper.get<HTMLSelectElement>('[data-testid="transition-type"]');
		await select.setValue('wipe');

		const events = wrapper.emitted('update');
		const [transition] = events![0] as [PptxSlideTransition | undefined];
		expect(transition).toMatchObject({ type: 'wipe', durationMs: 700 });
	});

	it('emits undefined when "None" is selected', async () => {
		const wrapper = mount(SlideTransitionPanel, {
			props: { slide: slide({ type: 'fade', durationMs: 700 }) },
		});

		const select = wrapper.get<HTMLSelectElement>('[data-testid="transition-type"]');
		await select.setValue('__none__');

		const events = wrapper.emitted('update');
		expect(events).toHaveLength(1);
		expect((events![0] as [PptxSlideTransition | undefined])[0]).toBeUndefined();
	});

	it('emits an updated duration when the duration input changes', async () => {
		const wrapper = mount(SlideTransitionPanel, {
			props: { slide: slide({ type: 'fade', durationMs: 700 }) },
		});

		const duration = wrapper.get<HTMLInputElement>('[data-testid="transition-duration"]');
		await duration.setValue('250');

		const events = wrapper.emitted('update');
		expect(events).toHaveLength(1);
		const [transition] = events![0] as [PptxSlideTransition | undefined];
		expect(transition).toMatchObject({ type: 'fade', durationMs: 250 });
	});
});
