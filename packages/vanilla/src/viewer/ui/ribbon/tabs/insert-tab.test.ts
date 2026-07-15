import { CATEGORIES, PRESETS, SHAPE_PRESET_DEFS } from 'pptx-viewer-shared';
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
		const tab = createInsertTab(document, t, makeHandlers(), vi.fn());
		// Top-level append order: text, table, image, media, chart-dropdown, SmartArt,
		// equation, action-button-dropdown, field-dropdown, shape grid.
		expect(tab.el.children).toHaveLength(10);
		const shapeGrid = tab.el.querySelectorAll('.pptxv-shape-grid button');
		const dropdownTriggers = tab.el.querySelectorAll('.pptxv-dropdown-trigger');
		expect(shapeGrid).toHaveLength(SHAPE_PRESET_DEFS.length);
		expect(tab.el.querySelectorAll('[aria-label="SmartArt"]')).toHaveLength(1);
		expect(tab.el.querySelector('.pptxv-smartart-grid')).toBeNull();
		// chart, action-button, and field are all dropdowns.
		expect(dropdownTriggers).toHaveLength(3);
		for (const name of [
			'Text Box',
			'Table',
			'Image',
			'Media',
			'Chart',
			'SmartArt',
			'Equation',
			'Action',
			'Field',
		]) {
			expect(tab.el.querySelector(`[aria-label="${name}"]`)).not.toBeNull();
		}
	});

	it('dispatches insert("text") / insert("table") for the fixed buttons', () => {
		const insert = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(document, t, makeHandlers({ insert }), vi.fn());
		const [textBox, table] = tab.el.querySelectorAll<HTMLButtonElement>('button');
		textBox.click();
		table.click();
		expect(insert).toHaveBeenCalledWith('text');
		expect(insert).toHaveBeenCalledWith('table');
	});

	it('dispatches insert("shape", type) for each shape grid button', () => {
		const insert = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(document, t, makeHandlers({ insert }), vi.fn());
		const shapeButtons = tab.el.querySelectorAll<HTMLButtonElement>('.pptxv-shape-grid button');
		expect(shapeButtons).toHaveLength(SHAPE_PRESET_DEFS.length);
		shapeButtons[0].click();
		expect(insert).toHaveBeenCalledWith('shape', SHAPE_PRESET_DEFS[0].type);
	});

	it('calls insertImage() for the image button', () => {
		const insertImage = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(document, t, makeHandlers({ insertImage }), vi.fn());
		const image = tab.el.querySelectorAll<HTMLButtonElement>('button')[2];
		image.click();
		expect(insertImage).toHaveBeenCalledOnce();
	});

	it('calls insertMedia() for the media button', () => {
		const insertMedia = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(document, t, makeHandlers({ insertMedia }), vi.fn());
		const media = tab.el.querySelectorAll<HTMLButtonElement>('button')[3];
		media.click();
		expect(insertMedia).toHaveBeenCalledOnce();
	});

	it('dispatches insertChart(type) from the chart dropdown', () => {
		const insertChart = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(document, t, makeHandlers({ insertChart }), vi.fn());
		const chartItem = tab.el.querySelector<HTMLButtonElement>('.pptxv-dropdown-item');
		expect(chartItem).not.toBeNull();
		chartItem?.click();
		expect(insertChart).toHaveBeenCalledOnce();
	});

	it('calls onToggleEquationPanel for the equation button', () => {
		const onToggleEquationPanel = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(document, t, makeHandlers(), onToggleEquationPanel);
		// Top-level append order includes SmartArt between chart and equation.
		const equationBtn = tab.el.children[6] as HTMLButtonElement;
		expect(equationBtn.tagName).toBe('BUTTON');
		equationBtn.click();
		expect(onToggleEquationPanel).toHaveBeenCalledOnce();
	});

	it('opens an accessible SmartArt dialog and confirms the selected layout', () => {
		const insertSmartArt = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(document, t, makeHandlers({ insertSmartArt }), vi.fn());
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
		const tab = createInsertTab(document, t, makeHandlers(), vi.fn());
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
		const tab = createInsertTab(document, t, makeHandlers({ insertSmartArt }), vi.fn());
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
		const tab = createInsertTab(document, t, makeHandlers({ insertActionButton }), vi.fn());
		// Top-level append order: ... SmartArt(5), equation(6), action(7), field(8).
		const actionButtonDropdown = tab.el.children[7];
		const item = actionButtonDropdown.querySelector<HTMLButtonElement>('.pptxv-dropdown-item');
		expect(item).not.toBeNull();
		item?.click();
		expect(insertActionButton).toHaveBeenCalledOnce();
	});

	it('dispatches insertField(type) from the field dropdown', () => {
		const insertField = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(document, t, makeHandlers({ insertField }), vi.fn());
		const dropdowns = tab.el.querySelectorAll('.pptxv-dropdown');
		const fieldDropdown = dropdowns[dropdowns.length - 1];
		const item = fieldDropdown.querySelector<HTMLButtonElement>('.pptxv-dropdown-item');
		item?.click();
		expect(insertField).toHaveBeenCalledOnce();
	});

	it('setEditable disables/enables every button (dropdown triggers gate their menu items)', () => {
		const t = createTranslator();
		const tab = createInsertTab(document, t, makeHandlers(), vi.fn());
		// Dropdown menu items aren't individually disabled: a disabled trigger
		// can't be opened, so its items are unreachable (see dropdown.ts).
		const gatedButtons = tab.el.querySelectorAll<HTMLButtonElement>(
			'button:not(.pptxv-dropdown-item)',
		);
		expect(gatedButtons.length).toBeGreaterThan(0);

		tab.setEditable(false);
		expect(Array.from(gatedButtons).every((b) => b.disabled)).toBeTruthy();

		tab.setEditable(true);
		expect(Array.from(gatedButtons).every((b) => !b.disabled)).toBeTruthy();
	});
});
