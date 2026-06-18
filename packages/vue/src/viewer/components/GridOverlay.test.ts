import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import GridOverlay from './GridOverlay.vue';

const canvasSize = { width: 960, height: 540 };

describe('gridOverlay', () => {
	it('renders nothing when not visible', () => {
		const wrapper = mount(GridOverlay, { props: { canvasSize, visible: false } });
		expect(wrapper.find('svg').exists()).toBeFalsy();
	});

	it('renders an SVG dot pattern sized to the canvas when visible', () => {
		const wrapper = mount(GridOverlay, { props: { canvasSize, visible: true } });
		const svg = wrapper.get('svg');
		expect(svg.attributes('width')).toBe('960');
		expect(svg.attributes('height')).toBe('540');
		const pattern = wrapper.get('pattern');
		// Default spacing = GRID_SIZE (8).
		expect(pattern.attributes('width')).toBe('8');
		expect(wrapper.find('circle').exists()).toBeTruthy();
	});

	it('honours a custom grid spacing', () => {
		const wrapper = mount(GridOverlay, {
			props: { canvasSize, visible: true, gridSpacingPx: 16 },
		});
		expect(wrapper.get('pattern').attributes('width')).toBe('16');
	});
});
