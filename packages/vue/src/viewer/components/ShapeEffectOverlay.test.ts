import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import ShapeEffectOverlay from './ShapeEffectOverlay.vue';

function shape(shapeStyle: Record<string, unknown>): PptxElement {
	return {
		type: 'shape',
		id: 'sp1',
		x: 0,
		y: 0,
		width: 100,
		height: 80,
		shapeStyle,
	} as unknown as PptxElement;
}

describe('shapeEffectOverlay', () => {
	it('renders nothing when the element has no fill overlay or soft edge', () => {
		const wrapper = mount(ShapeEffectOverlay, {
			props: { element: shape({ fillColor: '#ffffff' }) },
		});
		expect(wrapper.find('.pptx-vue-fill-overlay').exists()).toBeFalsy();
		expect(wrapper.find('svg').exists()).toBeFalsy();
	});

	it('paints a blended fill-overlay layer from a DAG fill overlay', () => {
		const wrapper = mount(ShapeEffectOverlay, {
			props: {
				element: shape({ dagFillOverlayColor: '#ff0000', dagFillOverlayBlend: 'mult' }),
			},
		});
		const layer = wrapper.get('.pptx-vue-fill-overlay');
		const style = layer.attributes('style') ?? '';
		expect(style).toContain('mix-blend-mode: multiply');
		expect(style).toContain('position: absolute');
		expect(style).toMatch(/background/u);
	});

	it('injects a soft-edge <filter> so filter: url(#soft-edge-<id>) resolves', () => {
		const wrapper = mount(ShapeEffectOverlay, {
			props: { element: shape({ softEdgeRadius: 6 }) },
		});
		expect(wrapper.find('svg').exists()).toBeTruthy();
		expect(wrapper.html()).toContain('id="soft-edge-sp1"');
	});
});
