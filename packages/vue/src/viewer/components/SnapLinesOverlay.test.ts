import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import SnapLinesOverlay from './SnapLinesOverlay.vue';

describe('snapLinesOverlay', () => {
	it('renders a vertical line for an x-axis snap and horizontal for y', () => {
		const wrapper = mount(SnapLinesOverlay, {
			props: {
				snapLines: [
					{ axis: 'x' as const, position: 150 },
					{ axis: 'y' as const, position: 80 },
				],
			},
		});
		const lines = wrapper.findAll('div');
		expect(lines).toHaveLength(2);
		expect(lines[0].attributes('style')).toContain('left: 150px');
		expect(lines[0].attributes('style')).toContain('width: 1px');
		expect(lines[1].attributes('style')).toContain('top: 80px');
		expect(lines[1].attributes('style')).toContain('height: 1px');
	});

	it('renders nothing for an empty list', () => {
		const wrapper = mount(SnapLinesOverlay, { props: { snapLines: [] } });
		expect(wrapper.findAll('div')).toHaveLength(0);
	});
});
