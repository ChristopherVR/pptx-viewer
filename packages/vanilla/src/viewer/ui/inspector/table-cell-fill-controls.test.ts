import { describe, expect, it, vi } from 'vitest';

import { createTableCellFillControls } from './table-cell-fill-controls';
import type { InspectorHandlers, InspectorState } from './types';

/** Mount with the identity translator so an option's text IS its i18n key. */
function mount() {
	const setTableCellStyles = vi.fn();
	const controls = createTableCellFillControls(document, (key) => key, {
		setTableCellStyles,
	} as unknown as InspectorHandlers);
	controls.update({
		isTable: true,
		selectedTableCell: { row: 0, column: 0 },
		selectedTableCells: [],
	} as unknown as InspectorState);
	const labels = Array.from(controls.el.querySelectorAll('label'));
	const selectFor = (key: string): HTMLSelectElement =>
		labels.find((label) => label.textContent?.startsWith(key))!.querySelector('select')!;
	return { controls, setTableCellStyles, selectFor };
}

describe('table cell pattern fill picker', () => {
	it('keeps the nine `a:pattFill` presets as the option values', () => {
		const { selectFor } = mount();

		expect(
			Array.from(selectFor('pptx.table.patternPreset').options).map((option) => option.value),
		).toStrictEqual([
			'ltDnDiag',
			'dkDnDiag',
			'ltUpDiag',
			'dkUpDiag',
			'smGrid',
			'lgGrid',
			'horz',
			'vert',
			'diagCross',
		]);
	});

	it('spells the presets rather than showing `ltDnDiag`', () => {
		const { selectFor } = mount();

		expect(
			Array.from(selectFor('pptx.table.patternPreset').options).map((option) => option.textContent),
		).toStrictEqual([
			'pptx.fillPatterns.lightDownDiagonal',
			'pptx.fillPatterns.darkDownDiagonal',
			'pptx.fillPatterns.lightUpDiagonal',
			'pptx.fillPatterns.darkUpDiagonal',
			'pptx.fillPatterns.smallGrid',
			'pptx.fillPatterns.largeGrid',
			'pptx.fillPatterns.horizontal',
			'pptx.fillPatterns.vertical',
			'pptx.fillPatterns.diagonalCross',
		]);
	});

	it('still writes the preset token onto the cell style', () => {
		const { selectFor, setTableCellStyles } = mount();
		const pattern = selectFor('pptx.table.patternPreset');

		pattern.value = 'diagCross';
		pattern.dispatchEvent(new Event('change'));

		expect(setTableCellStyles).toHaveBeenLastCalledWith(
			[{ row: 0, column: 0 }],
			expect.objectContaining({ fillMode: 'pattern', patternFillPreset: 'diagCross' }),
		);
	});
});
