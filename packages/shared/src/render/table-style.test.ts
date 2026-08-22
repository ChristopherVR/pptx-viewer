import type {
	ParsedTableStyleMap,
	PptxTableCellStyle,
	PptxTableData,
	PptxThemeColorScheme,
} from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	cellStyleToCss,
	getCellDiagonalBorders,
	getDiagonalBorders,
	getTableCellBandStyle,
	ooxmlDashToCssBorderStyle,
	tableContainerCss,
} from './table-style';

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

	it('should emit the cell font family (a:rPr/a:latin)', () => {
		// Parsed by core but dropped by this mapper until issue F3: a cell that
		// named an explicit typeface rendered in the binding default stack.
		expect(cellStyleToCss({ fontFamily: 'Georgia' }).fontFamily).toBe('Georgia');
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

	it('centres the text block for anchorCtr when no explicit align is set', () => {
		const css = cellStyleToCss({ anchorCtr: true } as PptxTableCellStyle);
		expect(css.textAlign).toBe('center');
	});

	it('lets an explicit align win over anchorCtr', () => {
		const css = cellStyleToCss({ anchorCtr: true, align: 'right' } as PptxTableCellStyle);
		expect(css.textAlign).toBe('right');
	});

	it('clips horizontally for horzOverflow clip', () => {
		const css = cellStyleToCss({ horzOverflow: 'clip' } as PptxTableCellStyle);
		expect(css.overflowX).toBe('hidden');
	});

	it('renders a box-shadow bevel for cell3D', () => {
		const css = cellStyleToCss({
			cell3D: { bevelWidth: 8, bevelHeight: 8, lightRigDirection: 'tl' },
		} as PptxTableCellStyle);
		expect(String(css.boxShadow)).toContain('inset');
		expect(String(css.boxShadow)).toContain('rgba(255,255,255,0.55)');
		expect(String(css.boxShadow)).toContain('rgba(0,0,0,0.4)');
	});

	// An explicitly zeroed cell margin (`<a:marL w="0"/>`) must still render as
	// `0px` padding, not fall through to the browser default. `!== undefined`
	// (not a truthy check) is what makes that distinction.
	describe('cell margins (explicit zero)', () => {
		it('renders 0px padding for an explicit zero margin on every edge', () => {
			const css = cellStyleToCss({
				marginLeft: 0,
				marginRight: 0,
				marginTop: 0,
				marginBottom: 0,
			});
			expect(css.paddingLeft).toBe('0px');
			expect(css.paddingRight).toBe('0px');
			expect(css.paddingTop).toBe('0px');
			expect(css.paddingBottom).toBe('0px');
		});

		it('omits padding entirely when a margin is unset', () => {
			const css = cellStyleToCss({ marginLeft: 4 });
			expect(css.paddingLeft).toBe('4px');
			expect(css.paddingRight).toBeUndefined();
			expect(css.paddingTop).toBeUndefined();
			expect(css.paddingBottom).toBeUndefined();
		});
	});

	describe('image fill (a:tcPr/a:blipFill)', () => {
		it('renders a data: URL image fill as a cover background', () => {
			const css = cellStyleToCss({
				fillMode: 'image',
				backgroundImageFillData: 'data:image/png;base64,AAAA',
			});
			expect(css.backgroundImage).toBe('url("data:image/png;base64,AAAA")');
			expect(css.backgroundSize).toBe('cover');
			expect(css.backgroundPosition).toBe('center');
			expect(css.backgroundRepeat).toBe('no-repeat');
		});

		it('prefers resolved backgroundImageFillData over the raw archive path', () => {
			const css = cellStyleToCss({
				fillMode: 'image',
				backgroundImageFillPath: 'ppt/media/image1.png',
				backgroundImageFillData: 'blob:https://example.test/abc',
			});
			expect(css.backgroundImage).toBe('url("blob:https://example.test/abc")');
		});

		it('renders no background for an unresolved raw archive path', () => {
			// `backgroundImageFillPath` alone (no `Data`) is a raw archive path -
			// not a usable CSS url() - until the load pipeline resolves it.
			const css = cellStyleToCss({
				fillMode: 'image',
				backgroundImageFillPath: 'ppt/media/image1.png',
			});
			expect(css.backgroundImage).toBeUndefined();
			expect(css.backgroundColor).toBeUndefined();
		});

		it('does nothing when fillMode is not "image"', () => {
			const css = cellStyleToCss({
				fillMode: 'solid',
				backgroundColor: '#112233',
				backgroundImageFillData: 'data:image/png;base64,AAAA',
			});
			expect(css.backgroundImage).toBeUndefined();
			expect(css.backgroundColor).toBe('#112233');
		});
	});
});

describe('getDiagonalBorders', () => {
	it('returns null when neither cell nor style diagonals are present', () => {
		expect(getDiagonalBorders(undefined)).toBeNull();
		expect(getDiagonalBorders({} as PptxTableCellStyle)).toBeNull();
	});

	it('reads per-cell diagonals', () => {
		const info = getDiagonalBorders({
			borderDiagDownColor: '#FF0000',
			borderDiagDownWidth: 2,
		} as PptxTableCellStyle);
		expect(info?.diagDownColor).toBe('#FF0000');
		expect(info?.diagDownWidth).toBe(2);
	});

	it('falls back to style-inherited diagonals when the cell has none', () => {
		const info = getDiagonalBorders({} as PptxTableCellStyle, {
			diagDownColor: '#00FF00',
			diagDownWidth: 1,
		});
		expect(info?.diagDownColor).toBe('#00FF00');
		expect(info?.diagDownWidth).toBe(1);
	});

	it('lets the per-cell diagonal win over the style-inherited one per axis', () => {
		const info = getDiagonalBorders(
			{ borderDiagDownColor: '#111111', borderDiagDownWidth: 3 } as PptxTableCellStyle,
			{ diagDownColor: '#999999', diagDownWidth: 1, diagUpColor: '#00FF00', diagUpWidth: 2 },
		);
		// Down axis: per-cell wins; up axis: inherited from style.
		expect(info?.diagDownColor).toBe('#111111');
		expect(info?.diagDownWidth).toBe(3);
		expect(info?.diagUpColor).toBe('#00FF00');
		expect(info?.diagUpWidth).toBe(2);
	});
});

describe('getCellDiagonalBorders - style-inherited diagonals (issue: table-style tl2br/bl2tr)', () => {
	const STYLE_ID = '{TESTSTYLE-0000-0000-0000-0000000000D1}';

	function styledTable(overrides: Partial<PptxTableData> = {}): PptxTableData {
		return {
			rows: [],
			columnWidths: [0.5, 0.5],
			tableStyleId: STYLE_ID,
			...overrides,
		} as unknown as PptxTableData;
	}

	it('renders a whole-table tl2br/bl2tr diagonal for a cell', () => {
		const map: ParsedTableStyleMap = {
			[STYLE_ID]: {
				styleId: STYLE_ID,
				wholeTblBorders: {
					tl2br: { width: 2, color: '#FF0000' },
					bl2tr: { width: 1, color: '#0000FF' },
				},
			},
		};
		const info = getCellDiagonalBorders(
			undefined,
			styledTable(),
			{ rowIndex: 1, cellIndex: 1, rowCount: 3, columnCount: 3 },
			{ tableStyleMap: map },
		);
		expect(info?.diagDownColor).toBe('#FF0000');
		expect(info?.diagDownWidth).toBe(2);
		expect(info?.diagUpColor).toBe('#0000FF');
		expect(info?.diagUpWidth).toBe(1);
	});

	it('resolves a scheme-colour diagonal via the theme colour scheme', () => {
		const map: ParsedTableStyleMap = {
			[STYLE_ID]: {
				styleId: STYLE_ID,
				wholeTblBorders: { tl2br: { width: 1, fill: { schemeColor: 'accent1' } } },
			},
		};
		const colorScheme = { accent1: '#123456' } as unknown as PptxThemeColorScheme;
		const info = getCellDiagonalBorders(
			undefined,
			styledTable(),
			{ rowIndex: 0, cellIndex: 0, rowCount: 2, columnCount: 2 },
			{ tableStyleMap: map, colorScheme },
		);
		expect(info?.diagDownColor).toBe('#123456');
	});

	it('lets a per-cell diagonal override the style-inherited one', () => {
		const map: ParsedTableStyleMap = {
			[STYLE_ID]: {
				styleId: STYLE_ID,
				wholeTblBorders: { tl2br: { width: 1, color: '#999999' } },
			},
		};
		const info = getCellDiagonalBorders(
			{ borderDiagDownColor: '#000000', borderDiagDownWidth: 4 } as PptxTableCellStyle,
			styledTable(),
			{ rowIndex: 1, cellIndex: 1, rowCount: 3, columnCount: 3 },
			{ tableStyleMap: map },
		);
		expect(info?.diagDownColor).toBe('#000000');
		expect(info?.diagDownWidth).toBe(4);
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

describe('getTableCellBandStyle - table-style borders (issue #71)', () => {
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

describe('getTableCellBandStyle - section fill types (issue #95)', () => {
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

	it('resolves an image whole-table fill (once patched to a displayable URL)', () => {
		const map = mapWith({
			wholeTblFill: {
				schemeColor: '',
				image: { path: 'ppt/media/tex.png', data: 'blob:resolved' },
			},
		});
		const css = getTableCellBandStyle(tableWith({}), 1, 1, 3, 2, { tableStyleMap: map });
		expect(css?.backgroundImage).toBe('url("blob:resolved")');
		expect(css?.backgroundSize).toBe('cover');
	});

	it('falls through to no fill while an image whole-table fill path is unresolved', () => {
		const map = mapWith({
			wholeTblFill: { schemeColor: '', image: { path: 'ppt/media/tex.png' } },
		});
		const css = getTableCellBandStyle(tableWith({}), 1, 1, 3, 2, { tableStyleMap: map });
		expect(css?.backgroundImage).toBeUndefined();
	});

	it('keeps an authored transparent header readable', () => {
		const map = mapWith({ firstRowFill: { schemeColor: '', noFill: true } });
		const css = getTableCellBandStyle(tableWith({ firstRowHeader: true }), 0, 0, 3, 2, {
			tableStyleMap: map,
		});

		expect(css?.backgroundColor).toBe('transparent');
		expect(css?.color).toBeUndefined();
	});

	it('still paints the fallback header band when no fill is authored', () => {
		const css = getTableCellBandStyle(tableWith({ firstRowHeader: true }), 0, 0, 3, 2, {
			tableStyleMap: mapWith({}),
		});

		expect(css?.backgroundColor).toBe('rgba(68, 114, 196, 0.85)');
		expect(css?.color).toBe('#ffffff');
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

describe('tableContainerCss', () => {
	it('returns nothing for a left-to-right table', () => {
		expect(tableContainerCss({ rows: [], columnWidths: [1] })).toStrictEqual({});
		expect(tableContainerCss(undefined)).toStrictEqual({});
	});

	it('mirrors the column order for a:tblPr@rtl', () => {
		// Parsed and round-tripped since forever, rendered by nobody: every table
		// in an Arabic or Hebrew deck came out with its columns the wrong way
		// round, and Vanilla shipped an inspector toggle that did nothing.
		expect(tableContainerCss({ rows: [], columnWidths: [1], rtl: true })).toStrictEqual({
			direction: 'rtl',
		});
	});
});
