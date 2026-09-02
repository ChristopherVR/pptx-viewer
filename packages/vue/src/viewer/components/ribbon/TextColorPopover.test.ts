import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { RecentColorsKey } from '../../composables/recent-colors-context';
import TextColorPopover from './TextColorPopover.vue';

/**
 * TextColorPopover: shared trigger+popover for the ribbon's font-colour and
 * text-highlight-colour pickers (wave-4 B6 "Recent colours" parity, surface
 * A4). Every commit path (preset swatch, recent-colours row, custom colour
 * input) should both fire `pick` and fold the colour into the injected
 * recent-colours list.
 */
function mountPopover(global?: Record<string, unknown>) {
	return mount(TextColorPopover, {
		props: {
			current: '#000000',
			presets: ['#ff0000', '#00ff00'],
			disabled: false,
			titleKey: 'pptx.text.fontColor',
		},
		...(global ? { global } : {}),
	});
}

describe('textColorPopover', () => {
	it('does not render a recent-colours row without an injected controller', () => {
		const wrapper = mountPopover();
		expect(wrapper.find('[data-testid="pptx-color-recent"]').exists()).toBeFalsy();
	});

	it('renders the recent-colours row from the injected list', () => {
		const recent = ref<string[]>(['#112233']);
		const wrapper = mountPopover({
			provide: { [RecentColorsKey as symbol]: { recent, push: () => {} } },
		});
		expect(wrapper.find('[data-testid="pptx-color-recent"]').exists()).toBeTruthy();
	});

	it('a preset swatch click both emits pick and pushes onto the recent-colours list', async () => {
		const recent = ref<string[]>([]);
		const push = (hex: string): void => {
			recent.value = [hex, ...recent.value.filter((c) => c !== hex)];
		};
		const wrapper = mountPopover({ provide: { [RecentColorsKey as symbol]: { recent, push } } });

		const presetSwatches = wrapper.findAll('button[data-pptx-compact]');
		await presetSwatches[0].trigger('click');

		expect(wrapper.emitted('pick')).toStrictEqual([['#ff0000']]);
		expect(recent.value).toStrictEqual(['#ff0000']);
	});

	it('clicking a recent-colours swatch commits it through the same pick path and re-pushes it to the front', async () => {
		const recent = ref<string[]>(['#112233', '#445566']);
		const push = (hex: string): void => {
			recent.value = [hex, ...recent.value.filter((c) => c !== hex)];
		};
		const wrapper = mountPopover({ provide: { [RecentColorsKey as symbol]: { recent, push } } });

		const recentSwatch = wrapper.findAll('[data-testid="pptx-color-recent"] button')[1];
		await recentSwatch.trigger('click');

		expect(wrapper.emitted('pick')).toStrictEqual([['#445566']]);
		expect(recent.value[0]).toBe('#445566');
	});

	it('a committed custom colour also pushes onto the recent-colours list', async () => {
		const recent = ref<string[]>([]);
		const push = (hex: string): void => {
			recent.value = [hex, ...recent.value.filter((c) => c !== hex)];
		};
		const wrapper = mountPopover({ provide: { [RecentColorsKey as symbol]: { recent, push } } });

		const customInput = wrapper.get('input[type="color"]');
		await customInput.setValue('#00ff00');

		expect(wrapper.emitted('pick')?.at(-1)).toStrictEqual(['#00ff00']);
		expect(recent.value[0]).toBe('#00ff00');
	});

	it('disables the trigger and every recent swatch when the picker is disabled', () => {
		const recent = ref<string[]>(['#112233']);
		const wrapper = mount(TextColorPopover, {
			props: {
				current: '#000000',
				presets: ['#ff0000'],
				disabled: true,
				titleKey: 'pptx.text.fontColor',
			},
			global: { provide: { [RecentColorsKey as symbol]: { recent, push: () => {} } } },
		});
		expect(wrapper.get('button').attributes('disabled')).toBeDefined();
		const recentSwatch = wrapper.get('[data-testid="pptx-color-recent"] button');
		expect((recentSwatch.element as HTMLButtonElement).disabled).toBeTruthy();
	});
});
