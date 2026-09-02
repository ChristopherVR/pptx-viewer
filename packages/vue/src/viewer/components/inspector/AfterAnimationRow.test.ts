import { mount } from '@vue/test-utils';
import { AFTER_ANIMATION_VALUES } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { translationsEn } from '../../../i18n';
import { RecentColorsKey } from '../../composables/recent-colors-context';
import AfterAnimationRow from './AfterAnimationRow.vue';

function mountRow(props: Record<string, unknown> = {}, global?: Record<string, unknown>) {
	return mount(AfterAnimationRow, {
		props: { action: 'none', color: undefined, ...props },
		...(global ? { global } : {}),
	});
}

describe('afterAnimationRow', () => {
	it('offers all four actions', () => {
		const wrapper = mountRow();
		const options = wrapper.findAll('option');
		expect(options.map((option) => option.attributes('value'))).toStrictEqual([
			...AFTER_ANIMATION_VALUES,
		]);
	});

	it('labels the row from the shared dictionary', () => {
		const wrapper = mountRow();
		expect(wrapper.text()).toContain(translationsEn['pptx.animation.afterAnimation']);
	});

	it('hides the colour swatch unless dimToColor is selected', () => {
		expect(mountRow({ action: 'none' }).find('input[type="color"]').exists()).toBeFalsy();
		expect(
			mountRow({ action: 'hideOnNextClick' }).find('input[type="color"]').exists(),
		).toBeFalsy();
		const wrapper = mountRow({ action: 'dimToColor', color: '#ff0000' });
		const colorInput = wrapper.get('input[type="color"]').element as HTMLInputElement;
		expect(colorInput.value.toLowerCase()).toBe('#ff0000');
	});

	it('emits the selected action', async () => {
		const wrapper = mountRow();
		await wrapper.get('select').setValue('hideOnNextClick');
		expect(wrapper.emitted('action')).toStrictEqual([['hideOnNextClick']]);
	});

	it('emits the picked colour', async () => {
		const wrapper = mountRow({ action: 'dimToColor', color: '#000000' });
		const colorInput = wrapper.get('input[type="color"]');
		await colorInput.setValue('#00ff00');
		expect(wrapper.emitted('color')).toStrictEqual([['#00ff00']]);
	});

	it('pushes a committed colour onto the injected recent-colours list (category-B push, no row)', async () => {
		const recent = ref<string[]>(['#112233']);
		const push = (hex: string): void => {
			recent.value = [hex, ...recent.value.filter((c) => c !== hex)];
		};
		const wrapper = mountRow(
			{ action: 'dimToColor', color: '#000000' },
			{ provide: { [RecentColorsKey as symbol]: { recent, push } } },
		);

		// AfterAnimationRow is a category-B picker: it commits a colour but has
		// no "Recent colours" row of its own.
		expect(wrapper.find('[data-testid="pptx-color-recent"]').exists()).toBeFalsy();

		const colorInput = wrapper.get('input[type="color"]');
		await colorInput.setValue('#00ff00');
		expect(recent.value[0]).toBe('#00ff00');
	});
});
