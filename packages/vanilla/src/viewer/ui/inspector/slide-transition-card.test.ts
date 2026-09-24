import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createSlideTransitionCard } from './slide-transition-card';
import type { InspectorDeckState, InspectorHandlers } from './types';

function makeDeckState(transition?: PptxSlideTransition): InspectorDeckState {
	const slide = {
		id: 's1',
		rId: 'rId1',
		slideNumber: 1,
		elements: [],
		transition,
	} as unknown as PptxSlide;
	return {
		slideCount: 1,
		currentSlide: 0,
		canvasSize: { width: 960, height: 540 },
		slideSize: { widthEmu: 9144000, heightEmu: 5143500, type: 'screen16x9' },
		hasDeckElements: false,
		elements: [],
		selectedIds: [],
		comments: [],
		commentMentionAuthors: [],
		customShows: [],
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
	};
}

function mount() {
	const updateActiveSlide = vi.fn<InspectorHandlers['updateActiveSlide']>();
	const card = createSlideTransitionCard(document, createTranslator(), { updateActiveSlide });
	return { card, updateActiveSlide };
}

function patternButtons(card: ReturnType<typeof createSlideTransitionCard>): HTMLButtonElement[] {
	return Array.from(card.el.querySelectorAll<HTMLButtonElement>('.pptxv-transition-pattern-btn'));
}

describe('vanilla slide transition card: pattern control', () => {
	it('offers diamond/hexagon for glitter and writes the chosen pattern', () => {
		const { card, updateActiveSlide } = mount();
		card.update(makeDeckState({ type: 'glitter', durationMs: 500 }));

		const labels = patternButtons(card).map((b) => b.textContent);
		expect(labels).toContain('Diamond');
		expect(labels).toContain('Hexagon');

		const hexagon = patternButtons(card).find((b) => b.textContent === 'Hexagon')!;
		hexagon.click();

		expect(updateActiveSlide).toHaveBeenCalledWith({
			transition: expect.objectContaining({ type: 'glitter', pattern: 'hexagon' }),
		});
	});

	it('offers strip/rectangle for shred', () => {
		const { card } = mount();
		card.update(makeDeckState({ type: 'shred', durationMs: 500 }));
		const labels = patternButtons(card).map((b) => b.textContent);
		expect(labels).toContain('Strips');
		expect(labels).toContain('Rectangles');
	});

	it('hides pattern for a type that has none', () => {
		const { card } = mount();
		card.update(makeDeckState({ type: 'wipe', durationMs: 500 }));
		expect(patternButtons(card)).toHaveLength(0);
	});
});

describe('vanilla slide transition card: thruBlk control', () => {
	function thruBlkLabel(card: ReturnType<typeof createSlideTransitionCard>): HTMLLabelElement {
		return Array.from(card.el.querySelectorAll<HTMLLabelElement>('label')).find((l) =>
			l.textContent?.includes('Through black'),
		)!;
	}

	it('shows and writes the Through Black checkbox for cut and fade', () => {
		const { card, updateActiveSlide } = mount();
		card.update(makeDeckState({ type: 'cut', durationMs: 500 }));

		const label = thruBlkLabel(card);
		expect(label.hidden).toBeFalsy();
		const checkbox = label.querySelector<HTMLInputElement>('pptx-ui-checkbox')!;
		expect(checkbox).toBeTruthy();
		checkbox.checked = true;
		checkbox.dispatchEvent(new Event('change', { bubbles: true }));

		expect(updateActiveSlide).toHaveBeenCalledWith({
			transition: expect.objectContaining({ type: 'cut', thruBlk: true }),
		});
	});

	it('hides Through Black for a type that does not support it', () => {
		const { card } = mount();
		card.update(makeDeckState({ type: 'blinds', durationMs: 500 }));
		expect(thruBlkLabel(card).hidden).toBeTruthy();
	});
});
