import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import RecentColorsRow from './RecentColorsRow.vue';

describe('recentColorsRow', () => {
	it('renders nothing when there are no recent colours', () => {
		const wrapper = mount(RecentColorsRow, { props: { colors: [] } });
		expect(wrapper.find('[data-testid="pptx-color-recent"]').exists()).toBeFalsy();
	});

	it('renders one swatch per colour, in order', () => {
		const wrapper = mount(RecentColorsRow, { props: { colors: ['#112233', '#445566'] } });
		const swatches = wrapper.findAll('[data-testid="pptx-color-recent"] button');
		expect(swatches).toHaveLength(2);
		expect((swatches[0].element as HTMLElement).style.backgroundColor).toBe('#112233');
	});

	it('emits pick with the clicked colour', async () => {
		const wrapper = mount(RecentColorsRow, { props: { colors: ['#112233', '#445566'] } });
		const swatches = wrapper.findAll('[data-testid="pptx-color-recent"] button');
		await swatches[1].trigger('click');
		expect(wrapper.emitted('pick')).toStrictEqual([['#445566']]);
	});
});
