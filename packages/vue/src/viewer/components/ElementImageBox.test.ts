import { mount } from '@vue/test-utils';
import type { ImagePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ElementImageBox from './ElementImageBox.vue';

describe('element image box', () => {
	it('renders the shared clamped color-wash style', () => {
		const element: ImagePptxElement = {
			type: 'image',
			id: 'image-1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			imageData: 'data:image/png;base64,AA==',
			imageEffects: { colorWash: { color: '#112233', opacity: 135 } },
		};

		const wrapper = mount(ElementImageBox, {
			props: { element, mediaDataUrls: new Map(), zIndex: 0 },
		});
		const wash = wrapper.get('.pptx-vue-image-color-wash');

		expect(wash.attributes('style')).toContain('background-color: #112233');
		expect(wash.attributes('style')).toContain('opacity: 1');
	});

	it('renders a picture whose only blip is an SVG extension', () => {
		// Regression: `<a:blip>` with no `r:embed`, only `asvg:svgBlip`, resolved
		// to nothing here while React painted it, so icon artwork silently vanished.
		const element = {
			type: 'picture',
			id: 'pic-svg',
			x: 0,
			y: 0,
			width: 40,
			height: 40,
			svgData: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
		} as unknown as ImagePptxElement;

		const wrapper = mount(ElementImageBox, {
			props: { element, mediaDataUrls: new Map(), zIndex: 0 },
		});

		expect(wrapper.get('img').attributes('src')).toBe('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=');
	});

	it('applies the authored source crop rather than fitting the whole bitmap', () => {
		// Regression: a hard-coded `object-fit: contain` ignored `<a:srcRect>`, so
		// an inset cropped out of a wide composite showed the whole composite.
		const element = {
			type: 'picture',
			id: 'pic-crop',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			imageData: 'data:image/png;base64,AA==',
			cropLeft: 0.25,
			cropRight: 0.25,
		} as unknown as ImagePptxElement;

		const wrapper = mount(ElementImageBox, {
			props: { element, mediaDataUrls: new Map(), zIndex: 0 },
		});
		const style = wrapper.get('img').attributes('style') ?? '';

		expect(style).toContain('object-fit: fill');
		expect(style).toContain('translate(-50%, 0%) scale(2, 1)');
		// The scaled-up source must not paint outside its own frame.
		expect(wrapper.attributes('style')).toContain('overflow: hidden');
	});
});
