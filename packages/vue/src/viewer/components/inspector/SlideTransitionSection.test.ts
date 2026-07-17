import { mount } from '@vue/test-utils';
import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import SlideTransitionSection from './SlideTransitionSection.vue';

/**
 * SlideTransitionSection (Vue): slide-transition editing extracted from the old
 * untabbed SlideInspector (mirrors React's unmounted
 * `inspector/SlideTransitionSection.tsx`).
 */
function slide(transition?: PptxSlideTransition): PptxSlide {
	return { id: 's1', elements: [], transition } as unknown as PptxSlide;
}

describe('slideTransitionSection', () => {
	it('renders the Slide Transition controls', () => {
		const wrapper = mount(SlideTransitionSection, { props: { slide: slide() } });
		expect(wrapper.text()).toContain('Slide transition');
		expect(wrapper.find('[data-testid="transition-type"]').exists()).toBeTruthy();
	});

	it('relays the transition-panel update', async () => {
		const wrapper = mount(SlideTransitionSection, { props: { slide: slide() } });
		const select = wrapper.get('[data-testid="transition-type"]');
		await select.setValue('fade');
		const first = wrapper.emitted('transition-update')?.[0]?.[0] as PptxSlideTransition | undefined;
		expect(first?.type).toBe('fade');
	});

	it('hides advance-on-click until a transition is set', () => {
		const noTransition = mount(SlideTransitionSection, { props: { slide: slide() } });
		expect(noTransition.text()).not.toContain('Advance on click');
		const withTransition = mount(SlideTransitionSection, {
			props: { slide: slide({ type: 'fade', durationMs: 500 }) },
		});
		expect(withTransition.text()).toContain('Advance on click');
	});

	it('emits advanceOnClick changes', async () => {
		const wrapper = mount(SlideTransitionSection, {
			props: { slide: slide({ type: 'fade', durationMs: 500, advanceOnClick: true }) },
		});
		await wrapper.get('[data-testid="transition-advance"]').setValue(false);
		const last = wrapper.emitted('transition-update')?.at(-1)?.[0] as
			| PptxSlideTransition
			| undefined;
		expect(last?.advanceOnClick).toBeFalsy();
		expect(last?.type).toBe('fade');
	});

	it('shows a direction picker for directional transitions and emits the choice', async () => {
		const wrapper = mount(SlideTransitionSection, {
			props: { slide: slide({ type: 'push', durationMs: 500 }) },
		});
		expect(wrapper.text()).toContain('Direction');
		await wrapper.get('button[title="r"]').trigger('click');
		const last = wrapper.emitted('transition-update')?.at(-1)?.[0] as PptxSlideTransition;
		expect(last.direction).toBe('r');
		expect(last.type).toBe('push');
	});

	it('shows orientation buttons for orientation transitions and emits orient', async () => {
		const wrapper = mount(SlideTransitionSection, {
			props: { slide: slide({ type: 'blinds', durationMs: 500 }) },
		});
		expect(wrapper.text()).toContain('Orientation');
		// No directional picker for orientation types.
		expect(wrapper.find('button[title="r"]').exists()).toBeFalsy();
		const vert = wrapper.findAll('button').find((b) => b.text() === 'Vertical');
		await vert!.trigger('click');
		const last = wrapper.emitted('transition-update')?.at(-1)?.[0] as PptxSlideTransition;
		expect(last.orient).toBe('vert');
	});

	it('shows a spokes input for the wheel transition and clamps the value', async () => {
		const wrapper = mount(SlideTransitionSection, {
			props: { slide: slide({ type: 'wheel', durationMs: 500 }) },
		});
		expect(wrapper.text()).toContain('Spokes');
		const input = wrapper.get('[data-testid="transition-spokes"]');
		await input.setValue('12');
		const last = wrapper.emitted('transition-update')?.at(-1)?.[0] as PptxSlideTransition;
		expect(last.spokes).toBe(8);
	});

	it('does not render direction/orientation/spokes when no transition is set', () => {
		const wrapper = mount(SlideTransitionSection, { props: { slide: slide() } });
		expect(wrapper.text()).not.toContain('Direction');
		expect(wrapper.text()).not.toContain('Orientation');
		expect(wrapper.text()).not.toContain('Spokes');
	});
});
