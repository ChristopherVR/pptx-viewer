import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import MobileBottomBar from './MobileBottomBar.vue';

function mountBar(
	props: Partial<{ slideIndex: number; slideCount: number; zoomPercent: number }> = {},
) {
	return mount(MobileBottomBar, {
		props: {
			slideIndex: 1,
			slideCount: 5,
			zoomPercent: 100,
			...props,
		},
	});
}

describe('mobileBottomBar', () => {
	it('renders a 1-based slide counter', () => {
		const wrapper = mountBar({ slideIndex: 2, slideCount: 5 });
		expect(wrapper.get('.pptx-vue-mobile-counter').text()).toBe('3 / 5');
	});

	it('renders 0 / 0 for an empty deck', () => {
		const wrapper = mountBar({ slideIndex: 0, slideCount: 0 });
		expect(wrapper.get('.pptx-vue-mobile-counter').text()).toBe('0 / 0');
	});

	it('renders the zoom percentage', () => {
		const wrapper = mountBar({ zoomPercent: 75 });
		expect(wrapper.get('.pptx-vue-mobile-zoom').text()).toBe('75%');
	});

	it('emits prev / next from the navigation buttons', async () => {
		const wrapper = mountBar({ slideIndex: 2, slideCount: 5 });
		await wrapper.get('button[aria-label="Previous slide"]').trigger('click');
		await wrapper.get('button[aria-label="Next slide"]').trigger('click');
		expect(wrapper.emitted('prev')).toHaveLength(1);
		expect(wrapper.emitted('next')).toHaveLength(1);
	});

	it('emits zoom-in / zoom-out', async () => {
		const wrapper = mountBar();
		await wrapper.get('button[aria-label="Zoom in"]').trigger('click');
		await wrapper.get('button[aria-label="Zoom out"]').trigger('click');
		expect(wrapper.emitted('zoom-in')).toHaveLength(1);
		expect(wrapper.emitted('zoom-out')).toHaveLength(1);
	});

	it('emits present and menu', async () => {
		const wrapper = mountBar();
		await wrapper.get('button[aria-label="Present"]').trigger('click');
		await wrapper.get('button[aria-label="More actions"]').trigger('click');
		expect(wrapper.emitted('present')).toHaveLength(1);
		expect(wrapper.emitted('menu')).toHaveLength(1);
	});

	it('emits save from the Save button', async () => {
		const wrapper = mountBar();
		await wrapper.get('button[aria-label="Save"]').trigger('click');
		expect(wrapper.emitted('save')).toHaveLength(1);
	});

	it('hides the Format / Comments triggers unless canEdit', () => {
		const wrapper = mountBar();
		expect(wrapper.find('button[aria-label="Format"]').exists()).toBeFalsy();
		expect(wrapper.find('button[aria-label="Comments"]').exists()).toBeFalsy();
	});

	it('emits format / comments when editable', async () => {
		const wrapper = mount(MobileBottomBar, {
			props: { slideIndex: 0, slideCount: 1, zoomPercent: 100, canEdit: true },
		});
		await wrapper.get('button[aria-label="Format"]').trigger('click');
		await wrapper.get('button[aria-label="Comments"]').trigger('click');
		expect(wrapper.emitted('format')).toHaveLength(1);
		expect(wrapper.emitted('comments')).toHaveLength(1);
	});

	it('renders a comment-count badge when editable and count > 0', () => {
		const wrapper = mount(MobileBottomBar, {
			props: { slideIndex: 0, slideCount: 1, zoomPercent: 100, canEdit: true, commentCount: 3 },
		});
		expect(wrapper.get('.pptx-vue-mobile-badge').text()).toBe('3');
	});

	it('caps the comment badge at 99+', () => {
		const wrapper = mount(MobileBottomBar, {
			props: { slideIndex: 0, slideCount: 1, zoomPercent: 100, canEdit: true, commentCount: 150 },
		});
		expect(wrapper.get('.pptx-vue-mobile-badge').text()).toBe('99+');
	});

	it('omits the comment badge when count is 0', () => {
		const wrapper = mount(MobileBottomBar, {
			props: { slideIndex: 0, slideCount: 1, zoomPercent: 100, canEdit: true, commentCount: 0 },
		});
		expect(wrapper.find('.pptx-vue-mobile-badge').exists()).toBeFalsy();
	});

	it('disables prev at the first slide and next at the last', () => {
		const first = mountBar({ slideIndex: 0, slideCount: 3 });
		expect(first.get('button[aria-label="Previous slide"]').attributes('disabled')).toBeDefined();
		expect(first.get('button[aria-label="Next slide"]').attributes('disabled')).toBeUndefined();

		const last = mountBar({ slideIndex: 2, slideCount: 3 });
		expect(last.get('button[aria-label="Next slide"]').attributes('disabled')).toBeDefined();
		expect(last.get('button[aria-label="Previous slide"]').attributes('disabled')).toBeUndefined();
	});

	it('renders navigation and zoom by default (hiddenActions omitted)', () => {
		const wrapper = mountBar();
		expect(wrapper.find('button[aria-label="Previous slide"]').exists()).toBeTruthy();
		expect(wrapper.find('button[aria-label="Zoom in"]').exists()).toBeTruthy();
	});

	it('hides the navigation cluster when "navigation" is in hiddenActions', () => {
		const wrapper = mount(MobileBottomBar, {
			props: { slideIndex: 1, slideCount: 5, zoomPercent: 100, hiddenActions: ['navigation'] },
		});
		expect(wrapper.find('button[aria-label="Previous slide"]').exists()).toBeFalsy();
		expect(wrapper.find('button[aria-label="Next slide"]').exists()).toBeFalsy();
		expect(wrapper.find('.pptx-vue-mobile-counter').exists()).toBeFalsy();
		// The zoom cluster stays intact.
		expect(wrapper.find('button[aria-label="Zoom in"]').exists()).toBeTruthy();
	});

	it('hides the zoom cluster when "zoom" is in hiddenActions', () => {
		const wrapper = mount(MobileBottomBar, {
			props: { slideIndex: 1, slideCount: 5, zoomPercent: 100, hiddenActions: ['zoom'] },
		});
		expect(wrapper.find('button[aria-label="Zoom in"]').exists()).toBeFalsy();
		expect(wrapper.find('button[aria-label="Zoom out"]').exists()).toBeFalsy();
		expect(wrapper.find('.pptx-vue-mobile-zoom').exists()).toBeFalsy();
		// Navigation stays intact.
		expect(wrapper.find('button[aria-label="Previous slide"]').exists()).toBeTruthy();
	});
});
