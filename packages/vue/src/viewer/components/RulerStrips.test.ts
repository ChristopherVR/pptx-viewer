import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import RulerStrips from './RulerStrips.vue';

describe('rulerStrips', () => {
	const props = { canvasSize: { width: 960, height: 540 }, scale: 1 };

	it('renders a horizontal and vertical ruler with ticks + labels', () => {
		const wrapper = mount(RulerStrips, { props });
		const svgs = wrapper.findAll('svg');
		expect(svgs).toHaveLength(2);
		// Ticks across both strips.
		expect(wrapper.findAll('line').length).toBeGreaterThan(20);
		// Numbered inch labels.
		const labels = wrapper.findAll('text').map((t) => t.text());
		expect(labels).toContain('0');
		expect(labels).toContain('5');
	});

	it('renders a corner box', () => {
		const wrapper = mount(RulerStrips, { props });
		// Corner + 2 ruler svgs; the corner is a positioned div.
		expect(wrapper.find('div').exists()).toBeTruthy();
	});
});
