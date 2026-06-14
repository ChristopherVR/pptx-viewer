import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

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
});
