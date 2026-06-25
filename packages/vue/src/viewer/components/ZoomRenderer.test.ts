import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { ZoomNavigationKey } from '../composables/zoom-navigation';
import ZoomRenderer from './ZoomRenderer.vue';

function zoom(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'zoom',
		id: 'zm 1',
		x: 10,
		y: 20,
		width: 200,
		height: 120,
		zoomType: 'slide',
		targetSlideIndex: 4,
		...overrides,
	} as PptxElement;
}

describe('zoomRenderer', () => {
	it('renders a slide-number fallback tile and a Slide Zoom badge', () => {
		const wrapper = mount(ZoomRenderer, { props: { element: zoom(), zIndex: 1 } });
		// targetSlideIndex 4 → "Slide 5"
		expect(wrapper.text()).toContain('Slide 5');
		expect(wrapper.text()).toContain('Slide Zoom');
		expect(wrapper.attributes('data-zoom-target')).toBe('4');
		expect(wrapper.find('img').exists()).toBeFalsy();
	});

	it('renders the preview image when imageData is present', () => {
		const src = 'data:image/png;base64,ZTHUMB';
		const wrapper = mount(ZoomRenderer, {
			props: { element: zoom({ imageData: src }), zIndex: 0 },
		});
		expect(wrapper.get('img').attributes('src')).toBe(src);
	});

	it('renders a Section Zoom badge and section label for section zooms', () => {
		const wrapper = mount(ZoomRenderer, {
			props: {
				element: zoom({ zoomType: 'section', targetSectionId: 'Intro' }),
				zIndex: 0,
			},
		});
		expect(wrapper.text()).toContain('Section Zoom');
		expect(wrapper.text()).toContain('Intro');
		expect(wrapper.attributes('data-zoom-type')).toBe('section');
	});

	it('stays a static tile (not focusable / no role) outside presentation mode', () => {
		const wrapper = mount(ZoomRenderer, { props: { element: zoom(), zIndex: 1 } });
		expect(wrapper.attributes('role')).toBeUndefined();
		expect(wrapper.attributes('tabindex')).toBeUndefined();
		expect(wrapper.classes()).not.toContain('pptx-vue-zoom-interactive');
	});

	it('navigates to the target slide on click when presentation provides a context', async () => {
		const navigateToZoomTarget = vi.fn();
		const wrapper = mount(ZoomRenderer, {
			props: { element: zoom({ targetSlideIndex: 5 }), zIndex: 1 },
			global: { provide: { [ZoomNavigationKey as symbol]: { navigateToZoomTarget } } },
		});
		expect(wrapper.attributes('role')).toBe('button');
		expect(wrapper.attributes('tabindex')).toBe('0');
		await wrapper.trigger('click');
		expect(navigateToZoomTarget).toHaveBeenCalledWith(5);
	});

	it('navigates on Enter and Space but ignores other keys', async () => {
		const navigateToZoomTarget = vi.fn();
		const wrapper = mount(ZoomRenderer, {
			props: { element: zoom({ targetSlideIndex: 2 }), zIndex: 1 },
			global: { provide: { [ZoomNavigationKey as symbol]: { navigateToZoomTarget } } },
		});
		await wrapper.trigger('keydown', { key: 'Enter' });
		await wrapper.trigger('keydown', { key: ' ' });
		await wrapper.trigger('keydown', { key: 'a' });
		expect(navigateToZoomTarget).toHaveBeenCalledTimes(2);
		expect(navigateToZoomTarget).toHaveBeenNthCalledWith(1, 2);
	});
});
