import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { RecentColorsKey } from '../../composables/recent-colors-context';
import DebouncedColorInput from './DebouncedColorInput.vue';

/**
 * DebouncedColorInput: wraps every category-B `type="color"` input used by
 * `ColorChangeSection`, `ColorWashSection`, `DuotonePanel`, and
 * `TableCellFormattingPanel`. The "Recent colours" push (wave-4 B6) is wired
 * once here, on the native `change` event, so every caller gets it for free.
 */
describe('debouncedColorInput', () => {
	it('emits commit continuously on input, without pushing to recent colours', async () => {
		const recent = ref<string[]>([]);
		const push = (hex: string): void => {
			recent.value = [hex, ...recent.value.filter((c) => c !== hex)];
		};
		const wrapper = mount(DebouncedColorInput, {
			props: { value: '#000000' },
			global: { provide: { [RecentColorsKey as symbol]: { recent, push } } },
		});

		const input = wrapper.get('input[type="color"]');
		(input.element as HTMLInputElement).value = '#123456';
		await input.trigger('input');

		expect(wrapper.emitted('commit')).toStrictEqual([['#123456']]);
		expect(recent.value).toStrictEqual([]);
	});

	it('pushes the committed colour onto the injected recent-colours list on change', async () => {
		const recent = ref<string[]>(['#112233']);
		const push = (hex: string): void => {
			recent.value = [hex, ...recent.value.filter((c) => c !== hex)];
		};
		const wrapper = mount(DebouncedColorInput, {
			props: { value: '#000000' },
			global: { provide: { [RecentColorsKey as symbol]: { recent, push } } },
		});

		const input = wrapper.get('input[type="color"]');
		await input.setValue('#00ff00');

		expect(recent.value[0]).toBe('#00ff00');
	});

	it('does not throw without an injected recent-colours controller', async () => {
		const wrapper = mount(DebouncedColorInput, { props: { value: '#000000' } });
		const input = wrapper.get('input[type="color"]');
		await expect(input.setValue('#00ff00')).resolves.not.toThrow();
	});
});
