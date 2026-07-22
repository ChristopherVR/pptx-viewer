/**
 * Tests for table-renderer pure helpers.
 *
 * All assertions target functions exported from `table-renderer-helpers.ts`
 * (the Angular-free layer). This avoids loading `@angular/common` / the JIT
 * compiler, which is not available in the plain vitest environment
 * (component/TestBed tests are a follow-up with @analogjs/vite-plugin-angular).
 */
import type { PptxElement, PptxTableCell, PptxTableCellStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildCellParagraphs,
	buildColStyles,
	buildTableViewModel,
	cellRunStyle,
	cellStyleToStyleMap,
	cellTdStyle,
	columnWidthStyle,
	ooxmlDashToCssBorderStyle,
	rowStyle,
} from './table-renderer-helpers';

// ==========================================================================
// Helpers
// ==========================================================================

/** Build a minimal `PptxElement` of type `table` with the given rows. */
function tableElement(
	rows: Array<{
		height?: number;
		cells: Array<{
			text?: string;
			style?: PptxTableCellStyle;
			gridSpan?: number;
			rowSpan?: number;
			hMerge?: boolean;
			vMerge?: boolean;
		}>;
	}>,
	columnWidths?: number[],
): PptxElement {
	return {
		type: 'table',
		id: 'tbl_test',
		name: 'Test Table',
		x: 0,
		y: 0,
		width: 400,
		height: 200,
		tableData: {
			rows: rows.map((r) => ({
				height: r.height,
				cells: r.cells.map(
					(c): PptxTableCell => ({
						text: c.text ?? '',
						style: c.style,
						gridSpan: c.gridSpan,
						rowSpan: c.rowSpan,
						hMerge: c.hMerge,
						vMerge: c.vMerge,
					}),
				),
			})),
			columnWidths: columnWidths ?? [],
		},
	} as PptxElement;
}

// ==========================================================================
// ooxmlDashToCssBorderStyle
// ==========================================================================

describe('ooxmlDashToCssBorderStyle', () => {
	it('returns solid for undefined', () => {
		expect(ooxmlDashToCssBorderStyle(undefined)).toBe('solid');
	});

	it('returns dotted for dot / sysDot', () => {
		expect(ooxmlDashToCssBorderStyle('dot')).toBe('dotted');
		expect(ooxmlDashToCssBorderStyle('sysDot')).toBe('dotted');
	});

	it('returns dashed for dash variants', () => {
		for (const v of ['dash', 'sysDash', 'lgDash', 'dashDot', 'lgDashDot']) {
			expect(ooxmlDashToCssBorderStyle(v)).toBe('dashed');
		}
	});

	it('returns solid for unknown values', () => {
		expect(ooxmlDashToCssBorderStyle('wave')).toBe('solid');
	});
});

// ==========================================================================
// cellStyleToStyleMap
// ==========================================================================

describe('cellStyleToStyleMap', () => {
	it('returns an empty map for undefined style', () => {
		expect(cellStyleToStyleMap(undefined)).toStrictEqual({});
	});

	it('maps solid backgroundColor', () => {
		const map = cellStyleToStyleMap({ backgroundColor: '#AABBCC' });
		expect(map['background-color']).toBe('#AABBCC');
		expect(map['background']).toBeUndefined();
	});

	it('prefers gradientFillCss over backgroundColor', () => {
		const css = 'linear-gradient(90deg, #FF0000 0%, #0000FF 100%)';
		const map = cellStyleToStyleMap({ backgroundColor: '#AABBCC', gradientFillCss: css });
		expect(map['background']).toBe(css);
		expect(map['background-color']).toBeUndefined();
	});

	it('maps bold/italic/underline', () => {
		const map = cellStyleToStyleMap({ bold: true, italic: true, underline: true });
		expect(map['font-weight']).toBe('bold');
		expect(map['font-style']).toBe('italic');
		expect(map['text-decoration']).toBe('underline');
	});

	it('maps per-edge borders', () => {
		const map = cellStyleToStyleMap({
			borderTopWidth: 2,
			borderTopColor: '#FF0000',
			borderTopDash: 'dot',
		});
		expect(map['border-top']).toBe('2px dotted #FF0000');
	});

	it('falls back to borderColor when per-edge color is absent', () => {
		const map = cellStyleToStyleMap({
			borderColor: '#123456',
			borderBottomWidth: 1,
		});
		expect(map['border-bottom']).toBe('1px solid #123456');
	});

	it('maps cell margins to padding', () => {
		const map = cellStyleToStyleMap({
			marginLeft: 8,
			marginTop: 4,
			marginRight: 8,
			marginBottom: 4,
		});
		expect(map['padding-left']).toBe('8px');
		expect(map['padding-top']).toBe('4px');
		expect(map['padding-right']).toBe('8px');
		expect(map['padding-bottom']).toBe('4px');
	});

	it('maps vertical text direction vert → vertical-rl', () => {
		const map = cellStyleToStyleMap({ textDirection: 'vert' });
		expect(map['writing-mode']).toBe('vertical-rl');
		expect(map['text-orientation']).toBe('mixed');
	});

	it('maps text shadow', () => {
		const map = cellStyleToStyleMap({
			textShadowColor: '#000000',
			textShadowOffsetX: 1,
			textShadowOffsetY: 2,
			textShadowBlur: 3,
		});
		expect(map['text-shadow']).toBe('1px 2px 3px #000000');
	});

	it('maps glow as zero-offset text-shadow', () => {
		const map = cellStyleToStyleMap({ textGlowColor: '#FFFFFF', textGlowRadius: 4 });
		expect(map['text-shadow']).toBe('0px 0px 4px #FFFFFF');
	});
});

// ==========================================================================
// columnWidthStyle
// ==========================================================================

describe('columnWidthStyle', () => {
	it('converts 0–1 fraction to a percentage string', () => {
		expect(columnWidthStyle(0.5)['width']).toBe('50.00%');
		expect(columnWidthStyle(0.25)['width']).toBe('25.00%');
	});
});

// ==========================================================================
// rowStyle
// ==========================================================================

describe('rowStyle', () => {
	it('returns empty map when height is absent', () => {
		expect(rowStyle({ cells: [] })).toStrictEqual({});
	});

	it('returns a pixel height when height is set', () => {
		expect(rowStyle({ height: 40, cells: [] })['height']).toBe('40px');
	});
});

// ==========================================================================
// cellTdStyle
// ==========================================================================

describe('cellTdStyle', () => {
	it('applies default padding and vertical-align', () => {
		const cell: PptxTableCell = { text: 'Hello' };
		const style = cellTdStyle(cell);
		expect(style['padding-left']).toBe('4px');
		expect(style['vertical-align']).toBe('top');
	});

	it('cell style overrides default padding', () => {
		const cell: PptxTableCell = { text: 'X', style: { marginLeft: 12 } };
		const style = cellTdStyle(cell);
		// Cell style marginLeft → padding-left; overrides the default 4px.
		expect(style['padding-left']).toBe('12px');
	});

	it('cell backgroundColor appears in output', () => {
		const cell: PptxTableCell = { text: '', style: { backgroundColor: '#FF0000' } };
		const style = cellTdStyle(cell);
		expect(style['background-color']).toBe('#FF0000');
	});
});

// ==========================================================================
// buildTableViewModel: 2×2 simple table
// ==========================================================================

describe('buildTableViewModel - simple 2×2 table', () => {
	const el = tableElement(
		[{ cells: [{ text: 'A' }, { text: 'B' }] }, { cells: [{ text: 'C' }, { text: 'D' }] }],
		[0.5, 0.5],
	);

	it('produces 2 rows', () => {
		const rows = buildTableViewModel(el);
		expect(rows).toHaveLength(2);
	});

	it('each row has 2 cells', () => {
		const rows = buildTableViewModel(el);
		expect(rows[0].cells).toHaveLength(2);
		expect(rows[1].cells).toHaveLength(2);
	});

	it('displayText matches cell text', () => {
		const rows = buildTableViewModel(el);
		expect(rows[0].cells[0].displayText).toBe('A');
		expect(rows[0].cells[1].displayText).toBe('B');
		expect(rows[1].cells[0].displayText).toBe('C');
		expect(rows[1].cells[1].displayText).toBe('D');
	});

	it('no spans are set on normal cells', () => {
		const rows = buildTableViewModel(el);
		for (const row of rows) {
			for (const cell of row.cells) {
				expect(cell.colSpan).toBeUndefined();
				expect(cell.rowSpan).toBeUndefined();
			}
		}
	});
});

// ==========================================================================
// buildTableViewModel: merged cell (hMerge / gridSpan)
// ==========================================================================

describe('buildTableViewModel - horizontal merge', () => {
	/**
	 * 2 rows × 3 columns; top row has a cell spanning columns 0–1.
	 *
	 *   [  A (colspan=2)  ] [B]
	 *   [C] [D] [E]
	 */
	const el = tableElement(
		[
			{
				cells: [
					{ text: 'A', gridSpan: 2 }, // origin: spans cols 0+1
					{ text: '', hMerge: true }, // merged away
					{ text: 'B' },
				],
			},
			{
				cells: [{ text: 'C' }, { text: 'D' }, { text: 'E' }],
			},
		],
		[0.4, 0.4, 0.2],
	);

	it('top row has 2 cells (merged-away cell skipped)', () => {
		const rows = buildTableViewModel(el);
		expect(rows[0].cells).toHaveLength(2);
	});

	it('origin cell gets colspan=2', () => {
		const rows = buildTableViewModel(el);
		expect(rows[0].cells[0].colSpan).toBe(2);
	});

	it('second cell in top row has no span', () => {
		const rows = buildTableViewModel(el);
		expect(rows[0].cells[1].colSpan).toBeUndefined();
		expect(rows[0].cells[1].displayText).toBe('B');
	});

	it('bottom row still has 3 cells', () => {
		const rows = buildTableViewModel(el);
		expect(rows[1].cells).toHaveLength(3);
	});
});

// ==========================================================================
// buildTableViewModel: vertical merge (vMerge / rowSpan)
// ==========================================================================

describe('buildTableViewModel - vertical merge', () => {
	/**
	 * 3 rows × 2 columns; first column top cell spans rows 0–1.
	 *
	 *   [X (rowspan=2)] [Y]
	 *   [    vMerge   ] [Z]
	 *   [W] [V]
	 */
	const el = tableElement([
		{ cells: [{ text: 'X', rowSpan: 2 }, { text: 'Y' }] },
		{ cells: [{ text: '', vMerge: true }, { text: 'Z' }] },
		{ cells: [{ text: 'W' }, { text: 'V' }] },
	]);

	it('row 0 has 2 cells', () => {
		const rows = buildTableViewModel(el);
		expect(rows[0].cells).toHaveLength(2);
	});

	it('origin cell gets rowspan=2', () => {
		const rows = buildTableViewModel(el);
		expect(rows[0].cells[0].rowSpan).toBe(2);
	});

	it('row 1 has 1 cell (vMerge cell skipped)', () => {
		const rows = buildTableViewModel(el);
		expect(rows[1].cells).toHaveLength(1);
		expect(rows[1].cells[0].displayText).toBe('Z');
	});

	it('row 2 is unaffected', () => {
		const rows = buildTableViewModel(el);
		expect(rows[2].cells).toHaveLength(2);
	});
});

// ==========================================================================
// buildTableViewModel: cell fill color
// ==========================================================================

describe('buildTableViewModel - cell fill color', () => {
	it('solid fill color appears in tdStyle', () => {
		const el = tableElement([
			{
				cells: [{ text: 'Filled', style: { backgroundColor: '#0055AA' } }],
			},
		]);
		const rows = buildTableViewModel(el);
		expect(rows[0].cells[0].tdStyle['background-color']).toBe('#0055AA');
	});

	it('gradient CSS string appears in tdStyle via background property', () => {
		const gradient = 'linear-gradient(45deg, #FF6B6B 0%, #556270 100%)';
		const el = tableElement([
			{
				cells: [{ text: 'Gradient', style: { gradientFillCss: gradient } }],
			},
		]);
		const rows = buildTableViewModel(el);
		expect(rows[0].cells[0].tdStyle['background']).toBe(gradient);
	});

	it('gradient takes precedence over solid backgroundColor', () => {
		const gradient = 'linear-gradient(90deg, #AAA 0%, #FFF 100%)';
		const el = tableElement([
			{
				cells: [
					{
						text: 'Both',
						style: { backgroundColor: '#FF0000', gradientFillCss: gradient },
					},
				],
			},
		]);
		const rows = buildTableViewModel(el);
		expect(rows[0].cells[0].tdStyle['background']).toBe(gradient);
		expect(rows[0].cells[0].tdStyle['background-color']).toBeUndefined();
	});
});

// ==========================================================================
// buildTableViewModel: non-table element
// ==========================================================================

describe('buildTableViewModel - non-table element', () => {
	it('returns empty array for non-table elements', () => {
		const el: PptxElement = {
			type: 'shape',
			id: 's1',
			name: '',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
		} as PptxElement;
		expect(buildTableViewModel(el)).toStrictEqual([]);
	});

	it('returns empty array for table element without tableData', () => {
		const el: PptxElement = {
			type: 'table',
			id: 'tbl2',
			name: '',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
		} as PptxElement;
		expect(buildTableViewModel(el)).toStrictEqual([]);
	});
});

// ==========================================================================
// buildColStyles
// ==========================================================================

describe('buildColStyles', () => {
	it('returns a StyleMap per column', () => {
		const el = tableElement([], [0.6, 0.4]);
		const styles = buildColStyles(el);
		expect(styles).toHaveLength(2);
		expect(styles[0]['width']).toBe('60.00%');
		expect(styles[1]['width']).toBe('40.00%');
	});

	it('returns empty array when columnWidths is empty', () => {
		const el = tableElement([]);
		expect(buildColStyles(el)).toStrictEqual([]);
	});
});

// ==========================================================================
// buildTableViewModel: empty cell text uses non-breaking space
// ==========================================================================

describe('buildTableViewModel - empty cell display text', () => {
	it('uses non-breaking space for empty text to preserve row height', () => {
		const el = tableElement([{ cells: [{ text: '' }] }]);
		const rows = buildTableViewModel(el);
		// ' ' (U+00A0) keeps the cell from collapsing; mirrors React's
		// `cell.text || ' '` in table-render-data.tsx.
		expect(rows[0].cells[0].displayText).toBe(' ');
	});
});

// ==========================================================================
// cellRunStyle
// ==========================================================================

describe('cellRunStyle', () => {
	it('returns an empty map for undefined style', () => {
		expect(cellRunStyle(undefined)).toStrictEqual({});
	});

	it('maps bold to font-weight', () => {
		expect(cellRunStyle({ bold: true })['font-weight']).toBe('bold');
	});

	it('maps italic to font-style', () => {
		expect(cellRunStyle({ italic: true })['font-style']).toBe('italic');
	});

	it('maps underline to text-decoration', () => {
		expect(cellRunStyle({ underline: true })['text-decoration']).toBe('underline');
	});

	it('maps color', () => {
		expect(cellRunStyle({ color: '#FF0000' })['color']).toBe('#FF0000');
	});

	it('maps fontSize to font-size in px', () => {
		// PptxTableCellStyle.fontSize is already in px (converted from EMU by the parser).
		expect(cellRunStyle({ fontSize: 14 })['font-size']).toBe('14px');
	});

	it('does not include layout properties like background-color', () => {
		const map = cellRunStyle({ bold: true, backgroundColor: '#000000' });
		// backgroundColor is a layout property -- it should not appear in the run style.
		expect(map['background-color']).toBeUndefined();
	});

	it('maps bold + color + underline together', () => {
		const map = cellRunStyle({ bold: true, color: '#123456', underline: true });
		expect(map['font-weight']).toBe('bold');
		expect(map['color']).toBe('#123456');
		expect(map['text-decoration']).toBe('underline');
	});
});

// ==========================================================================
// buildCellParagraphs
// ==========================================================================

describe('buildCellParagraphs', () => {
	it('returns empty array for an empty cell with no style', () => {
		const cell: PptxTableCell = { text: '' };
		expect(buildCellParagraphs(cell)).toHaveLength(0);
	});

	it('returns one paragraph for a plain text cell', () => {
		const cell: PptxTableCell = { text: 'Hello' };
		const paras = buildCellParagraphs(cell);
		expect(paras).toHaveLength(1);
		expect(paras[0]).toHaveLength(1);
		expect(paras[0][0].text).toBe('Hello');
	});

	it('plain text cell run has empty style (no cell style)', () => {
		const cell: PptxTableCell = { text: 'Hello' };
		const paras = buildCellParagraphs(cell);
		expect(paras[0][0].style).toStrictEqual({});
	});

	it('cell with bold style produces a run with font-weight bold', () => {
		const cell: PptxTableCell = { text: 'Bold text', style: { bold: true } };
		const paras = buildCellParagraphs(cell);
		expect(paras).toHaveLength(1);
		expect(paras[0][0].style['font-weight']).toBe('bold');
	});

	it('cell with color produces a run with correct color', () => {
		const cell: PptxTableCell = { text: 'Colored', style: { color: '#FF0000' } };
		const paras = buildCellParagraphs(cell);
		expect(paras[0][0].style['color']).toBe('#FF0000');
	});

	it('cell with bold + colored style -- both applied to the single run', () => {
		const cell: PptxTableCell = {
			text: 'Hello world',
			style: { bold: true, color: '#0000FF' },
		};
		const paras = buildCellParagraphs(cell);
		// One paragraph, one run (cell-level style applies to the whole cell text).
		expect(paras).toHaveLength(1);
		expect(paras[0]).toHaveLength(1);
		expect(paras[0][0].style['font-weight']).toBe('bold');
		expect(paras[0][0].style['color']).toBe('#0000FF');
	});

	it('cell with paragraph break (newline in text) produces two paragraphs', () => {
		// The core parser joins paragraphs with \n in extractTableCellText.
		const cell: PptxTableCell = { text: 'Line 1\nLine 2' };
		const paras = buildCellParagraphs(cell);
		expect(paras).toHaveLength(2);
		expect(paras[0][0].text).toBe('Line 1');
		expect(paras[1][0].text).toBe('Line 2');
	});

	it('three-paragraph cell produces three paragraph entries', () => {
		const cell: PptxTableCell = { text: 'A\nB\nC' };
		const paras = buildCellParagraphs(cell);
		expect(paras).toHaveLength(3);
		expect(paras[2][0].text).toBe('C');
	});

	it('empty cell WITH style still returns one paragraph (styled placeholder)', () => {
		// When a cell is empty but has explicit formatting (e.g. bold) we must
		// still output a paragraph so the style is rendered -- otherwise the empty
		// cell would wrongly fall back to the unstyled displayText path.
		const cell: PptxTableCell = { text: '', style: { bold: true } };
		const paras = buildCellParagraphs(cell);
		expect(paras).toHaveLength(1);
		expect(paras[0][0].style['font-weight']).toBe('bold');
	});
});

// ==========================================================================
// buildTableViewModel -- paragraphs field integration
// ==========================================================================

describe('buildTableViewModel -- paragraphs field', () => {
	it('plain text cell has one paragraph', () => {
		const el = tableElement([{ cells: [{ text: 'Hello' }] }]);
		const rows = buildTableViewModel(el);
		expect(rows[0].cells[0].paragraphs).toHaveLength(1);
		expect(rows[0].cells[0].paragraphs[0][0].text).toBe('Hello');
	});

	it('multi-paragraph cell (\\n) produces multiple paragraph entries in the view-model', () => {
		const el = tableElement([{ cells: [{ text: 'Para 1\nPara 2' }] }]);
		const rows = buildTableViewModel(el);
		const paras = rows[0].cells[0].paragraphs;
		expect(paras).toHaveLength(2);
		expect(paras[0][0].text).toBe('Para 1');
		expect(paras[1][0].text).toBe('Para 2');
	});

	it('empty unstyled cell has paragraphs length 0 (falls back to displayText)', () => {
		const el = tableElement([{ cells: [{ text: '' }] }]);
		const rows = buildTableViewModel(el);
		expect(rows[0].cells[0].paragraphs).toHaveLength(0);
		// displayText is the non-breaking-space fallback.
		expect(rows[0].cells[0].displayText).toBe(' ');
	});

	it('styled cell preserves style on each paragraph run', () => {
		const style: PptxTableCellStyle = { bold: true, color: '#FF6600', underline: true };
		const el = tableElement([{ cells: [{ text: 'Styled', style }] }]);
		const rows = buildTableViewModel(el);
		const run = rows[0].cells[0].paragraphs[0][0];
		expect(run.style['font-weight']).toBe('bold');
		expect(run.style['color']).toBe('#FF6600');
		expect(run.style['text-decoration']).toBe('underline');
	});
});

// ==========================================================================
// buildTableViewModel: diagonal borders (getCellDiagonalBorders integration)
// ==========================================================================

describe('buildTableViewModel - diagonal borders', () => {
	it('resolves a per-cell down diagonal into the cell view-model', () => {
		const style: PptxTableCellStyle = {
			borderDiagDownColor: '#FF0000',
			borderDiagDownWidth: 2,
		};
		const el = tableElement([{ cells: [{ text: 'x', style }] }], [1]);
		const rows = buildTableViewModel(el);
		const diag = rows[0].cells[0].diagonal;
		expect(diag).not.toBeNull();
		expect(diag?.diagDownColor).toBe('#FF0000');
		expect(diag?.diagDownWidth).toBe(2);
	});

	it('resolves a per-cell up diagonal into the cell view-model', () => {
		const style: PptxTableCellStyle = {
			borderDiagUpColor: '#00AA00',
			borderDiagUpWidth: 3,
		};
		const el = tableElement([{ cells: [{ text: 'y', style }] }], [1]);
		const rows = buildTableViewModel(el);
		const diag = rows[0].cells[0].diagonal;
		expect(diag?.diagUpColor).toBe('#00AA00');
		expect(diag?.diagUpWidth).toBe(3);
	});

	it('returns null diagonal for a cell with no diagonals', () => {
		const el = tableElement([{ cells: [{ text: 'z' }] }], [1]);
		const rows = buildTableViewModel(el);
		expect(rows[0].cells[0].diagonal).toBeNull();
	});

	it('accepts a styleCtx (fontScheme threaded) without disturbing per-cell diagonals', () => {
		const style: PptxTableCellStyle = {
			borderDiagDownColor: '#0000FF',
			borderDiagDownWidth: 1,
		};
		const el = tableElement([{ cells: [{ text: 'x', style }] }], [1]);
		const rows = buildTableViewModel(el, {
			tableStyleMap: undefined,
			colorScheme: undefined,
			fontScheme: { majorFont: { latin: 'Calibri Light' }, minorFont: { latin: 'Calibri' } },
		});
		expect(rows[0].cells[0].diagonal?.diagDownColor).toBe('#0000FF');
	});
});
