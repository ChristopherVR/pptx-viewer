import { SHAPE_PRESET_DEFS } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

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
	it('renders text box, table, image, media, chart, equation, action button, field, and one button per shape/SmartArt preset', () => {
		const t = createTranslator();
		const tab = createInsertTab(document, t, makeHandlers(), vi.fn());
		// Top-level append order: text, table, image, media, chart-dropdown, equation,
		// action-button-dropdown, field-dropdown, shape grid, SmartArt grid.
		expect(tab.el.children).toHaveLength(10);
		const shapeGrid = tab.el.querySelectorAll('.pptxv-shape-grid button');
		const smartArtGrid = tab.el.querySelectorAll('.pptxv-smartart-grid button');
		const dropdownTriggers = tab.el.querySelectorAll('.pptxv-dropdown-trigger');
		expect(shapeGrid).toHaveLength(SHAPE_PRESET_DEFS.length);
		expect(smartArtGrid.length).toBeGreaterThan(0);
		// chart, action-button, and field are all dropdowns.
		expect(dropdownTriggers).toHaveLength(3);
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
		// Top-level append order in insert-tab.ts: text, table, image, media,
		// chart-dropdown, equation, action-button-dropdown, field-dropdown.
		const equationBtn = tab.el.children[5] as HTMLButtonElement;
		expect(equationBtn.tagName).toBe('BUTTON');
		equationBtn.click();
		expect(onToggleEquationPanel).toHaveBeenCalledOnce();
	});

	it('dispatches insertSmartArt(layout, defaultItems) from the SmartArt grid', () => {
		const insertSmartArt = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(document, t, makeHandlers({ insertSmartArt }), vi.fn());
		const smartArtButtons = tab.el.querySelectorAll<HTMLButtonElement>(
			'.pptxv-smartart-grid button',
		);
		expect(smartArtButtons.length).toBeGreaterThan(0);
		smartArtButtons[0].click();
		expect(insertSmartArt).toHaveBeenCalledOnce();
	});

	it('dispatches insertActionButton(type) from the action-button dropdown', () => {
		const insertActionButton = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(document, t, makeHandlers({ insertActionButton }), vi.fn());
		// Top-level append order: ... equation(5), action-button-dropdown(6), field-dropdown(7).
		const actionButtonDropdown = tab.el.children[6];
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
