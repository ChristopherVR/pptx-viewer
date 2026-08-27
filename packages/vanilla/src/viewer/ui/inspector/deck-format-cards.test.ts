import type { PptxSlide, PptxTagCollection, PptxThemeColorScheme } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createSlideTransitionCard } from './slide-transition-card';
import { createTagsCard } from './tags-card';
import { createThemeEditorCard } from './theme-editor-card';
import type { InspectorDeckState } from './types';

function deckState(overrides: Partial<InspectorDeckState> = {}): InspectorDeckState {
	const slide = { id: 's1', elements: [] } as unknown as PptxSlide;
	return {
		slideCount: 1,
		currentSlide: 0,
		editable: true,
		activeSlide: slide,
		tagCollections: [],
		colorScheme: undefined,
		fontScheme: undefined,
		themeName: undefined,
		...overrides,
	} as InspectorDeckState;
}

describe('slide transition card', () => {
	it('patches the active slide transition type', () => {
		const updateActiveSlide = vi.fn();
		const card = createSlideTransitionCard(document, createTranslator(), { updateActiveSlide });
		card.update(deckState());

		const type = card.el.querySelector<HTMLSelectElement>('select')!;
		type.value = 'wipe';
		type.dispatchEvent(new Event('change'));

		expect(updateActiveSlide).toHaveBeenCalledWith({ transition: { type: 'wipe' } });
	});

	it('merges the duration onto the slide existing transition', () => {
		const updateActiveSlide = vi.fn();
		const card = createSlideTransitionCard(document, createTranslator(), { updateActiveSlide });
		card.update(
			deckState({
				activeSlide: {
					id: 's1',
					elements: [],
					transition: { type: 'push', direction: 'l', durationMs: 500 },
				} as unknown as PptxSlide,
			}),
		);

		const duration = card.el.querySelector<HTMLInputElement>(
			`input[aria-label="${createTranslator()('pptx.transition.duration')}"]`,
		)!;
		duration.value = '900';
		duration.dispatchEvent(new Event('change'));

		expect(updateActiveSlide).toHaveBeenCalledWith({
			transition: { type: 'push', direction: 'l', durationMs: 900 },
		});
	});

	it('offers a direction picker for a directional transition only', () => {
		const card = createSlideTransitionCard(document, createTranslator(), {
			updateActiveSlide: vi.fn(),
		});
		card.update(deckState());
		expect(card.el.querySelector<HTMLElement>('.pptxv-transition-directions')!.hidden).toBeTruthy();

		card.update(
			deckState({
				activeSlide: {
					id: 's1',
					elements: [],
					transition: { type: 'push' },
				} as unknown as PptxSlide,
			}),
		);
		expect(card.el.querySelectorAll('.pptxv-transition-dir').length).toBeGreaterThan(1);
	});

	it('picks an orientation for blinds instead of a direction', () => {
		const updateActiveSlide = vi.fn();
		const card = createSlideTransitionCard(document, createTranslator(), { updateActiveSlide });
		card.update(
			deckState({
				activeSlide: {
					id: 's1',
					elements: [],
					transition: { type: 'blinds' },
				} as unknown as PptxSlide,
			}),
		);

		const buttons = card.el.querySelectorAll<HTMLButtonElement>('.pptxv-transition-dir');
		// Titles read from the shared dictionary, not the raw OOXML token.
		expect(Array.from(buttons).map((button) => button.title)).toStrictEqual([
			'Horizontal',
			'Vertical',
		]);
		buttons[1].click();
		expect(updateActiveSlide).toHaveBeenCalledWith({
			transition: { type: 'blinds', orient: 'vert' },
		});
	});

	it('shows the speed select for every transition, defaulting to fast, and writes the choice', () => {
		const updateActiveSlide = vi.fn();
		const card = createSlideTransitionCard(document, createTranslator(), { updateActiveSlide });
		card.update(
			deckState({
				activeSlide: {
					id: 's1',
					elements: [],
					transition: { type: 'push', direction: 'l', durationMs: 500 },
				} as unknown as PptxSlide,
			}),
		);

		const speed = card.el.querySelector<HTMLSelectElement>(
			`select[aria-label="${createTranslator()('pptx.transition.speed')}"]`,
		)!;
		expect(speed.value).toBe('fast');

		speed.value = 'slow';
		speed.dispatchEvent(new Event('change'));

		expect(updateActiveSlide).toHaveBeenCalledWith({
			transition: { type: 'push', direction: 'l', durationMs: 500, speed: 'slow' },
		});
	});

	it('hides the morph-option select for a non-morph transition', () => {
		const card = createSlideTransitionCard(document, createTranslator(), {
			updateActiveSlide: vi.fn(),
		});
		card.update(
			deckState({
				activeSlide: {
					id: 's1',
					elements: [],
					transition: { type: 'fade', durationMs: 500 },
				} as unknown as PptxSlide,
			}),
		);

		const morphOption = card.el.querySelector<HTMLSelectElement>(
			`select[aria-label="${createTranslator()('pptx.transition.morphOption')}"]`,
		)!;
		expect(morphOption.parentElement!.hidden).toBeTruthy();
	});

	it('shows the morph-option select only for morph, defaulting to byObject, and writes the choice', () => {
		const updateActiveSlide = vi.fn();
		const card = createSlideTransitionCard(document, createTranslator(), { updateActiveSlide });
		card.update(
			deckState({
				activeSlide: {
					id: 's1',
					elements: [],
					transition: { type: 'morph', durationMs: 2000 },
				} as unknown as PptxSlide,
			}),
		);

		const morphOption = card.el.querySelector<HTMLSelectElement>(
			`select[aria-label="${createTranslator()('pptx.transition.morphOption')}"]`,
		)!;
		expect(morphOption.parentElement!.hidden).toBeFalsy();
		expect(morphOption.value).toBe('byObject');

		morphOption.value = 'byChar';
		morphOption.dispatchEvent(new Event('change'));

		expect(updateActiveSlide).toHaveBeenCalledWith({
			transition: { type: 'morph', durationMs: 2000, morphOption: 'byChar' },
		});
	});
});

describe('tags card', () => {
	const collections: PptxTagCollection[] = [
		{ path: 'ppt/tags/tag1.xml', tags: [{ name: 'OWNER', value: 'Ada' }] },
	];

	function expand(card: { el: HTMLElement }): void {
		card.el.querySelector<HTMLButtonElement>('.pptxv-tags-toggle')!.click();
	}

	it('starts collapsed and reports the tag count', () => {
		const card = createTagsCard(document, createTranslator(), { updateTagCollections: vi.fn() });
		card.update(deckState({ tagCollections: collections }));

		expect(card.el.querySelector<HTMLElement>('.pptxv-tags-count')!.textContent).toBe('1');
		expect(card.el.querySelector<HTMLElement>('.pptxv-tags-list')!.hidden).toBeTruthy();
	});

	it('edits a tag value in place', () => {
		const updateTagCollections = vi.fn();
		const card = createTagsCard(document, createTranslator(), { updateTagCollections });
		card.update(deckState({ tagCollections: collections }));
		expand(card);

		const inputs = card.el.querySelectorAll<HTMLInputElement>('.pptxv-tags-input');
		expect(inputs[0].value).toBe('OWNER');
		inputs[1].value = 'Grace';
		inputs[1].dispatchEvent(new Event('change'));

		expect(updateTagCollections).toHaveBeenCalledWith([
			{ path: 'ppt/tags/tag1.xml', tags: [{ name: 'OWNER', value: 'Grace' }] },
		]);
	});

	it('adds a tag to a deck that has no tag part yet', () => {
		const updateTagCollections = vi.fn();
		const card = createTagsCard(document, createTranslator(), { updateTagCollections });
		card.update(deckState({ tagCollections: [] }));
		expand(card);

		card.el.querySelector<HTMLButtonElement>('.pptxv-inspector-deck-btn')!.click();
		expect(updateTagCollections).toHaveBeenCalledWith([
			{ path: 'ppt/tags/tag1.xml', tags: [{ name: '', value: '' }] },
		]);
	});

	it('deletes a tag', () => {
		const updateTagCollections = vi.fn();
		const card = createTagsCard(document, createTranslator(), { updateTagCollections });
		card.update(deckState({ tagCollections: collections }));
		expand(card);

		card.el.querySelector<HTMLButtonElement>('.pptxv-tags-remove')!.click();
		expect(updateTagCollections).toHaveBeenCalledWith([{ path: 'ppt/tags/tag1.xml', tags: [] }]);
	});
});

describe('theme editor card', () => {
	it('seeds the 12 scheme swatches from the deck theme', () => {
		const card = createThemeEditorCard(document, createTranslator(), { applyThemeEdit: vi.fn() });
		card.update(
			deckState({
				colorScheme: { accent1: '#123456' } as PptxThemeColorScheme,
				themeName: 'Deck theme',
			}),
		);

		const swatches = card.el.querySelectorAll<HTMLInputElement>('.pptxv-theme-slot-input');
		expect(swatches).toHaveLength(12);
		expect(Array.from(swatches).some((input) => input.value === '#123456')).toBeTruthy();
		expect(card.el.querySelector<HTMLInputElement>('.pptxv-field-input')!.value).toBe('Deck theme');
	});

	it('applies staged colours and fonts only on Apply', () => {
		const applyThemeEdit = vi.fn();
		const card = createThemeEditorCard(document, createTranslator(), { applyThemeEdit });
		card.update(
			deckState({
				colorScheme: { accent1: '#123456' } as PptxThemeColorScheme,
				themeName: 'Deck theme',
			}),
		);

		const swatch = card.el.querySelectorAll<HTMLInputElement>('.pptxv-theme-slot-input')[0];
		swatch.value = '#0a0b0c';
		swatch.dispatchEvent(new Event('change'));
		expect(applyThemeEdit).not.toHaveBeenCalled();

		card.el.querySelector<HTMLButtonElement>('.pptxv-inspector-deck-btn')!.click();
		expect(applyThemeEdit).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'Deck theme',
				colorScheme: expect.objectContaining({ dk1: '#0a0b0c' }),
				fontScheme: {
					majorFont: { latin: 'Calibri Light' },
					minorFont: { latin: 'Calibri' },
				},
			}),
		);
	});

	it('stages a whole preset palette when a preset is picked', () => {
		const applyThemeEdit = vi.fn();
		const card = createThemeEditorCard(document, createTranslator(), { applyThemeEdit });
		card.update(deckState());

		const presets = card.el.querySelectorAll<HTMLButtonElement>('.pptxv-theme-preset');
		presets[1].click();
		card.el.querySelector<HTMLButtonElement>('.pptxv-inspector-deck-btn')!.click();

		expect(applyThemeEdit).toHaveBeenCalledWith(
			expect.objectContaining({ name: presets[1].title }),
		);
	});

	it('reverts staged edits on Reset', () => {
		const card = createThemeEditorCard(document, createTranslator(), { applyThemeEdit: vi.fn() });
		card.update(deckState({ themeName: 'Deck theme' }));

		const name = card.el.querySelector<HTMLInputElement>('.pptxv-field-input')!;
		name.value = 'Scratch';
		name.dispatchEvent(new Event('input'));
		const [, reset] = card.el.querySelectorAll<HTMLButtonElement>('.pptxv-inspector-deck-btn');
		reset.click();

		expect(name.value).toBe('Deck theme');
	});
});
