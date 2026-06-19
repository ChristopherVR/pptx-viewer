import type { PptxTableCellStyle, PptxTableData } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { cellStyleToCss, getTableCellBandStyle, ooxmlDashToCssBorderStyle } from './table-style';

describe('ooxmlDashToCssBorderStyle', () => {
	it('should return "solid" for undefined input', () => {
		expect(ooxmlDashToCssBorderStyle(undefined)).toBe('solid');
	});

	it('should return "solid" for empty string', () => {
		expect(ooxmlDashToCssBorderStyle('')).toBe('solid');
	});

	it('should map dot variants to "dotted"', () => {
		expect(ooxmlDashToCssBorderStyle('dot')).toBe('dotted');
		expect(ooxmlDashToCssBorderStyle('sysDot')).toBe('dotted');
	});

	it('should map dash variants to "dashed"', () => {
		expect(ooxmlDashToCssBorderStyle('dash')).toBe('dashed');
		expect(ooxmlDashToCssBorderStyle('lgDashDotDot')).toBe('dashed');
		expect(ooxmlDashToCssBorderStyle('sysDashDotDot')).toBe('dashed');
	});

	it('should return "solid" for unknown values', () => {
		expect(ooxmlDashToCssBorderStyle('unknown')).toBe('solid');
	});
});

describe('cellStyleToCss', () => {
	it('should return an empty object for an undefined style', () => {
		expect(cellStyleToCss(undefined)).toStrictEqual({});
	});

	it('should map font / colour / weight properties', () => {
		const style: PptxTableCellStyle = {
			fontSize: 18,
			bold: true,
			italic: true,
			underline: true,
			color: '#FF0000',
		} as PptxTableCellStyle;
		const css = cellStyleToCss(style);
		expect(css.fontSize).toBe('18px');
		expect(css.fontWeight).toBe('bold');
		expect(css.fontStyle).toBe('italic');
		expect(css.textDecorationLine).toBe('underline');
		expect(css.color).toBe('#FF0000');
	});

	it('should compose per-edge borders with dash mapping', () => {
		const style = {
			borderTopWidth: 2,
			borderTopColor: '#123456',
			borderTopDash: 'dash',
		} as PptxTableCellStyle;
		const css = cellStyleToCss(style);
		expect(css.borderTop).toBe('2px dashed #123456');
	});

	it('should prefer gradient over solid background', () => {
		const style = {
			gradientFillCss: 'linear-gradient(#000, #fff)',
			backgroundColor: '#abcabc',
		} as PptxTableCellStyle;
		expect(cellStyleToCss(style).background).toBe('linear-gradient(#000, #fff)');
	});
});

describe('getTableCellBandStyle', () => {
	function bandedTable(): PptxTableData {
		return {
			rows: [],
			columnWidths: [0.5, 0.5],
			firstRowHeader: true,
			bandedRows: true,
		} as unknown as PptxTableData;
	}

	it('should return undefined when no table data is supplied', () => {
		expect(getTableCellBandStyle(undefined, 0, 0, 3, 2)).toBeUndefined();
	});

	it('should emphasise the header row', () => {
		const style = getTableCellBandStyle(bandedTable(), 0, 0, 3, 2);
		expect(style?.fontWeight).toBe(700);
		expect(style?.color).toBe('#ffffff');
	});

	it('should apply banding to alternate body rows', () => {
		const td = bandedTable();
		const style = getTableCellBandStyle(td, 1, 0, 3, 2);
		expect(style?.backgroundColor).toBeDefined();
	});
});
