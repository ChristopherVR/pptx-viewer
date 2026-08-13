/**
 * SlideSizeCard.test.ts: the Design > Slide Size controls.
 *
 * The card used to offer only raw W/H pixel inputs, so a deck could not be set
 * to a named PowerPoint size at all and nothing carried the `p:sldSz/@type`
 * that names it. Preset and orientation now emit an EMU size alongside the
 * pixel canvas, because deriving one from the other is lossy.
 */
import { mount } from '@vue/test-utils';
import { SLIDE_SIZE_PRESETS, slideSizeFromPreset } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import SlideSizeCard from './SlideSizeCard.vue';

/** A 16:9 widescreen deck: 12192000 x 6858000 EMU. */
const WIDESCREEN = { widthEmu: 12192000, heightEmu: 6858000, type: '' };
const WIDESCREEN_PX = { width: 1280, height: 720 };

function mountCard(props: Record<string, unknown> = {}) {
	return mount(SlideSizeCard, {
		props: { canvasSize: WIDESCREEN_PX, slideSize: WIDESCREEN, ...props },
	});
}

describe('slide size card', () => {
	it('offers every shared preset and selects the one the deck matches', () => {
		const wrapper = mountCard();
		const select = wrapper.get('[data-pptx-slide-size-preset]');
		expect(select.findAll('option')).toHaveLength(SLIDE_SIZE_PRESETS.length);
		expect((select.element as HTMLSelectElement).value).toBe('widescreen');
	});

	it('emits the EMU size and the pixel canvas when a preset is picked', async () => {
		const wrapper = mountCard();
		await wrapper.get('[data-pptx-slide-size-preset]').setValue('ledger');
		// Ledger is 12179300 EMU = 1278.5px: the EMU value must be carried
		// verbatim, not recovered from the rounded pixel width.
		expect(wrapper.emitted('update-slide-size')?.[0]).toStrictEqual([
			{ widthEmu: 12179300, heightEmu: 9134475, type: 'ledger' },
			{ width: 1279, height: 959 },
		]);
	});

	it('swaps the pair for portrait and keeps the preset type', async () => {
		const wrapper = mountCard();
		await wrapper.get('[data-pptx-slide-size-orientation="portrait"]').trigger('click');
		expect(wrapper.emitted('update-slide-size')?.[0]?.[0]).toStrictEqual({
			widthEmu: 6858000,
			heightEmu: 12192000,
			type: '',
		});
	});

	it('marks the orientation the deck is currently in', () => {
		const portrait = slideSizeFromPreset(
			SLIDE_SIZE_PRESETS.find((p) => p.labelKey === 'a4')!,
			'portrait',
		);
		const wrapper = mountCard({
			slideSize: portrait,
			canvasSize: { width: 720, height: 1040 },
		});
		expect(
			wrapper.get('[data-pptx-slide-size-orientation="portrait"]').attributes('aria-pressed'),
		).toBe('true');
		expect(
			wrapper.get('[data-pptx-slide-size-orientation="landscape"]').attributes('aria-pressed'),
		).toBe('false');
	});

	it('shows a Custom entry only for a size no preset matches', async () => {
		const matched = mountCard();
		expect(matched.findAll('option').some((o) => o.text() === 'Custom')).toBeFalsy();

		const custom = mountCard({
			slideSize: { widthEmu: 7000000, heightEmu: 4000000, type: '' },
			canvasSize: { width: 735, height: 420 },
		});
		expect(custom.findAll('option').some((o) => o.text() === 'Custom')).toBeTruthy();
		expect((custom.get('[data-pptx-slide-size-preset]').element as HTMLSelectElement).value).toBe(
			'',
		);
	});

	it('still emits raw pixel edits from the W/H inputs', async () => {
		const wrapper = mountCard();
		await wrapper.findAll('input[type="number"]')[0].setValue('960');
		expect(wrapper.emitted('update')?.[0]).toStrictEqual([{ width: 960, height: 720 }]);
	});
});
