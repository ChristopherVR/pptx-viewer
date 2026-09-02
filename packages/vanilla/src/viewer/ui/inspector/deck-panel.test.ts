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
		updateSlideSize: vi.fn<DeckPanelHandlers['updateSlideSize']>(),
		applySlideSizeRescale: vi.fn<DeckPanelHandlers['applySlideSizeRescale']>(),
		setTemplateBackground: vi.fn<DeckPanelHandlers['setTemplateBackground']>(),
		getTemplateBackgroundColor: vi.fn<DeckPanelHandlers['getTemplateBackgroundColor']>(),
	} satisfies DeckPanelHandlers;
}

function makeDeckState(overrides: Partial<InspectorDeckState> = {}): InspectorDeckState {
	const slide = { id: 's1', rId: 'rId1', slideNumber: 1, elements: [] } as unknown as PptxSlide;
	return {
		slideCount: 2,
		currentSlide: 0,
		canvasSize: { width: 960, height: 540 },
		slideSize: { widthEmu: 9144000, heightEmu: 5143500, type: 'screen16x9' },
		hasDeckElements: false,
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
		editTemplateMode: false,
		slideMasters: [],
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

/** Ledger: 12179300 x 9134475 EMU, the preset a pixel round-trip destroys. */
const LEDGER = { widthEmu: 12179300, heightEmu: 9134475, type: 'ledger' };

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
			t('pptx.slideBackground.templateBackgroundsHeading'),
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

		const sizeSection = panel.el.querySelectorAll('.pptxv-inspector-section')[6];
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

	/**
	 * PowerPoint sizes a slide by PRESET first and by raw dimensions second. The
	 * card shipped with only the two pixel inputs, so the sixteen presets and the
	 * Landscape/Portrait toggle were unreachable in this binding.
	 */
	it('offers the preset dropdown and the orientation toggle in EMU', () => {
		const handlers = makeHandlers();
		const panel = createDeckPanel(document, createTranslator(), handlers);
		panel.update(makeDeckState({ slideSize: LEDGER, canvasSize: { width: 1279, height: 959 } }));

		const sizeSection = panel.el.querySelectorAll('.pptxv-inspector-section')[6];
		const preset = sizeSection.querySelector<HTMLSelectElement>('[data-pptx-slide-size-preset]')!;
		expect(preset.value).toBe('ledger');

		preset.value = 'a4';
		preset.dispatchEvent(new Event('change'));
		expect(handlers.updateSlideSize).toHaveBeenCalledWith({
			widthEmu: 9906000,
			heightEmu: 6858000,
			type: 'A4',
		});

		const portrait = sizeSection.querySelector<HTMLButtonElement>(
			'[data-pptx-slide-size-orientation="portrait"]',
		)!;
		expect(
			sizeSection
				.querySelector('[data-pptx-slide-size-orientation="landscape"]')!
				.getAttribute('aria-pressed'),
		).toBe('true');
		portrait.click();
		// Portrait swaps cx/cy and keeps the type, exactly as PowerPoint does.
		expect(handlers.updateSlideSize).toHaveBeenLastCalledWith({
			widthEmu: LEDGER.heightEmu,
			heightEmu: LEDGER.widthEmu,
			type: 'ledger',
		});
	});

	it('falls back to a Custom entry for a size no preset matches', () => {
		const panel = createDeckPanel(document, createTranslator(), makeHandlers());
		panel.update(makeDeckState({ slideSize: undefined, canvasSize: { width: 800, height: 600 } }));

		const preset = panel.el
			.querySelectorAll('.pptxv-inspector-section')[6]
			.querySelector<HTMLSelectElement>('[data-pptx-slide-size-preset]')!;
		expect(preset.value).toBe('__custom__');
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

		const notesSection = panel.el.querySelectorAll<HTMLElement>('.pptxv-inspector-section')[7];
		const values = Array.from(
			notesSection.querySelectorAll<HTMLElement>('.pptxv-inspector-row-value'),
		).map((el) => el.textContent);
		expect(values[0]).toBe('720 × 960px');
		expect(values[1]).toContain('3');
		expect(values[2]).toBe(t('pptx.digitalSignatures.notAvailable'));
	});

	/**
	 * The SLIDE BACKGROUND card's template rows: React/Vue/Angular's shortcut
	 * to edit the active slide's LAYOUT and MASTER background colour directly,
	 * without leaving the slide for the separate Master Views overlay. Vanilla
	 * had no path to this at all before.
	 */
	describe('template backgrounds (edit-template-mode shortcut)', () => {
		const slideWithLayout = {
			id: 's1',
			rId: 'rId1',
			slideNumber: 1,
			elements: [],
			layoutPath: 'ppt/slideLayouts/slideLayout1.xml',
			layoutName: 'Title Slide',
		} as unknown as PptxSlide;

		const master = {
			path: 'ppt/slideMasters/slideMaster1.xml',
			name: 'Office Theme',
			layoutPaths: ['ppt/slideLayouts/slideLayout1.xml'],
		};

		function backgroundSection(panel: ReturnType<typeof createDeckPanel>): HTMLElement {
			return panel.el.querySelectorAll<HTMLElement>('.pptxv-inspector-section')[4];
		}

		it('stays hidden while editTemplateMode is off, even with a layout/master to edit', () => {
			const panel = createDeckPanel(document, createTranslator(), makeHandlers());
			panel.update(
				makeDeckState({
					activeSlide: slideWithLayout,
					slideMasters: [master],
					editTemplateMode: false,
				}),
			);

			expect(backgroundSection(panel).hidden).toBeTruthy();
		});

		it('shows a row per layout/master once editTemplateMode is on', () => {
			const t = createTranslator();
			const panel = createDeckPanel(document, t, makeHandlers());
			panel.update(
				makeDeckState({
					activeSlide: slideWithLayout,
					slideMasters: [master],
					editTemplateMode: true,
				}),
			);

			const section = backgroundSection(panel);
			expect(section.hidden).toBeFalsy();
			const labels = Array.from(
				section.querySelectorAll<HTMLElement>('.pptxv-inspector-row-value'),
			).map((el) => el.textContent);
			expect(labels).toStrictEqual(['Title Slide', 'Office Theme']);
		});

		it('reads the current colour and commits a change to the right path', () => {
			const handlers = makeHandlers();
			(handlers.getTemplateBackgroundColor as ReturnType<typeof vi.fn>).mockReturnValue('#336699');
			const panel = createDeckPanel(document, createTranslator(), handlers);
			panel.update(
				makeDeckState({
					activeSlide: slideWithLayout,
					slideMasters: [master],
					editTemplateMode: true,
				}),
			);

			const inputs =
				backgroundSection(panel).querySelectorAll<HTMLInputElement>('input[type="color"]');
			expect(inputs[0].value).toBe('#336699');

			inputs[0].value = '#ff0000';
			inputs[0].dispatchEvent(new Event('change'));
			expect(handlers.setTemplateBackground).toHaveBeenCalledWith(
				'ppt/slideLayouts/slideLayout1.xml',
				'#ff0000',
			);
		});

		it('stays hidden when the slide has no layout path (nothing to edit)', () => {
			const panel = createDeckPanel(document, createTranslator(), makeHandlers());
			panel.update(makeDeckState({ editTemplateMode: true }));

			expect(backgroundSection(panel).hidden).toBeTruthy();
		});
	});
});
