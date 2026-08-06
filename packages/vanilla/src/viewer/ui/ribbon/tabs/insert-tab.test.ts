import { CATEGORIES, INSERT_CHART_TYPES, PRESETS, SHAPE_PRESET_DEFS } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import type { RibbonInsertHandlers } from '../ribbon-types';
import { createInsertTab } from './insert-tab';

function makeHandlers(over: Partial<RibbonInsertHandlers> = {}): RibbonInsertHandlers {
	return {
		insert: vi.fn(),
		insertImage: vi.fn(),
		insertMedia: vi.fn(),
		insertChart: vi.fn(),
		insertSmartArt: vi.fn(),
		insertEquation: vi.fn(),
		insertActionButton: vi.fn(),
		insertField: vi.fn(),
		...over,
	};
}

describe('createInsertTab', () => {
	afterEach(() => document.body.replaceChildren());

	it('renders the React-aligned insert commands and a single SmartArt trigger', () => {
		const t = createTranslator();
		const tab = createInsertTab(document, t, makeHandlers(), vi.fn(), vi.fn(), vi.fn());
		// Top-level append order: text, shape picker, image, media, table, chart
		// picker, SmartArt, equation, action dropdown, field dropdown, hyperlink,
		// header.
		expect(tab.el.children).toHaveLength(12);
		expect(tab.el.querySelectorAll('[aria-label="SmartArt"]')).toHaveLength(1);
		expect(tab.el.querySelector('.pptxv-smartart-grid')).toBeNull();
		// The shape and chart pickers are select + commit pairs, like React's.
		const selects = tab.el.querySelectorAll<HTMLSelectElement>('.pptxv-select-button-select');
		expect(selects).toHaveLength(2);
		expect(selects[0].options).toHaveLength(SHAPE_PRESET_DEFS.length);
		expect(selects[1].options).toHaveLength(INSERT_CHART_TYPES.length);
		// Only the action-button and field pickers stay popover dropdowns.
		expect(tab.el.querySelectorAll('.pptxv-dropdown-trigger')).toHaveLength(2);
		for (const name of [
			'Text Box',
			'Shape type',
			'Shape',
			'Table',
			'Image',
			'Media',
			'Chart type',
			'Chart',
			'SmartArt',
			'Equation',
			'Action',
			'Field',
			'Hyperlink',
			'Header & Footer',
		]) {
			expect(tab.el.querySelector(`[aria-label="${name}"]`)).not.toBeNull();
		}
	});

	it('opens the hyperlink editor and needs a selection to be usable', () => {
		const onOpenHyperlink = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(document, t, makeHandlers(), vi.fn(), vi.fn(), onOpenHyperlink);
		const link = tab.el.querySelector<HTMLButtonElement>('[aria-label="Hyperlink"]');
		// A link always attaches to something, so an empty selection is enough to
		// rule the command out even on an editable deck.
		expect(link?.disabled).toBeTruthy();
		tab.setEditable(true);
		expect(link?.disabled).toBeTruthy();

		tab.setHasSelection(true);
		expect(link?.disabled).toBeFalsy();
		link?.click();
		expect(onOpenHyperlink).toHaveBeenCalledOnce();

		tab.setHasSelection(false);
		expect(link?.disabled).toBeTruthy();
	});

	it('dispatches insert("text") / insert("table") for the fixed buttons', () => {
		const insert = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(document, t, makeHandlers({ insert }), vi.fn(), vi.fn(), vi.fn());
		tab.el.querySelector<HTMLButtonElement>('[aria-label="Text Box"]')?.click();
		tab.el.querySelector<HTMLButtonElement>('[aria-label="Table"]')?.click();
		expect(insert).toHaveBeenCalledWith('text');
		expect(insert).toHaveBeenCalledWith('table');
	});

	it('inserts the shape type parked in the picker select', () => {
		const insert = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(document, t, makeHandlers({ insert }), vi.fn(), vi.fn(), vi.fn());
		const select = tab.el.querySelector<HTMLSelectElement>('.pptxv-select-button-select');
		if (!select) {
			throw new Error('no shape type select');
		}
		select.value = '2';
		tab.el.querySelector<HTMLButtonElement>('[aria-label="Shape"]')?.click();
		expect(insert).toHaveBeenCalledWith('shape', SHAPE_PRESET_DEFS[2].type);
	});

	it('calls insertImage() for the image button', () => {
		const insertImage = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(
			document,
			t,
			makeHandlers({ insertImage }),
			vi.fn(),
			vi.fn(),
			vi.fn(),
		);
		tab.el.querySelector<HTMLButtonElement>('[aria-label="Image"]')?.click();
		expect(insertImage).toHaveBeenCalledOnce();
	});

	it('calls insertMedia() for the media button', () => {
		const insertMedia = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(
			document,
			t,
			makeHandlers({ insertMedia }),
			vi.fn(),
			vi.fn(),
			vi.fn(),
		);
		tab.el.querySelector<HTMLButtonElement>('[aria-label="Media"]')?.click();
		expect(insertMedia).toHaveBeenCalledOnce();
	});

	it('inserts the chart kind parked in the picker select', () => {
		const insertChart = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(
			document,
			t,
			makeHandlers({ insertChart }),
			vi.fn(),
			vi.fn(),
			vi.fn(),
		);
		// The dropdown carries the entry id, not the raw chart family: Column and
		// Bar are two entries over the same 'bar' type and must stay distinct.
		const selects = tab.el.querySelectorAll<HTMLSelectElement>('.pptxv-select-button-select');
		const chartSelect = selects[1];
		expect([...chartSelect.options].map((option) => option.textContent)).toStrictEqual(
			INSERT_CHART_TYPES.map((ct) => t(ct.labelKey)),
		);
		tab.el.querySelector<HTMLButtonElement>('[aria-label="Chart"]')?.click();
		expect(insertChart).toHaveBeenCalledWith(INSERT_CHART_TYPES[0].id);

		insertChart.mockClear();
		const barIndex = INSERT_CHART_TYPES.findIndex((ct) => ct.id === 'bar');
		chartSelect.value = String(barIndex);
		tab.el.querySelector<HTMLButtonElement>('[aria-label="Chart"]')?.click();
		expect(insertChart).toHaveBeenCalledWith('bar');
	});

	it('opens the Header & Footer dialog', () => {
		const onOpenHeaderFooter = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(document, t, makeHandlers(), vi.fn(), onOpenHeaderFooter, vi.fn());
		tab.el.querySelector<HTMLButtonElement>('[aria-label="Header & Footer"]')?.click();
		expect(onOpenHeaderFooter).toHaveBeenCalledOnce();
	});

	it('calls onToggleEquationPanel for the equation button', () => {
		const onToggleEquationPanel = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(
			document,
			t,
			makeHandlers(),
			onToggleEquationPanel,
			vi.fn(),
			vi.fn(),
		);
		tab.el.querySelector<HTMLButtonElement>('[aria-label="Equation"]')?.click();
		expect(onToggleEquationPanel).toHaveBeenCalledOnce();
	});

	it('opens an accessible SmartArt dialog and confirms the selected layout', () => {
		const insertSmartArt = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(
			document,
			t,
			makeHandlers({ insertSmartArt }),
			vi.fn(),
			vi.fn(),
			vi.fn(),
		);
		tab.el.querySelector<HTMLButtonElement>('[aria-label="SmartArt"]')?.click();

		const dialog = document.querySelector<HTMLElement>(
			'[role="dialog"][aria-label="Insert SmartArt"]',
		);
		expect(dialog).not.toBeNull();
		expect(dialog?.parentElement?.hidden).toBeFalsy();
		expect(dialog?.querySelector('[role="listbox"][aria-label="SmartArt layouts"]')).not.toBeNull();
		const option = dialog?.querySelector<HTMLButtonElement>('[role="option"]');
		const insertButton = Array.from(
			dialog?.querySelectorAll<HTMLButtonElement>('button') ?? [],
		).find((button) => button.textContent === 'Insert');
		expect(option?.getAttribute('aria-selected')).toBe('false');
		expect(insertButton?.disabled).toBeTruthy();

		option?.click();
		expect(option?.getAttribute('aria-selected')).toBe('true');
		expect(insertButton?.disabled).toBeFalsy();
		insertButton?.click();
		expect(insertSmartArt).toHaveBeenCalledWith(PRESETS[0].layout, PRESETS[0].defaultItems);
		expect(dialog?.parentElement?.hidden).toBeTruthy();
	});

	it('filters SmartArt layouts by category and resets selection', () => {
		const t = createTranslator();
		const tab = createInsertTab(document, t, makeHandlers(), vi.fn(), vi.fn(), vi.fn());
		tab.el.querySelector<HTMLButtonElement>('[aria-label="SmartArt"]')?.click();
		const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
		const firstOption = dialog?.querySelector<HTMLButtonElement>('[role="option"]');
		firstOption?.click();

		const category = CATEGORIES[1];
		const categoryButton = Array.from(
			dialog?.querySelectorAll<HTMLButtonElement>('.pptxv-smartart-category') ?? [],
		).find((button) => button.dataset.category === category.id);
		categoryButton?.click();

		const expected = PRESETS.filter((preset) => preset.category === category.id);
		const options = dialog?.querySelectorAll<HTMLElement>('[role="option"]') ?? [];
		expect(options).toHaveLength(expected.length);
		expect(
			Array.from(options).every((option) => option.getAttribute('aria-selected') === 'false'),
		).toBeTruthy();
		const insertButton = Array.from(
			dialog?.querySelectorAll<HTMLButtonElement>('button') ?? [],
		).find((button) => button.textContent === 'Insert');
		expect(insertButton?.disabled).toBeTruthy();
	});

	it('cancels SmartArt insertion without calling the handler', () => {
		const insertSmartArt = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(
			document,
			t,
			makeHandlers({ insertSmartArt }),
			vi.fn(),
			vi.fn(),
			vi.fn(),
		);
		tab.el.querySelector<HTMLButtonElement>('[aria-label="SmartArt"]')?.click();
		const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
		dialog?.querySelector<HTMLButtonElement>('[role="option"]')?.click();
		const cancelButton = Array.from(
			dialog?.querySelectorAll<HTMLButtonElement>('button') ?? [],
		).find((button) => button.textContent === 'Cancel');
		cancelButton?.click();

		expect(insertSmartArt).not.toHaveBeenCalled();
		expect(dialog?.parentElement?.hidden).toBeTruthy();
	});

	it('dispatches insertActionButton(type) from the action-button dropdown', () => {
		const insertActionButton = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(
			document,
			t,
			makeHandlers({ insertActionButton }),
			vi.fn(),
			vi.fn(),
			vi.fn(),
		);
		const item = tab.el
			.querySelectorAll('.pptxv-dropdown')[0]
			.querySelector<HTMLButtonElement>('.pptxv-dropdown-item');
		expect(item).not.toBeNull();
		item?.click();
		expect(insertActionButton).toHaveBeenCalledOnce();
	});

	it('dispatches insertField(type) from the field dropdown', () => {
		const insertField = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(
			document,
			t,
			makeHandlers({ insertField }),
			vi.fn(),
			vi.fn(),
			vi.fn(),
		);
		const dropdowns = tab.el.querySelectorAll('.pptxv-dropdown');
		const fieldDropdown = dropdowns[dropdowns.length - 1];
		const item = fieldDropdown.querySelector<HTMLButtonElement>('.pptxv-dropdown-item');
		item?.click();
		expect(insertField).toHaveBeenCalledOnce();
	});

	it('setEditable disables/enables every button (dropdown triggers gate their menu items)', () => {
		const t = createTranslator();
		const tab = createInsertTab(document, t, makeHandlers(), vi.fn(), vi.fn(), vi.fn());
		// Dropdown menu items aren't individually disabled: a disabled trigger
		// can't be opened, so its items are unreachable (see dropdown.ts).
		// Hyperlink is excluded too: it tracks the selection, not editability.
		const gatedButtons = tab.el.querySelectorAll<HTMLButtonElement>(
			'button:not(.pptxv-dropdown-item):not([aria-label="Hyperlink"])',
		);
		expect(gatedButtons.length).toBeGreaterThan(0);

		tab.setEditable(false);
		expect(Array.from(gatedButtons).every((b) => b.disabled)).toBeTruthy();

		tab.setEditable(true);
		expect(Array.from(gatedButtons).every((b) => !b.disabled)).toBeTruthy();
	});
});
