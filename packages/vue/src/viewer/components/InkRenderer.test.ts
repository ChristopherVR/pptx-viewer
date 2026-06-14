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
});
