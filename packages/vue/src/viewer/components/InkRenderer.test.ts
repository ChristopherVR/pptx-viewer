import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import InkRenderer from './InkRenderer.vue';

function ink(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'ink',
		id: 'ink 1',
		x: 10,
		y: 20,
		width: 200,
		height: 100,
		inkPaths: ['M0 0 L10 10', 'M20 20 L30 30'],
		inkColors: ['#ff0000', '#00ff00'],
		inkWidths: [2, 4],
		inkOpacities: [1, 0.5],
		...overrides,
	} as PptxElement;
}

describe('inkRenderer', () => {
	it('renders one svg path per ink stroke with resolved colour/width/opacity', () => {
		const wrapper = mount(InkRenderer, { props: { element: ink(), zIndex: 1 } });
		const paths = wrapper.findAll('path');
		expect(paths).toHaveLength(2);
		expect(paths[0].attributes('d')).toBe('M0 0 L10 10');
		expect(paths[0].attributes('stroke')).toBe('#ff0000');
		expect(paths[0].attributes('stroke-width')).toBe('2');
		expect(paths[1].attributes('stroke')).toBe('#00ff00');
		expect(paths[1].attributes('stroke-opacity')).toBe('0.5');
	});

	it('falls back to defaults when per-stroke arrays are absent', () => {
		const wrapper = mount(InkRenderer, {
			props: {
				element: ink({ inkColors: undefined, inkWidths: undefined, inkOpacities: undefined }),
				zIndex: 0,
			},
		});
		const path = wrapper.get('path');
		expect(path.attributes('stroke-width')).toBe('1');
		expect(path.attributes('stroke-opacity')).toBe('1');
	});

	it('renders no svg when there are no ink paths', () => {
		const wrapper = mount(InkRenderer, {
			props: { element: ink({ inkPaths: [] }), zIndex: 0 },
		});
		expect(wrapper.find('svg').exists()).toBeFalsy();
	});

	it('renders pressure-sensitive circles when inkPointPressures vary', () => {
		const wrapper = mount(InkRenderer, {
			props: {
				element: ink({
					inkPaths: ['M0 0 L50 0 L100 0'],
					inkColors: ['#ff0000'],
					inkWidths: [3],
					inkOpacities: [1],
					inkPointPressures: [[0.2, 0.6, 0.9]],
				}),
				zIndex: 1,
			},
		});
		// No plain <path> for the pressure stroke; a <g> of <circle>s instead.
		expect(wrapper.findAll('path')).toHaveLength(0);
		const circles = wrapper.findAll('circle');
		expect(circles).toHaveLength(3);
		expect(circles[0].attributes('fill')).toBe('#ff0000');
		// Higher pressure at the end yields a larger radius than the start.
		const r0 = parseFloat(circles[0].attributes('r') ?? '0');
		const r2 = parseFloat(circles[2].attributes('r') ?? '0');
		expect(r2).toBeGreaterThan(r0);
	});

	it('keeps per-path strokes as plain paths (per-path widths are not pressure)', () => {
		const wrapper = mount(InkRenderer, {
			props: { element: ink(), zIndex: 1 },
		});
		expect(wrapper.findAll('path')).toHaveLength(2);
		expect(wrapper.findAll('circle')).toHaveLength(0);
	});

	it('treats uniform inkPointPressures as a plain constant-width path', () => {
		const wrapper = mount(InkRenderer, {
			props: {
				element: ink({
					inkPaths: ['M0 0 L50 0 L100 0'],
					inkColors: ['#0000ff'],
					inkWidths: [3],
					inkOpacities: [1],
					inkPointPressures: [[0.5, 0.5, 0.5]],
				}),
				zIndex: 1,
			},
		});
		expect(wrapper.findAll('path')).toHaveLength(1);
		expect(wrapper.findAll('circle')).toHaveLength(0);
	});
});
