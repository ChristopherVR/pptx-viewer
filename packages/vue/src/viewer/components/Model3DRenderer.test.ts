import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import Model3DRenderer from './Model3DRenderer.vue';

function model3d(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'model3d',
		id: 'm3d 1',
		x: 0,
		y: 0,
		width: 320,
		height: 240,
		...overrides,
	} as PptxElement;
}

describe('model3DRenderer', () => {
	it('renders the poster image when posterImage is present', () => {
		const src = 'data:image/png;base64,POSTER';
		const wrapper = mount(Model3DRenderer, {
			props: { element: model3d({ posterImage: src }), zIndex: 1 },
		});
		expect(wrapper.get('img').attributes('src')).toBe(src);
	});

	it('falls back to imageData when posterImage is absent', () => {
		const src = 'data:image/png;base64,RASTER';
		const wrapper = mount(Model3DRenderer, {
			props: { element: model3d({ imageData: src }), zIndex: 0 },
		});
		expect(wrapper.get('img').attributes('src')).toBe(src);
	});

	it('renders a labelled placeholder when no poster/image is available', () => {
		const wrapper = mount(Model3DRenderer, { props: { element: model3d(), zIndex: 0 } });
		expect(wrapper.find('img').exists()).toBeFalsy();
		expect(wrapper.text()).toContain('3D Model');
	});
});
