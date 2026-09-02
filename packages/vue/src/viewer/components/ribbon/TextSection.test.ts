import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { RecentColorsKey } from '../../composables/recent-colors-context';
import TextSection from './TextSection.vue';

/**
 * TextSection: the ribbon Home "Font" group (wave-4 B6 "Recent colours"
 * parity, surface A4: the font-colour popover). The font-colour popover is
 * built on the shared `TextColorPopover`, which owns the recent-colours row;
 * this only pins that it is actually wired up here with the injected
 * recent-colours list, and that a colour pick both updates the text style and
 * folds the colour into the list.
 */
function textShape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 't1',
		type: 'text',
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		text: 'hi',
		textStyle: { color: '#000000' },
		...overrides,
	} as PptxElement;
}

function mountSection(props: Record<string, unknown> = {}, global?: Record<string, unknown>) {
	return mount(TextSection, {
		props: {
			canEdit: true,
			selectedElement: textShape(),
			onUpdateTextStyle: vi.fn(),
			onTransformTextCase: vi.fn(),
			...props,
		},
		...(global ? { global } : {}),
	});
}

describe('textSection font-colour popover', () => {
	it('offers the recent-colours row when a controller is injected', () => {
		const recent = ref<string[]>(['#112233']);
		const wrapper = mountSection(
			{},
			{ provide: { [RecentColorsKey as symbol]: { recent, push: () => {} } } },
		);
		expect(wrapper.find('[data-testid="pptx-color-recent"]').exists()).toBeTruthy();
	});

	it('picking a recent swatch updates the text style AND re-pushes the colour to the front', async () => {
		const recent = ref<string[]>(['#112233', '#445566']);
		const push = (hex: string): void => {
			recent.value = [hex, ...recent.value.filter((c) => c !== hex)];
		};
		const onUpdateTextStyle = vi.fn();
		const wrapper = mountSection(
			{ onUpdateTextStyle },
			{ provide: { [RecentColorsKey as symbol]: { recent, push } } },
		);

		const recentSwatch = wrapper.findAll('[data-testid="pptx-color-recent"] button')[1];
		await recentSwatch.trigger('click');

		expect(onUpdateTextStyle).toHaveBeenCalledWith({ color: '#445566' });
		expect(recent.value[0]).toBe('#445566');
	});

	it('renders no recent-colours row without an injected controller', () => {
		const wrapper = mountSection();
		expect(wrapper.find('[data-testid="pptx-color-recent"]').exists()).toBeFalsy();
	});
});
