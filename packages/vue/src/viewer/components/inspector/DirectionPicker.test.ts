import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import DirectionPicker from './DirectionPicker.vue';

describe('directionPicker', () => {
	it('renders a row of buttons for 3-or-fewer directions and emits the choice', async () => {
		const wrapper = mount(DirectionPicker, {
			props: { directions: ['in', 'out'], value: undefined },
		});
		const buttons = wrapper.findAll('button');
		expect(buttons).toHaveLength(2);
		await wrapper.get('button[title="Out"]').trigger('click');
		expect(wrapper.emitted('change')?.[0]).toStrictEqual(['out']);
	});

	it('renders an arrow grid for 8 directions, placing each by compass position', () => {
		const dirs = ['l', 'r', 'u', 'd', 'lu', 'ld', 'ru', 'rd'];
		const wrapper = mount(DirectionPicker, { props: { directions: dirs, value: 'r' } });
		// 8 direction buttons (the centre cell stays empty).
		expect(wrapper.findAll('button')).toHaveLength(8);
		// Selected direction is marked pressed.
		expect(wrapper.get('button[title="Right"]').attributes('aria-pressed')).toBe('true');
	});

	it('shows the direction token when no arrow glyph is mapped', () => {
		const wrapper = mount(DirectionPicker, { props: { directions: ['xyz'], value: undefined } });
		expect(wrapper.get('button[title="Xyz"]').text()).toBe('xyz');
	});
});
