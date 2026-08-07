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

	it('strokes a stroke-only ("open") preset instead of leaving a box border', () => {
		// `<a:prstGeom prst="line"/>` has no region to fill and no box to outline;
		// a CSS border drew a rectangle where PowerPoint draws the line itself.
		const wrapper = mount(ShapeEffectOverlay, {
			props: {
				element: {
					type: 'shape',
					id: 'rule-1',
					x: 0,
					y: 0,
					width: 400,
					height: 0,
					shapeType: 'line',
					shapeStyle: { strokeColor: '#000000', strokeWidth: 2 },
				} as unknown as PptxElement,
			},
		});
		const path = wrapper.get('path');
		expect(path.attributes('d')).toBe('M 0 0 L 400 1');
		expect(path.attributes('stroke')).toBe('#000000');
		// The viewBox is the PAINTED box (padded to MIN_ELEMENT_SIZE), so the rule
		// is not stretched into a diagonal.
		expect(wrapper.get('svg').attributes('viewBox')).toBe('0 0 400 12');
		expect(wrapper.html()).not.toContain('<defs');
	});

	it('leaves a closed preset to its CSS border', () => {
		const wrapper = mount(ShapeEffectOverlay, {
			props: {
				element: {
					type: 'shape',
					id: 'sp2',
					x: 0,
					y: 0,
					width: 100,
					height: 80,
					shapeType: 'rect',
					shapeStyle: { strokeColor: '#000000', strokeWidth: 2 },
				} as unknown as PptxElement,
			},
		});
		// A closed preset must not get a PAINTED stroke outline - its CSS border
		// draws the edge. It does still get the transparent pointer-events:stroke
		// hit band, because this fixture is unfilled and textless: a hollow frame,
		// whose interior must let clicks through to whatever it is drawn over.
		expect(wrapper.html()).not.toContain('#000000');
		expect(wrapper.html()).toContain('transparent');
	});
});
