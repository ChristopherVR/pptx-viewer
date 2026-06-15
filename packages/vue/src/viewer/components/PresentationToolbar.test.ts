import { mount } from '@vue/test-utils';
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

	it('emits move on nav buttons and end-presentation', async () => {
		const wrapper = mountToolbar();
		const navButtons = wrapper.findAll('.pptx-vue-ptb-btn');
		// First nav button is "prev" (enabled — not on slide 0).
		await navButtons[0]?.trigger('click');
		expect(wrapper.emitted('move')?.[0]).toStrictEqual([-1]);

		await wrapper.find('.pptx-vue-ptb-btn--end').trigger('click');
		expect(wrapper.emitted('end-presentation')).toHaveLength(1);
	});

	it('emits set-tool when an annotation tool is clicked', async () => {
		const wrapper = mountToolbar();
		// Find the laser button by aria-label.
		const laser = wrapper.find('[aria-label="Laser pointer"]');
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
		const clear = wrapper.find('[aria-label="Clear annotations"]');
		expect(clear.attributes('disabled')).toBeDefined();
		await clear.trigger('click');
		expect(wrapper.emitted('clear-annotations')).toBeUndefined();
	});

	it('emits clear-annotations when enabled', async () => {
		const wrapper = mountToolbar({ hasAnnotations: true });
		await wrapper.find('[aria-label="Clear annotations"]').trigger('click');
		expect(wrapper.emitted('clear-annotations')).toHaveLength(1);
	});

	it('shows the presenter-view toggle only when enabled', async () => {
		const without = mountToolbar({ showPresenterToggle: false });
		expect(without.find('[aria-label="Presenter view"]').exists()).toBeFalsy();

		const wrapper = mountToolbar({ showPresenterToggle: true });
		await wrapper.find('[aria-label="Presenter view"]').trigger('click');
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
