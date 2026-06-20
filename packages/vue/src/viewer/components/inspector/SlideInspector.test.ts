import { mount } from '@vue/test-utils';
import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import SlideInspector from './SlideInspector.vue';

/**
 * SlideInspector (Vue): slide-level inspector hosting the transition controls,
 * shown when no element is selected.
 */
function slide(transition?: PptxSlideTransition): PptxSlide {
	return { id: 's1', elements: [], transition } as unknown as PptxSlide;
}

describe('slideInspector', () => {
	it('renders the Slide Transition section', () => {
		const wrapper = mount(SlideInspector, { props: { slide: slide() } });
		expect(wrapper.text()).toContain('Slide Transition');
		expect(wrapper.find('[data-testid="transition-type"]').exists()).toBeTruthy();
	});

	it('relays the transition-panel update', async () => {
		const wrapper = mount(SlideInspector, { props: { slide: slide() } });
		const select = wrapper.get('[data-testid="transition-type"]');
		await select.setValue('fade');
		const first = wrapper.emitted('transition-update')?.[0]?.[0] as PptxSlideTransition | undefined;
		expect(first?.type).toBe('fade');
	});

	it('hides advance-on-click until a transition is set', () => {
		const noTransition = mount(SlideInspector, { props: { slide: slide() } });
		expect(noTransition.text()).not.toContain('Advance on click');
		const withTransition = mount(SlideInspector, {
			props: { slide: slide({ type: 'fade', durationMs: 500 }) },
		});
		expect(withTransition.text()).toContain('Advance on click');
	});

	it('emits advanceOnClick changes', async () => {
		const wrapper = mount(SlideInspector, {
			props: { slide: slide({ type: 'fade', durationMs: 500, advanceOnClick: true }) },
		});
		await wrapper.get('input[type="checkbox"]').setValue(false);
		const last = wrapper.emitted('transition-update')?.at(-1)?.[0] as
			| PptxSlideTransition
			| undefined;
		expect(last?.advanceOnClick).toBeFalsy();
		expect(last?.type).toBe('fade');
	});
});
