import type { PptxSlide } from 'pptx-viewer-core';
import { DEFAULT_COLOR_MAP } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createThemeOverrideCard } from './deck-theme-cards';
import type { InspectorDeckState } from './types';

/**
 * Mount the override card with an override already on the slide, which is what
 * makes it render one alias row (and therefore one slot picker) per alias.
 * The identity translator makes an option's text its i18n key.
 */
function mount() {
	const updateActiveSlide = vi.fn();
	const card = createThemeOverrideCard(document, (key) => key, { updateActiveSlide });
	const slide = {
		id: 's1',
		elements: [],
		clrMapOverride: { ...DEFAULT_COLOR_MAP },
	} as unknown as PptxSlide;
	card.update({
		slideCount: 1,
		currentSlide: 0,
		editable: true,
		activeSlide: slide,
		colorScheme: undefined,
	} as InspectorDeckState);
	const slot = card.el.querySelector<HTMLSelectElement>('.pptxv-field-select-input')!;
	return { card, updateActiveSlide, slot };
}

describe('theme override slot picker', () => {
	it('keeps the twelve `a:clrScheme` slot names as the option values', () => {
		const { slot } = mount();

		expect(Array.from(slot.options).map((option) => option.value)).toStrictEqual([
			'dk1',
			'lt1',
			'dk2',
			'lt2',
			'accent1',
			'accent2',
			'accent3',
			'accent4',
			'accent5',
			'accent6',
			'hlink',
			'folHlink',
		]);
	});

	it('spells the slots rather than showing `dk1` and `folHlink`', () => {
		const { slot } = mount();

		expect(Array.from(slot.options).map((option) => option.textContent)).toStrictEqual([
			'pptx.themeColor.dark1',
			'pptx.themeColor.light1',
			'pptx.themeColor.dark2',
			'pptx.themeColor.light2',
			'pptx.themeColor.accent1',
			'pptx.themeColor.accent2',
			'pptx.themeColor.accent3',
			'pptx.themeColor.accent4',
			'pptx.themeColor.accent5',
			'pptx.themeColor.accent6',
			'pptx.themeColor.hyperlink',
			'pptx.themeColor.followedHyperlink',
		]);
	});

	it('still stores the slot token in the colour map override', () => {
		const { slot, updateActiveSlide } = mount();

		slot.value = 'accent3';
		slot.dispatchEvent(new Event('change'));

		expect(updateActiveSlide).toHaveBeenCalledWith(
			expect.objectContaining({
				clrMapOverride: expect.objectContaining({ bg1: 'accent3' }),
			}),
		);
	});
});
