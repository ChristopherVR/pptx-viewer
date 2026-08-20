/**
 * table-properties-helpers.test.ts: Vitest unit tests for the pure table
 * properties helpers (preset application, gradient CSS building). Column-width
 * redistribution and the "distribute evenly" helpers now live in
 * `pptx-viewer-shared` and are tested there.
 */
/* oxlint-disable eslint/one-var -- many independent it() blocks, each with
   its own short arrange/act/assert consts. */
import type { PptxTableData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { TableStylePreset } from '../internal/shared';
import { applyTableStylePreset, buildGradientFillCss } from './table-properties-helpers';

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

	it('applies the border colour to every cell', () => {
		const rows = applyTableStylePreset(td(2, 2), PRESET);
		for (const row of rows) {
			for (const cell of row.cells) {
				expect(cell.style?.borderColor).toBe(PRESET.borderColor);
			}
		}
	});
});

// Column-width redistribution and "distribute evenly" one-liners moved to
// `pptx-viewer-shared`'s `render/table-resize.test.ts`
// (`redistributeColumnWidth` / `evenColumnWidths` / `evenRowHeights`); this
// component only wires their input onto that shared implementation now.

describe('buildGradientFillCss', () => {
	it('builds a linear gradient with sorted stops and angle', () => {
		const css = buildGradientFillCss(
			[
				{ color: '#00F', position: 100 },
				{ color: '#F00', position: 0 },
			],
			'linear',
			45,
		);
		// 45 is the OOXML angle; CSS sits a quarter turn away.
		expect(css).toBe('linear-gradient(135deg, #F00 0%, #00F 100%)');
	});

	it('builds a radial gradient', () => {
		const css = buildGradientFillCss([{ color: '#F00', position: 0 }], 'radial', 90);
		expect(css).toContain('radial-gradient(circle');
	});
});
