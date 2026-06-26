import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { build3DExtrusionData } from '../composables/visual-3d';
import ElementRenderer from './ElementRenderer.vue';
import Extrusion3DOverlay from './Extrusion3DOverlay.vue';

// EMU per CSS pixel at 96 DPI; a 20px-deep extrusion is 20 * 9525 EMU.
const EMU_PER_PX = 9525;

function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 'sp 1',
		x: 0,
		y: 0,
		width: 100,
		height: 60,
		shapeType: 'rect',
		shapeStyle: { fillColor: '#4472c4' },
		...overrides,
	} as PptxElement;
}

describe('extrusion3DOverlay', () => {
	it('renders side panels with px-normalized inline styles', () => {
		const data = build3DExtrusionData(
			{ extrusionHeight: 20 * EMU_PER_PX },
			undefined,
			'#4472c4',
			100,
			60,
		);
		const wrapper = mount(Extrusion3DOverlay, { props: { data } });

		const panels = wrapper.findAll('.pptx-vue-extrusion-3d-panel');
		expect(panels.length).toBeGreaterThan(0);

		// The shared builder emits raw numbers for lengths; the Vue overlay must
		// coerce them to `px` strings or the browser would drop the dimension.
		const styles = panels.map((p) => p.attributes('style') ?? '');
		expect(styles.some((s) => /width:\s*100px/u.test(s))).toBeTruthy();
		expect(styles.every((s) => !/width:\s*100;/u.test(s))).toBeTruthy();
		// Wrapper establishes its own 3D context.
		const ws = wrapper.get('.pptx-vue-extrusion-3d-wrapper').attributes('style') ?? '';
		expect(ws).toMatch(/transform-style:\s*preserve-3d/u);
	});

	it('renders nothing when the shape has no extrusion depth', () => {
		const data = build3DExtrusionData(undefined, undefined, '#4472c4', 100, 60);
		const wrapper = mount(Extrusion3DOverlay, { props: { data } });
		expect(wrapper.find('.pptx-vue-extrusion-3d-wrapper').exists()).toBeFalsy();
	});

	it('is wired into ElementRenderer for extruded shapes only', () => {
		const extruded = mount(ElementRenderer, {
			props: {
				element: shape({
					shapeStyle: { fillColor: '#4472c4', shape3d: { extrusionHeight: 20 * EMU_PER_PX } },
				}),
				mediaDataUrls: new Map<string, string>(),
				zIndex: 1,
			},
		});
		expect(extruded.findComponent(Extrusion3DOverlay).exists()).toBeTruthy();

		const flat = mount(ElementRenderer, {
			props: { element: shape(), mediaDataUrls: new Map<string, string>(), zIndex: 1 },
		});
		expect(flat.findComponent(Extrusion3DOverlay).exists()).toBeFalsy();
	});
});
