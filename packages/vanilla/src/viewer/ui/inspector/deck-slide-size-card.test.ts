import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createSlideSizeCard } from './deck-slide-size-card';
import type { SlideSizeHandlers } from './deck-slide-size-card';
import type { InspectorDeckState } from './types';

function makeHandlers() {
	return {
		updateCanvasSize: vi.fn<SlideSizeHandlers['updateCanvasSize']>(),
		updateSlideSize: vi.fn<SlideSizeHandlers['updateSlideSize']>(),
		applySlideSizeRescale: vi.fn<SlideSizeHandlers['applySlideSizeRescale']>(),
	} satisfies SlideSizeHandlers;
}

function makeDeckState(overrides: Partial<InspectorDeckState> = {}): InspectorDeckState {
	const slide = { id: 's1', rId: 'rId1', slideNumber: 1, elements: [] } as unknown as PptxSlide;
	return {
		slideCount: 1,
		currentSlide: 0,
		canvasSize: { width: 960, height: 540 },
		slideSize: { widthEmu: 9144000, heightEmu: 5143500, type: 'screen16x9' },
		hasDeckElements: false,
		elements: [],
		selectedIds: [],
		comments: [],
		docTitle: undefined,
		docAuthor: undefined,
		editable: true,
		presentationProperties: {},
		themeOptions: [],
		activeSlide: slide,
		editTemplateMode: false,
		slideMasters: [],
		colorScheme: undefined,
		fontScheme: undefined,
		themeName: undefined,
		tagCollections: [],
		notesCanvasSize: undefined,
		notesPlaceholderCount: undefined,
		handoutPlaceholderCount: undefined,
		...overrides,
	};
}

function mount() {
	const handlers = makeHandlers();
	const card = createSlideSizeCard(document, createTranslator(), handlers);
	return { card, handlers };
}

const PRESET_4X3 = { widthEmu: 9144000, heightEmu: 6858000, type: 'screen4x3' };

describe('slide size card rescale prompt', () => {
	it('adopts a new size directly on an empty deck', () => {
		const { card, handlers } = mount();
		card.update(makeDeckState({ hasDeckElements: false }));

		const preset = card.el.querySelector<HTMLSelectElement>('[data-pptx-slide-size-preset]')!;
		preset.value = 'screen4x3';
		preset.dispatchEvent(new Event('change'));

		expect(handlers.updateSlideSize).toHaveBeenCalledWith(
			expect.objectContaining({ widthEmu: PRESET_4X3.widthEmu, heightEmu: PRESET_4X3.heightEmu }),
		);
		expect(handlers.applySlideSizeRescale).not.toHaveBeenCalled();
	});

	it('shows the rescale prompt instead of adopting immediately on a deck with content', () => {
		const { card, handlers } = mount();
		card.update(makeDeckState({ hasDeckElements: true }));

		const prompt = card.el.querySelector<HTMLElement>('.pptxv-slide-size-rescale')!;
		expect(prompt.hidden).toBeTruthy();

		const preset = card.el.querySelector<HTMLSelectElement>('[data-pptx-slide-size-preset]')!;
		preset.value = 'screen4x3';
		preset.dispatchEvent(new Event('change'));

		expect(handlers.updateSlideSize).not.toHaveBeenCalled();
		expect(handlers.applySlideSizeRescale).not.toHaveBeenCalled();
		expect(prompt.hidden).toBeFalsy();
	});

	it('applies the rescale + size change together when Maximize is picked', () => {
		const { card, handlers } = mount();
		card.update(makeDeckState({ hasDeckElements: true }));

		const preset = card.el.querySelector<HTMLSelectElement>('[data-pptx-slide-size-preset]')!;
		preset.value = 'screen4x3';
		preset.dispatchEvent(new Event('change'));

		card.el
			.querySelector<HTMLButtonElement>('[data-testid="pptx-slide-size-rescale-maximize"]')!
			.click();

		expect(handlers.applySlideSizeRescale).toHaveBeenCalledWith(
			expect.objectContaining({ widthEmu: PRESET_4X3.widthEmu, heightEmu: PRESET_4X3.heightEmu }),
			'maximize',
		);
		const prompt = card.el.querySelector<HTMLElement>('.pptxv-slide-size-rescale')!;
		expect(prompt.hidden).toBeTruthy();
	});

	it('applies Ensure Fit mode when that button is picked', () => {
		const { card, handlers } = mount();
		card.update(makeDeckState({ hasDeckElements: true }));

		const preset = card.el.querySelector<HTMLSelectElement>('[data-pptx-slide-size-preset]')!;
		preset.value = 'screen4x3';
		preset.dispatchEvent(new Event('change'));

		card.el
			.querySelector<HTMLButtonElement>('[data-testid="pptx-slide-size-rescale-ensure-fit"]')!
			.click();

		expect(handlers.applySlideSizeRescale).toHaveBeenCalledWith(expect.anything(), 'ensureFit');
	});

	it('does not prompt when the picked size matches the current one', () => {
		const { card, handlers } = mount();
		card.update(
			makeDeckState({
				hasDeckElements: true,
				slideSize: PRESET_4X3,
				// Must agree with slideSize in pixels (9144000/9525 x 6858000/9525),
				// or resolveSlideSizeSelection falls back to a canvas-derived size.
				canvasSize: { width: 960, height: 720 },
			}),
		);

		const preset = card.el.querySelector<HTMLSelectElement>('[data-pptx-slide-size-preset]')!;
		preset.value = 'screen4x3';
		preset.dispatchEvent(new Event('change'));

		expect(handlers.updateSlideSize).toHaveBeenCalledWith(
			expect.objectContaining({ widthEmu: PRESET_4X3.widthEmu, heightEmu: PRESET_4X3.heightEmu }),
		);
		expect(handlers.applySlideSizeRescale).not.toHaveBeenCalled();
	});
});
