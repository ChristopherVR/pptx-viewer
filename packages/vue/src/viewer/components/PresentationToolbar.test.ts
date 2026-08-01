import { mount } from '@vue/test-utils';
import { PRESENT_TOOLBAR_ORDER } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import type { PresentationTool } from '../composables/usePresentationAnnotations';
import PresentationToolbar from './PresentationToolbar.vue';

function mountToolbar(props: Partial<Record<string, unknown>> = {}) {
	return mount(PresentationToolbar, {
		props: {
			presentationTool: 'none' as PresentationTool,
			penColor: '#ff0000',
			highlighterColor: '#ffff00',
			hasAnnotations: false,
			currentSlideIndex: 1,
			totalSlides: 5,
			presentationStartTime: null,
			...props,
		},
	});
}

describe('presentationToolbar', () => {
	it('renders the slide counter (one-based)', () => {
		const wrapper = mountToolbar();
		expect(wrapper.find('.pptx-vue-ptb-counter').text()).toBe('2 / 5');
	});

	// The bar drifted from React once already (its own i18n namespace for half
	// the labels, an 18px colour caret, no ticking timer). Pinning the shared
	// inventory here is what makes a repeat show up as a unit-test failure.
	it('renders the shared control inventory in order', () => {
		const wrapper = mountToolbar({ showPresenterToggle: true });
		const ids = wrapper
			.findAll('[data-pptx-present-control]')
			.map((node) => node.attributes('data-pptx-present-control'));
		expect(ids).toStrictEqual([...PRESENT_TOOLBAR_ORDER]);
	});

	it('names its controls exactly as React does', () => {
		const wrapper = mountToolbar({ showPresenterToggle: true });
		const nameOf = (id: string): string | undefined =>
			wrapper.find(`[data-pptx-present-control="${id}"]`).attributes('aria-label');
		expect(nameOf('previous')).toBe('Previous Slide');
		expect(nameOf('next')).toBe('Next Slide');
		expect(nameOf('clear')).toBe('Clear Annotations');
		expect(nameOf('presenter-view')).toBe('Presenter View');
		expect(nameOf('end')).toBe('End Presentation');
	});

	// The bar mounts before its host records the start time, so a mount-only
	// interval left the readout showing a negative elapsed ("-1:-1") forever.
	it('never shows a negative elapsed time when the show starts after mount', async () => {
		const wrapper = mountToolbar({ presentationStartTime: null });
		expect(wrapper.find('[data-pptx-present-control="timer"]').text()).toBe('00:00');
		await wrapper.setProps({ presentationStartTime: Date.now() + 500 });
		expect(wrapper.find('[data-pptx-present-control="timer"]').text()).toBe('00:00');
	});

	it('emits move on nav buttons and end-presentation', async () => {
		const wrapper = mountToolbar();
		const navButtons = wrapper.findAll('.pptx-vue-ptb-btn');
		// First nav button is "prev" (enabled, not on slide 0).
		await navButtons[0]?.trigger('click');
		expect(wrapper.emitted('move')?.[0]).toStrictEqual([-1]);

		await wrapper.find('.pptx-vue-ptb-btn--end').trigger('click');
		expect(wrapper.emitted('end-presentation')).toHaveLength(1);
	});

	it('emits set-tool when an annotation tool is clicked', async () => {
		const wrapper = mountToolbar();
		// Find the laser button by aria-label.
		const laser = wrapper.find('[aria-label="Laser Pointer"]');
		await laser.trigger('click');
		expect(wrapper.emitted('set-tool')?.[0]).toStrictEqual(['laser']);
	});

	it('marks the active tool', () => {
		const wrapper = mountToolbar({ presentationTool: 'pen' });
		const pen = wrapper.find('[aria-label="Pen"]');
		expect(pen.classes()).toContain('pptx-vue-ptb-btn--active');
	});

	it('opens the pen colour palette and emits set-pen-color', async () => {
		const wrapper = mountToolbar();
		await wrapper.find('[aria-label="Pen colour"]').trigger('click');
		const swatches = wrapper.findAll('.pptx-vue-ptb-color');
		expect(swatches).toHaveLength(8);
		await swatches[1]?.trigger('click');
		expect(wrapper.emitted('set-pen-color')?.[0]?.[0]).toBeTypeOf('string');
	});

	it('disables clear-all when there are no annotations', async () => {
		const wrapper = mountToolbar({ hasAnnotations: false });
		const clear = wrapper.find('[aria-label="Clear Annotations"]');
		expect(clear.attributes('disabled')).toBeDefined();
		await clear.trigger('click');
		expect(wrapper.emitted('clear-annotations')).toBeUndefined();
	});

	it('emits clear-annotations when enabled', async () => {
		const wrapper = mountToolbar({ hasAnnotations: true });
		await wrapper.find('[aria-label="Clear Annotations"]').trigger('click');
		expect(wrapper.emitted('clear-annotations')).toHaveLength(1);
	});

	it('shows the presenter-view toggle only when enabled', async () => {
		const without = mountToolbar({ showPresenterToggle: false });
		expect(without.find('[aria-label="Presenter View"]').exists()).toBeFalsy();

		const wrapper = mountToolbar({ showPresenterToggle: true });
		await wrapper.find('[aria-label="Presenter View"]').trigger('click');
		expect(wrapper.emitted('toggle-presenter-view')).toHaveLength(1);
	});

	it('disables prev on the first slide and next on the last', () => {
		const first = mountToolbar({ currentSlideIndex: 0, totalSlides: 3 });
		const firstNav = first.findAll('.pptx-vue-ptb-btn');
		expect(firstNav[0]?.attributes('disabled')).toBeDefined();

		const last = mountToolbar({ currentSlideIndex: 2, totalSlides: 3 });
		const lastNav = last.findAll('.pptx-vue-ptb-btn');
		expect(lastNav[1]?.attributes('disabled')).toBeDefined();
	});
});
