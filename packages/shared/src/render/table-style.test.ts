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

describe('getTableCellBandStyle — section fill types (issue #95)', () => {
	const STYLE_ID = '{TESTSTYLE-0000-0000-0000-000000000095}';

	function tableWith(overrides: Partial<PptxTableData>): PptxTableData {
		return {
			rows: [],
			columnWidths: [0.5, 0.5],
			tableStyleId: STYLE_ID,
			...overrides,
		} as unknown as PptxTableData;
	}

	function mapWith(entry: ParsedTableStyleMap[string]): ParsedTableStyleMap {
		return { [STYLE_ID]: { styleId: STYLE_ID, ...entry } };
	}

	it('applies an explicit sRGB whole-table fill', () => {
		const map = mapWith({ wholeTblFill: { schemeColor: '', color: '#FF8800' } });
		const css = getTableCellBandStyle(tableWith({}), 1, 1, 3, 2, { tableStyleMap: map });
		expect(css?.backgroundColor).toBe('#FF8800');
	});

	it('resolves a gradient whole-table fill to a CSS background', () => {
		const map = mapWith({
			wholeTblFill: {
				schemeColor: '',
				gradient: {
					type: 'linear',
					angle: 90,
					stops: [
						{ position: 0, fill: { schemeColor: '', color: '#000000' } },
						{ position: 100, fill: { schemeColor: '', color: '#FFFFFF' } },
					],
				},
			},
		});
		const css = getTableCellBandStyle(tableWith({}), 1, 1, 3, 2, { tableStyleMap: map });
		expect(String(css?.background)).toContain('linear-gradient');
		expect(css?.backgroundColor).toBeUndefined();
	});

	it('renders a pattern whole-table fill as a tiled SVG background', () => {
		const map = mapWith({
			wholeTblFill: {
				schemeColor: '',
				pattern: {
					preset: 'ltDnDiag',
					foreground: { schemeColor: '', color: '#112233' },
					background: { schemeColor: '', color: '#FFFFFF' },
				},
			},
		});
		const css = getTableCellBandStyle(tableWith({}), 1, 1, 3, 2, { tableStyleMap: map });
		expect(String(css?.backgroundImage)).toContain('data:image/svg+xml');
		expect(css?.backgroundColor).toBe('#FFFFFF');
	});

	it('renders a:noFill as a transparent background', () => {
		const map = mapWith({ wholeTblFill: { schemeColor: '', noFill: true } });
		const css = getTableCellBandStyle(tableWith({}), 1, 1, 3, 2, { tableStyleMap: map });
		expect(css?.backgroundColor).toBe('transparent');
	});

	it('applies underline and typeface from section text', () => {
		const map = mapWith({
			wholeTblText: { underline: true, fontFace: 'Calibri', fontColor: '#123456' },
		});
		const css = getTableCellBandStyle(tableWith({}), 1, 1, 3, 2, { tableStyleMap: map });
		expect(css?.textDecorationLine).toBe('underline');
		expect(css?.fontFamily).toBe('Calibri');
		expect(css?.color).toBe('#123456');
	});

	it('applies the nw corner fill at the top-left header/first-col intersection', () => {
		const td = tableWith({ firstRowHeader: true, firstCol: true });
		const map = mapWith({
			firstRowFill: { schemeColor: '', color: '#111111' },
			firstColFill: { schemeColor: '', color: '#222222' },
			nwCellFill: { schemeColor: '', color: '#ABCDEF' },
		});
		const corner = getTableCellBandStyle(td, 0, 0, 3, 3, { tableStyleMap: map });
		// Corner wins over both firstRow and firstCol fills at (0,0).
		expect(corner?.backgroundColor).toBe('#ABCDEF');
		// A non-corner header cell still shows the firstRow fill.
		const header = getTableCellBandStyle(td, 0, 1, 3, 3, { tableStyleMap: map });
		expect(header?.backgroundColor).toBe('#111111');
	});

	it('applies the se corner fill at the bottom-right last-row/last-col intersection', () => {
		const td = tableWith({ lastRow: true, lastCol: true });
		const map = mapWith({
			seCellFill: { schemeColor: '', color: '#654321' },
		});
		const css = getTableCellBandStyle(td, 2, 2, 3, 3, { tableStyleMap: map });
		expect(css?.backgroundColor).toBe('#654321');
	});
});
