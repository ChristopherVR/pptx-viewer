/**
 * table-style-presets.test.ts: unit tests for `applyTableStylePreset`, the
 * shared assignment logic behind every binding's table quick-style swatches.
 */
/* oxlint-disable eslint/one-var -- many independent it() blocks, each with its
   own short arrange/act/assert consts. */
import type { PptxTableData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { TableStylePreset } from './table-style-presets';
import { applyTableStylePreset } from './table-style-presets';

const PRESET: TableStylePreset = {
	id: 'light-1',
	label: 'Light 1',
	headerBg: '#4472C4',
	headerFg: '#FFFFFF',
	bandBg: 'rgba(0,0,0,0.1)',
	borderColor: '#B4C6E7',
};

function td(rows: number, cols: number): PptxTableData {
	return {
		columnWidths: Array.from({ length: cols }, () => 1 / cols),
		rows: Array.from({ length: rows }, () => ({
			cells: Array.from({ length: cols }, () => ({ text: '' })),
		})),
	};
}

describe('applyTableStylePreset', () => {
	it('applies header fill/foreground/bold to the first row when firstRowHeader', () => {
		const data: PptxTableData = { ...td(2, 2), firstRowHeader: true };
		const rows = applyTableStylePreset(data, PRESET);
		expect(rows[0].cells[0].style?.backgroundColor).toBe(PRESET.headerBg);
		expect(rows[0].cells[0].style?.color).toBe(PRESET.headerFg);
		expect(rows[0].cells[0].style?.bold).toBeTruthy();
	});

	it('does not treat the first row as a header when firstRowHeader is unset', () => {
		const rows = applyTableStylePreset(td(2, 2), PRESET);
		expect(rows[0].cells[0].style?.backgroundColor).toBeUndefined();
		expect(rows[0].cells[0].style?.bold).toBeFalsy();
	});

	it('bands alternating body rows after the header when bandedRows is set', () => {
		const data: PptxTableData = { ...td(4, 1), firstRowHeader: true, bandedRows: true };
		const rows = applyTableStylePreset(data, PRESET);
		// row 0 = header, row 1 = first body row (banded), row 2 = unbanded, row 3 = banded
		expect(rows[1].cells[0].style?.backgroundColor).toBe(PRESET.bandBg);
		expect(rows[2].cells[0].style?.backgroundColor).toBeUndefined();
		expect(rows[3].cells[0].style?.backgroundColor).toBe(PRESET.bandBg);
	});

	it('applies the border colour to every cell', () => {
		const rows = applyTableStylePreset(td(2, 2), PRESET);
		for (const row of rows) {
			for (const cell of row.cells) {
				expect(cell.style?.borderColor).toBe(PRESET.borderColor);
			}
		}
	});

	it('preserves existing cell style fields it does not own', () => {
		const data = td(1, 1);
		data.rows[0].cells[0].style = { italic: true };
		const rows = applyTableStylePreset(data, PRESET);
		expect(rows[0].cells[0].style?.italic).toBeTruthy();
	});

	it('does not mutate the input table data', () => {
		const data: PptxTableData = { ...td(2, 2), firstRowHeader: true };
		const before = JSON.stringify(data);
		applyTableStylePreset(data, PRESET);
		expect(JSON.stringify(data)).toBe(before);
	});
});
