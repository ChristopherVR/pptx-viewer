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

	it('clips a "Crop to Shape" picture via the shared adjustment-aware preset cascade', () => {
		// Regression: Vue had no `cropShape` (Format Picture > Crop to Shape gallery)
		// support at all; a picture with `cropShape: 'ellipse'` rendered as a plain
		// rectangle.
		const element: ImagePptxElement = {
			type: 'image',
			id: 'image-ellipse',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			imageData: 'data:image/png;base64,AA==',
			cropShape: 'ellipse',
		};

		const wrapper = mount(ElementImageBox, {
			props: { element, mediaDataUrls: new Map(), zIndex: 0 },
		});

		expect(wrapper.attributes('style')).toContain('clip-path');
	});

	it('renders no clip-path when cropShape is unset', () => {
		const element: ImagePptxElement = {
			type: 'image',
			id: 'image-plain',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			imageData: 'data:image/png;base64,AA==',
		};

		const wrapper = mount(ElementImageBox, {
			props: { element, mediaDataUrls: new Map(), zIndex: 0 },
		});

		expect(wrapper.attributes('style')).not.toContain('clip-path');
	});

	it('clips a custGeom oval-cut picture on the FRAME, not the img', () => {
		// Regression: the picture's own shape geometry (an authored oval
		// custGeom) must clip the stationary frame. A pixel-space clip on the
		// `<img>` would be scaled and shifted by the source-crop transform, and
		// the oval rendered past its frame.
		const element: ImagePptxElement = {
			type: 'picture',
			id: 'pic-oval',
			x: 0,
			y: 0,
			width: 756,
			height: 427,
			imageData: 'data:image/png;base64,AA==',
			shapeType: 'custom',
			pathData: 'M 0 0 L 100 0 L 100 100 Z',
			pathWidth: 100,
			pathHeight: 100,
		} as unknown as ImagePptxElement;

		const wrapper = mount(ElementImageBox, {
			props: { element, mediaDataUrls: new Map(), zIndex: 0 },
		});
		const boxStyle = wrapper.attributes('style') ?? '';
		const imgStyle = wrapper.get('img').attributes('style') ?? '';

		expect(boxStyle).toContain('clip-path: path(');
		expect(imgStyle).not.toContain('clip-path');
	});

	it('rounds an ellipse picture via border-radius on the frame', () => {
		const element: ImagePptxElement = {
			type: 'picture',
			id: 'pic-ellipse',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			imageData: 'data:image/png;base64,AA==',
			shapeType: 'ellipse',
		};

		const wrapper = mount(ElementImageBox, {
			props: { element, mediaDataUrls: new Map(), zIndex: 0 },
		});

		expect(wrapper.attributes('style')).toContain('border-radius: 50%');
	});
});
