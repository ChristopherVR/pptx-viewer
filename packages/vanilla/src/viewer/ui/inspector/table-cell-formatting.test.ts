import { describe, expect, it, vi } from 'vitest';

import { createTableCellFormatting } from './table-cell-formatting';
import type { InspectorHandlers, InspectorState } from './types';

/** Mount with the identity translator so an option's text IS its i18n key. */
function mount() {
	const setTableCellStyles = vi.fn();
	const panel = createTableCellFormatting(document, (key) => key, {
		setTableCellStyles,
	} as unknown as InspectorHandlers);
	panel.update({
		isTable: true,
		selectedTableCell: { row: 0, column: 0 },
		selectedTableCells: [],
	} as unknown as InspectorState);
	const labels = Array.from(panel.el.querySelectorAll('label'));
	const selectFor = (key: string): HTMLSelectElement =>
		labels.find((label) => label.textContent?.startsWith(key))!.querySelector('select')!;
	return { panel, setTableCellStyles, selectFor };
}

describe('table cell alignment pickers', () => {
	it('keeps the wire values and spells them with the text panel keys', () => {
		const { selectFor } = mount();
		const align = selectFor('pptx.table.alignment');

		expect(Array.from(align.options).map((option) => option.value)).toStrictEqual([
			'left',
			'center',
			'right',
		]);
		expect(Array.from(align.options).map((option) => option.textContent)).toStrictEqual([
			'pptx.textPanel.alignLeft',
			'pptx.textPanel.alignCenter',
			'pptx.textPanel.alignRight',
		]);
	});

	it('spells the vertical alignment the same way the text section does', () => {
		const { selectFor } = mount();
		const vAlign = selectFor('pptx.table.verticalAlignment');

		expect(Array.from(vAlign.options).map((option) => option.value)).toStrictEqual([
			'top',
			'middle',
			'bottom',
		]);
		expect(Array.from(vAlign.options).map((option) => option.textContent)).toStrictEqual([
			'pptx.textPanel.valignTop',
			'pptx.textPanel.valignMiddle',
			'pptx.textPanel.valignBottom',
		]);
	});

	it('still commits the wire value, not the caption', () => {
		const { selectFor, setTableCellStyles } = mount();
		const vAlign = selectFor('pptx.table.verticalAlignment');

		vAlign.value = 'middle';
		vAlign.dispatchEvent(new Event('change'));

		expect(setTableCellStyles).toHaveBeenLastCalledWith([{ row: 0, column: 0 }], {
			vAlign: 'middle',
		});
	});

	// B6: category-B push (no row of its own; folds into the deck-level MRU list).
	it('pushes the cell text colour into the recent-colours MRU on commit, not on drag', () => {
		const setTableCellStyles = vi.fn();
		const pushRecentColor = vi.fn();
		const panel = createTableCellFormatting(document, (key) => key, {
			setTableCellStyles,
			pushRecentColor,
		} as unknown as InspectorHandlers);
		panel.update({
			isTable: true,
			selectedTableCell: { row: 0, column: 0 },
			selectedTableCells: [],
		} as unknown as InspectorState);
		const labels = Array.from(panel.el.querySelectorAll('label'));
		const colorInput = labels
			.find((label) => label.textContent?.startsWith('pptx.table.color'))!
			.querySelector('input[type="color"]') as HTMLInputElement;

		colorInput.value = '#123456';
		colorInput.dispatchEvent(new Event('input'));
		expect(pushRecentColor).not.toHaveBeenCalled();

		colorInput.dispatchEvent(new Event('change'));
		expect(pushRecentColor).toHaveBeenCalledExactlyOnceWith('#123456');
	});
});

const OFFICE_THEME: Record<string, string> = {
	dk1: '#000000',
	lt1: '#ffffff',
	dk2: '#44546a',
	lt2: '#e7e6e6',
	accent1: '#4472c4',
	accent2: '#ed7d31',
	accent3: '#a5a5a5',
	accent4: '#ffc000',
	accent5: '#5b9bd5',
	accent6: '#70ad47',
	bg1: '#ffffff',
	tx1: '#000000',
	bg2: '#e7e6e6',
	tx2: '#44546a',
};

describe('table cell text/fill theme colour grids', () => {
	function mountWithTheme() {
		const setTableCellStyles = vi.fn();
		const panel = createTableCellFormatting(document, (key) => key, {
			setTableCellStyles,
			pushRecentColor: vi.fn(),
		} as unknown as InspectorHandlers);
		panel.update({
			isTable: true,
			selectedTableCell: { row: 0, column: 0 },
			selectedTableCells: [],
			themeColorMap: OFFICE_THEME,
			tableCellStyle: { color: '#ed7d31', colorRef: { scheme: 'accent2' } },
		} as unknown as InspectorState);
		return { panel, setTableCellStyles };
	}

	it('renders one theme-swatch grid for text colour and one for fill colour', () => {
		const { panel } = mountWithTheme();
		expect(panel.el.querySelectorAll('.pptxv-theme-swatch-grid')).toHaveLength(2);
	});

	it('clicking the text colour theme grid commits color + colorRef, not backgroundColor', () => {
		const { panel, setTableCellStyles } = mountWithTheme();
		const [textGrid] = Array.from(
			panel.el.querySelectorAll<HTMLElement>('.pptxv-theme-swatch-grid'),
		);

		textGrid.querySelector<HTMLButtonElement>('button[title="Accent 6"]')!.click();
		expect(setTableCellStyles).toHaveBeenCalledExactlyOnceWith([{ row: 0, column: 0 }], {
			color: '#70ad47',
			colorRef: { scheme: 'accent6' },
		});
	});

	it('clicking the fill colour theme grid commits backgroundColor + backgroundColorRef', () => {
		const { panel, setTableCellStyles } = mountWithTheme();
		const [, fillGrid] = Array.from(
			panel.el.querySelectorAll<HTMLElement>('.pptxv-theme-swatch-grid'),
		);

		fillGrid.querySelector<HTMLButtonElement>('button[title="Accent 6"]')!.click();
		expect(setTableCellStyles).toHaveBeenCalledExactlyOnceWith([{ row: 0, column: 0 }], {
			backgroundColor: '#70ad47',
			backgroundColorRef: { scheme: 'accent6' },
		});
	});

	it("highlights the cell's stored text colour ref", () => {
		const { panel } = mountWithTheme();
		const [textGrid] = Array.from(
			panel.el.querySelectorAll<HTMLElement>('.pptxv-theme-swatch-grid'),
		);
		const swatch = textGrid.querySelector<HTMLButtonElement>('button[title="Accent 2"]')!;
		expect(swatch.classList.contains('is-selected')).toBeTruthy();
	});

	it('the native text colour input clears colorRef', () => {
		const setTableCellStyles = vi.fn();
		const panel = createTableCellFormatting(document, (key) => key, {
			setTableCellStyles,
			pushRecentColor: vi.fn(),
		} as unknown as InspectorHandlers);
		panel.update({
			isTable: true,
			selectedTableCell: { row: 0, column: 0 },
			selectedTableCells: [],
			tableCellStyle: {},
		} as unknown as InspectorState);
		const labels = Array.from(panel.el.querySelectorAll('label'));
		const colorInput = labels
			.find((label) => label.textContent?.startsWith('pptx.table.color'))!
			.querySelector('input[type="color"]') as HTMLInputElement;

		colorInput.value = '#00ff00';
		colorInput.dispatchEvent(new Event('input'));
		expect(setTableCellStyles).toHaveBeenCalledExactlyOnceWith([{ row: 0, column: 0 }], {
			color: '#00ff00',
			colorRef: undefined,
		});
	});
});
