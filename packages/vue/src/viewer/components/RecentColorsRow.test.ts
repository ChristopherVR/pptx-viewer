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

	it('labels the container and each swatch per the row contract', () => {
		const wrapper = mount(RecentColorsRow, { props: { colors: ['#112233'] } });
		const container = wrapper.get('[data-testid="pptx-color-recent"]');
		expect(container.attributes('aria-label')).toBe('Recent Colors');
		const swatch = wrapper.get('[data-testid="pptx-color-recent"] button');
		expect(swatch.attributes('aria-label')).toBe('Recent #112233');
		expect(swatch.attributes('title')).toBe('#112233');
	});

	it('disables every swatch when the picker is disabled', () => {
		const wrapper = mount(RecentColorsRow, {
			props: { colors: ['#112233', '#445566'], disabled: true },
		});
		for (const swatch of wrapper.findAll('[data-testid="pptx-color-recent"] button')) {
			expect((swatch.element as HTMLButtonElement).disabled).toBeTruthy();
		}
	});
});
