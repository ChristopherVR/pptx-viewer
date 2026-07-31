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
});
