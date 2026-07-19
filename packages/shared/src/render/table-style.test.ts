import type {
	ParsedTableStyleMap,
	PptxTableCellStyle,
	PptxTableData,
	PptxThemeColorScheme,
} from 'pptx-viewer-core';
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

describe('getTableCellBandStyle — table-style borders (issue #71)', () => {
	const STYLE_ID = '{TESTSTYLE-0000-0000-0000-000000000071}';

	function styledTable(): PptxTableData {
		return {
			rows: [],
			columnWidths: [0.5, 0.5],
			tableStyleId: STYLE_ID,
		} as unknown as PptxTableData;
	}

	function borderStyleMap(): ParsedTableStyleMap {
		return {
			[STYLE_ID]: {
				styleId: STYLE_ID,
				wholeTblBorders: {
					insideH: { width: 1, dash: 'solid', color: '#808080' },
					insideV: { width: 1, dash: 'solid', color: '#808080' },
					top: { width: 2, dash: 'solid', color: '#404040' },
					bottom: { width: 2, dash: 'solid', color: '#404040' },
					left: { width: 2, dash: 'solid', color: '#404040' },
					right: { width: 2, dash: 'solid', color: '#404040' },
				},
			},
		};
	}

	it('emits gridlines from wholeTbl tcBdr for an interior cell', () => {
		const css = getTableCellBandStyle(styledTable(), 1, 1, 3, 3, {
			tableStyleMap: borderStyleMap(),
		});
		// Interior cell: all four edges come from insideH / insideV.
		expect(css?.borderTop).toBe('1px solid #808080');
		expect(css?.borderBottom).toBe('1px solid #808080');
		expect(css?.borderLeft).toBe('1px solid #808080');
		expect(css?.borderRight).toBe('1px solid #808080');
	});

	it('uses the outer edge sides at the table boundary', () => {
		const css = getTableCellBandStyle(styledTable(), 0, 0, 3, 3, {
			tableStyleMap: borderStyleMap(),
		});
		// Top-left cell: top+left are outer edges, bottom+right are interior.
		expect(css?.borderTop).toBe('2px solid #404040');
		expect(css?.borderLeft).toBe('2px solid #404040');
		expect(css?.borderBottom).toBe('1px solid #808080');
		expect(css?.borderRight).toBe('1px solid #808080');
	});

	it('resolves scheme-colour border fills via the theme colour scheme', () => {
		const map: ParsedTableStyleMap = {
			[STYLE_ID]: {
				styleId: STYLE_ID,
				wholeTblBorders: {
					insideH: { width: 1, fill: { schemeColor: 'accent1' } },
				},
			},
		};
		const colorScheme = { accent1: '#123456' } as unknown as PptxThemeColorScheme;
		const css = getTableCellBandStyle(styledTable(), 1, 0, 3, 2, {
			tableStyleMap: map,
			colorScheme,
		});
		expect(css?.borderTop).toBe('1px solid #123456');
	});

	it('lets a higher-precedence section supersede the total-row fallback', () => {
		const td = {
			rows: [],
			columnWidths: [0.5, 0.5],
			tableStyleId: STYLE_ID,
			lastRow: true,
		} as unknown as PptxTableData;
		const map: ParsedTableStyleMap = {
			[STYLE_ID]: {
				styleId: STYLE_ID,
				lastRowBorders: { top: { width: 3, dash: 'dash', color: '#FF0000' } },
			},
		};
		const css = getTableCellBandStyle(td, 2, 0, 3, 2, { tableStyleMap: map });
		// Style-defined last-row top border replaces the hardcoded 2px line.
		expect(css?.borderTop).toBe('3px dashed #FF0000');
	});
});
