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

/**
 * The effect select used to print the 45 raw `p:transition` element names
 * (`randomBar`, `wheelReverse`, `flythrough`) as if they were English. The
 * option VALUES are the wire tokens the panel emits, so they are asserted
 * unchanged alongside the new text: the fix may only change spelling, never
 * which effects the panel offers.
 */
describe('slideTransitionPanel - effect names', () => {
	function typeSelect() {
		const wrapper = mount(SlideTransitionPanel, { props: { slide: slide(undefined) } });
		return wrapper.get<HTMLSelectElement>('[data-testid="transition-type"]').findAll('option');
	}

	it('still offers the same 45 effects plus the None sentinel, by value', () => {
		const values = typeSelect().map((o) => (o.element as HTMLOptionElement).value);
		expect(values).toHaveLength(46);
		expect(values[0]).toBe('__none__');
		expect(values).toContain('randomBar');
		expect(values).toContain('wheelReverse');
		expect(values).toContain('flythrough');
		expect(values).toContain('orbit');
	});

	it('spells each effect instead of printing its wire token', () => {
		const byValue = new Map(
			typeSelect().map((o) => [(o.element as HTMLOptionElement).value, o.text()]),
		);
		expect(byValue.get('randomBar')).toBe('Random Bars');
		expect(byValue.get('wheelReverse')).toBe('Reverse Wheel');
		expect(byValue.get('flythrough')).toBe('Fly Through');
		expect(byValue.get('newsflash')).toBe('Newsflash');
		expect(byValue.get('fade')).toBe('Fade');
	});

	it('leaves no option showing a raw camelCase token', () => {
		for (const option of typeSelect()) {
			const value = (option.element as HTMLOptionElement).value;
			if (value !== '__none__') {
				expect(option.text()).not.toBe(value);
			}
		}
	});
});
