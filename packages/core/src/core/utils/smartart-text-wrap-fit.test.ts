import { describe, expect, it } from 'vitest';

import { FONT_ADVANCE_TABLES } from './font-advance-widths.generated';
import type { FontAdvanceTable } from './font-advance-widths.generated';
import { fitWrappedFontSize, measureTextWidth } from './smartart-text-wrap-fit';

/** A synthetic table with deliberately lopsided glyph widths, to prove the
 * fitter uses REAL per-glyph advances rather than a flat char-count ratio. */
const LOPSIDED_TABLE: FontAdvanceTable = {
	advances: { 105: 50, 77: 950 }, // 'i' is tiny, 'M' is huge (per-1000-em)
	averageAdvance: 500,
	marginLeftPt: 0,
	marginRightPt: 0,
	marginTopPt: 0,
	marginBottomPt: 0,
	lineHeightRatio: 1.2,
};

describe('fitWrappedFontSize', () => {
	it('returns the ceiling outright when short text fits at that size', () => {
		expect(fitWrappedFontSize('Hi', 400, 400, 48, 6)).toBe(48);
	});

	it('shrinks below the ceiling when the wrapped text would overflow the box', () => {
		const size = fitWrappedFontSize(
			'A much longer label that will not fit on one or two lines at the declared size',
			200,
			60,
			48,
			6,
		);
		expect(size).toBeLessThan(48);
		expect(size).toBeGreaterThanOrEqual(6);
	});

	it('never returns below the floor, even for text that cannot fit at any size in range', () => {
		const size = fitWrappedFontSize('word '.repeat(200).trim(), 20, 10, 48, 6);
		expect(size).toBe(6);
	});

	it('is monotonic: a taller box never requires a smaller font for the same text', () => {
		const small = fitWrappedFontSize('Some wrapped label text here', 150, 60, 48, 6);
		const tall = fitWrappedFontSize('Some wrapped label text here', 150, 600, 48, 6);
		expect(tall).toBeGreaterThanOrEqual(small);
	});

	it('honours explicit newlines as forced line breaks', () => {
		const size = fitWrappedFontSize('One\nTwo\nThree\nFour\nFive', 300, 40, 48, 6);
		// 5 forced lines must fit in a very short box, so it shrinks well below the ceiling.
		expect(size).toBeLessThan(48);
	});

	it('degenerates to the ceiling for empty or whitespace-only text', () => {
		expect(fitWrappedFontSize('   ', 200, 60, 48, 6)).toBe(48);
	});

	it('applies PowerPoint own 90% SmartArt line spacing, not the font raw line-height ratio (basic-block-list--flat3.pptx: cached 36pt/48px)', () => {
		// Real fixture: "Beta has a noticeably longer label than the others" in
		// a 413x246px box with 0.3*primFontSz margins on every side. At the
		// cached 48px it wraps to 4 lines; without the 90% SmartArt line
		// spacing factor (every gallery fixture's cached `dsp:txBody` carries
		// `<a:lnSpc><a:spcPct val="90000"/>`) those 4 lines need MORE height
		// than is available and the fit shrinks past the real answer.
		const text = 'Beta has a noticeably longer label than the others';
		const atCached = 48;
		const marginAtCached = 0.6 * atCached;
		const width = 413 - marginAtCached;
		const height = 246 - marginAtCached;
		const size = fitWrappedFontSize(text, width, height, 48, 6.67);
		expect(size).toBe(48);
	});

	it("aptos' generated lineHeightRatio is the margin-corrected COM value (1.212), not the margin-contaminated one (1.248) `make-font-advance-table.ps1` produced before its own top+bottom-margin subtraction was fixed", () => {
		// COM-verified directly: a single-line 'Node One' Aptos run measured at
		// TWO different sizes (20pt and 48pt) via `Shape.Height -
		// TextFrame.MarginTop - TextFrame.MarginBottom`, divided by the font
		// size, agreed at 1.215 and 1.213 respectively - and a from-scratch
		// re-derivation using the SAME two-line-forced-wrap technique the
		// generator script uses, this time correctly subtracting margins,
		// landed at 1.2121. All three independent measurements agree to
		// within 0.003; none is anywhere near the old, margin-contaminated
		// 1.248 every font in this table shared (the SAME default 3.6pt/3.6pt
		// margin contamination, `(marginTop + marginBottom) / (2 * REF_SIZE)`
		// at the script's REF_SIZE=100, regardless of font - which is also
		// why Calibri and Aptos previously reported an IDENTICAL 1.248 despite
		// being different fonts).
		expect(FONT_ADVANCE_TABLES['Aptos']?.lineHeightRatio).toBeCloseTo(1.212, 3);
	});

	it('fits basic-process--flat3.pptx\'s binding item ("Beta has a noticeably longer label than the others") to its cached 19pt using the REAL Aptos table and the item\'s own self-scoped 0.6 h/w aspect as the font-fit height cap (lineSpacingFactor=1)', () => {
		// Real fixture geometry: item box 228x533px, `lIns/rIns/tIns/bIns` all
		// 5.7pt (0.3 * cached 19pt) = 7.6px/side, and the item's own
		// self-scoped `<dgm:constr type="h" refType="w" fact="0.6"/>` caps the
		// font-fit height at `width * 0.6`, NOT the full 533px display height
		// (see `resolveItemSelfAspect`'s doc comment) - `lineSpacingFactor=1`
		// is the self-scoped-aspect path's own constant, not the display-box
		// path's 0.9 (`SMARTART_LINE_SPACING_FACTOR`).
		const table = FONT_ADVANCE_TABLES['Aptos'];
		const text = 'Beta has a noticeably longer label than the others';
		// lIns/rIns/tIns/bIns are each 0.3 * cached size; both sides of each
		// axis are subtracted (2x the per-side margin).
		const marginPerAxisPx = 2 * 0.3 * 19 * (96 / 72);
		const width = 228 - marginPerAxisPx;
		const height = 228 * 0.6 - marginPerAxisPx;
		const ceilingPx = 65 * (96 / 72);
		const floorPx = 5 * (96 / 72);
		const sizePx = fitWrappedFontSize(text, width, height, ceilingPx, floorPx, table, 1);
		expect(sizePx / (96 / 72)).toBeCloseTo(19, 0);
	});

	it('uses REAL per-glyph advances, not a flat char-count ratio: words of narrow glyphs wrap to fewer lines (and so fit a bigger font) than same-length words of wide glyphs', () => {
		// Multiple separate words (so word-wrap can actually break between
		// them): narrow ('i') words pack many-per-line, wide ('M') words need
		// one line each, so the wide text needs more lines and a smaller font
		// to fit the same height.
		const narrow = 'ii ii ii ii ii ii ii ii';
		const wide = 'MM MM MM MM MM MM MM MM';
		const maxWidth = 100;
		const maxHeight = 60;
		const narrowSize = fitWrappedFontSize(narrow, maxWidth, maxHeight, 48, 6, LOPSIDED_TABLE);
		const wideSize = fitWrappedFontSize(wide, maxWidth, maxHeight, 48, 6, LOPSIDED_TABLE);
		expect(narrowSize).toBeGreaterThan(wideSize);
	});
});

describe('measureTextWidth', () => {
	it('sums per-glyph advances scaled by font size, per-1000-em', () => {
		// 'i' = 50/1000 em; at font size 100, one 'i' is 5 wide.
		expect(measureTextWidth('iii', 100, LOPSIDED_TABLE)).toBeCloseTo(15, 5);
	});

	it("falls back to the table's average advance for an unmeasured glyph", () => {
		expect(measureTextWidth('x', 100, LOPSIDED_TABLE)).toBeCloseTo(50, 5);
	});

	it("snaps each glyph advance to PowerPoint's own 1/6-CSS-px hinting grid (576 DPI = 1/8pt) before summing, not the raw continuous per-glyph fraction", () => {
		// 502/1000 em at fontSize 10 is a raw 5.02px advance - not a multiple of
		// 1/6px. PowerPoint's own GDI-hinted glyph metrics round EVERY glyph
		// advance to that grid before laying text out (see the constant's doc
		// comment; proved via COM for issue #131/#149), so the fitter must
		// reproduce `round(5.02 * 6) / 6 = 5` per glyph, not 5.02.
		const table: FontAdvanceTable = { ...LOPSIDED_TABLE, advances: { 97: 502 } };
		expect(measureTextWidth('aa', 10, table)).toBeCloseTo(10, 5);
		expect(measureTextWidth('aa', 10, table)).not.toBeCloseTo(10.04, 5);
	});
});
