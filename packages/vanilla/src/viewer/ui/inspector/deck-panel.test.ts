import { DEFAULT_COLOR_MAP } from 'pptx-viewer-core';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import type { DeckPanelHandlers } from './deck-panel';
import { createDeckPanel } from './deck-panel';
import type { InspectorDeckState } from './types';

function makeHandlers() {
	return {
		openDocumentProperties: vi.fn<DeckPanelHandlers['openDocumentProperties']>(),
		updatePresentationSettings: vi.fn<DeckPanelHandlers['updatePresentationSettings']>(),
		applyThemeByPath: vi.fn<DeckPanelHandlers['applyThemeByPath']>(),
		applyThemeEdit: vi.fn<DeckPanelHandlers['applyThemeEdit']>(),
		updateTagCollections: vi.fn<DeckPanelHandlers['updateTagCollections']>(),
		updateActiveSlide: vi.fn<DeckPanelHandlers['updateActiveSlide']>(),
		updateCanvasSize: vi.fn<DeckPanelHandlers['updateCanvasSize']>(),
	} satisfies DeckPanelHandlers;
}

function makeDeckState(overrides: Partial<InspectorDeckState> = {}): InspectorDeckState {
	const slide = { id: 's1', rId: 'rId1', slideNumber: 1, elements: [] } as unknown as PptxSlide;
	return {
		slideCount: 2,
		currentSlide: 0,
		canvasSize: { width: 960, height: 540 },
		elements: [],
		selectedIds: [],
		comments: [],
		docTitle: 'Deck',
		docAuthor: 'Author',
		editable: true,
		presentationProperties: {},
		themeOptions: [
			{ path: 'ppt/theme/theme1.xml', name: 'Office' },
			{ path: 'ppt/theme/theme2.xml', name: 'Vermilion' },
		],
		activeSlide: slide,
		colorScheme: undefined,
		fontScheme: undefined,
		themeName: undefined,
		tagCollections: [],
		notesCanvasSize: { width: 720, height: 960 },
		notesPlaceholderCount: 3,
		handoutPlaceholderCount: undefined,
		...overrides,
	};
}

describe('deck panel (no-selection Properties tab)', () => {
	it('renders the React section order: presentation, theme, theme editor, override, transition, size, notes, document, tags', () => {
		const t = createTranslator();
		const panel = createDeckPanel(document, t, makeHandlers());
		panel.update(makeDeckState());

		const titles = Array.from(
			panel.el.querySelectorAll<HTMLElement>('.pptxv-inspector-section-title'),
		).map((el) => el.textContent);
		expect(titles).toStrictEqual([
			t('pptx.slideInspector.presentation'),
			t('pptx.documentProperties.themeHeading'),
			t('pptx.themeEditor.title'),
			t('pptx.themeOverride.heading'),
			t('pptx.slideInspector.slideTransition'),
			t('pptx.slideSize.title'),
			t('pptx.documentProperties.notesHandoutHeading'),
			t('pptx.documentProperties.documentHeading'),
			t('pptx.tags.title'),
		]);
	});

	it('applies the selected theme to the first or all masters', () => {
		const handlers = makeHandlers();
		const panel = createDeckPanel(document, createTranslator(), handlers);
		panel.update(makeDeckState());

		const select = panel.el.querySelector<HTMLSelectElement>('.pptxv-inspector-theme-select');
		expect(select).not.toBeNull();
		expect(Array.from(select!.options).map((o) => o.value)).toStrictEqual([
			'ppt/theme/theme1.xml',
			'ppt/theme/theme2.xml',
		]);
		select!.value = 'ppt/theme/theme2.xml';

		const buttons = panel.el.querySelectorAll<HTMLButtonElement>(
			'.pptxv-inspector-deck-btn-row .pptxv-inspector-deck-btn',
		);
		buttons[0].click();
		buttons[1].click();
		expect(handlers.applyThemeByPath).toHaveBeenNthCalledWith(1, 'ppt/theme/theme2.xml', false);
		expect(handlers.applyThemeByPath).toHaveBeenNthCalledWith(2, 'ppt/theme/theme2.xml', true);
	});

	it('commits slide-size edits and disables the fields when not editable', () => {
		const handlers = makeHandlers();
		const panel = createDeckPanel(document, createTranslator(), handlers);
		panel.update(makeDeckState());

		const sizeSection = panel.el.querySelectorAll('.pptxv-inspector-section')[5];
		const inputs = sizeSection.querySelectorAll<HTMLInputElement>('input[type="number"]');
		expect(inputs[0].value).toBe('960');
		expect(inputs[1].value).toBe('540');

		inputs[0].value = '1280';
		inputs[0].dispatchEvent(new Event('change'));
		expect(handlers.updateCanvasSize).toHaveBeenCalledWith({ width: 1280, height: 540 });

		panel.update(makeDeckState({ editable: false }));
		expect(inputs[0].disabled).toBeTruthy();
		expect(inputs[1].disabled).toBeTruthy();
	});

	it('edits presentation settings from the PRESENTATION card', () => {
		const handlers = makeHandlers();
		const panel = createDeckPanel(document, createTranslator(), handlers);
		panel.update(makeDeckState());

		const checkboxes = panel.el
			.querySelectorAll('.pptxv-inspector-section')[0]
			.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
		checkboxes[0].checked = true;
		checkboxes[0].dispatchEvent(new Event('change'));
		expect(handlers.updatePresentationSettings).toHaveBeenCalledWith({ loopContinuously: true });

		const showType = panel.el
			.querySelectorAll('.pptxv-inspector-section')[0]
			.querySelector<HTMLSelectElement>('select');
		showType!.value = 'kiosk';
		showType!.dispatchEvent(new Event('change'));
		expect(handlers.updatePresentationSettings).toHaveBeenCalledWith({ showType: 'kiosk' });
	});

	it('toggles the per-slide theme override with the default colour map', () => {
		const handlers = makeHandlers();
		const panel = createDeckPanel(document, createTranslator(), handlers);
		panel.update(makeDeckState());

		const overrideSection = panel.el.querySelectorAll<HTMLElement>('.pptxv-inspector-section')[3];
		const toggle = overrideSection.querySelector<HTMLInputElement>('input[type="checkbox"]');
		expect(overrideSection.querySelectorAll('.pptxv-inspector-override-row')).toHaveLength(0);

		toggle!.checked = true;
		toggle!.dispatchEvent(new Event('change'));
		expect(handlers.updateActiveSlide).toHaveBeenCalledWith({
			clrMapOverride: { ...DEFAULT_COLOR_MAP },
		});

		// With an active override, one remapping row renders per alias key.
		const slide = {
			id: 's1',
			rId: 'rId1',
			slideNumber: 1,
			elements: [],
			clrMapOverride: { ...DEFAULT_COLOR_MAP },
		} as unknown as PptxSlide;
		panel.update(makeDeckState({ activeSlide: slide }));
		expect(
			overrideSection.querySelectorAll('.pptxv-inspector-override-row').length,
		).toBeGreaterThan(0);
	});

	it('shows notes and handout availability read-only', () => {
		const t = createTranslator();
		const panel = createDeckPanel(document, t, makeHandlers());
		panel.update(makeDeckState());

		const notesSection = panel.el.querySelectorAll<HTMLElement>('.pptxv-inspector-section')[6];
		const values = Array.from(
			notesSection.querySelectorAll<HTMLElement>('.pptxv-inspector-row-value'),
		).map((el) => el.textContent);
		expect(values[0]).toBe('720 × 960px');
		expect(values[1]).toContain('3');
		expect(values[2]).toBe(t('pptx.digitalSignatures.notAvailable'));
	});
});
