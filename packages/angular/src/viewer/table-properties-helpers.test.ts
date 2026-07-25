/**
 * table-properties-helpers.test.ts: Vitest unit tests for the pure table
 * properties helpers (preset application, width redistribution, even
 * distribution, gradient CSS building).
 */
import type { PptxTableData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { TableStylePreset } from '../internal/shared';
import {
	applyTableStylePreset,
	buildGradientFillCss,
	evenColumnWidths,
	evenRowHeights,
	redistributeColumnWidth,
} from './table-properties-helpers';

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

describe('redistributeColumnWidth', () => {
	it('sets the target column and renormalises to sum 1', () => {
		const result = redistributeColumnWidth([0.5, 0.5], 0, 0.7);
		expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
		expect(result[0]).toBeGreaterThan(result[1]);
	});

	it('returns the array unchanged for an out-of-range index', () => {
		const widths = [0.5, 0.5];
		expect(redistributeColumnWidth(widths, 5, 0.3)).toBe(widths);
	});
});

describe('evenColumnWidths', () => {
	it('returns equal fractions summing to 1', () => {
		const result = evenColumnWidths(4);
		expect(result).toHaveLength(4);
		expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
	});

	it('returns an empty array for zero columns', () => {
		expect(evenColumnWidths(0)).toStrictEqual([]);
	});
});

describe('evenRowHeights', () => {
	it('applies the average height to every row', () => {
		const data: PptxTableData = {
			columnWidths: [1],
			rows: [
				{ cells: [{ text: '' }], height: 20 },
				{ cells: [{ text: '' }], height: 60 },
			],
		};
		const rows = evenRowHeights(data);
		expect(rows[0].height).toBe(40);
		expect(rows[1].height).toBe(40);
	});
});

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
