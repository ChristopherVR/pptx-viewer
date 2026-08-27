import { mount } from '@vue/test-utils';
import { AFTER_ANIMATION_VALUES } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { translationsEn } from '../../../i18n';
import AfterAnimationRow from './AfterAnimationRow.vue';

function mountRow(props: Record<string, unknown> = {}) {
	return mount(AfterAnimationRow, { props: { action: 'none', color: undefined, ...props } });
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
});
