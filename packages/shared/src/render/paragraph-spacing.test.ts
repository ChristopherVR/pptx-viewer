import type { TextStyle } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { resolveParagraphSpacing } from './paragraph-spacing';

const base = {
	isFirst: false,
	isLast: false,
	spaceFirstLast: true,
};

describe('resolveParagraphSpacing', () => {
	it('returns nothing when neither the paragraph nor the body sets spacing', () => {
		expect(resolveParagraphSpacing({ ...base, paraProps: undefined })).toStrictEqual({});
		expect(
			resolveParagraphSpacing({ ...base, paraProps: undefined, bodyStyle: undefined }),
		).toStrictEqual({});
	});

	it('expresses exact spcPts line spacing in px', () => {
		const out = resolveParagraphSpacing({
			...base,
			paraProps: { lineSpacingExactPt: 18 } as TextStyle,
		});
		// 18pt at 96dpi. Equivalent to the "18pt" some bindings emitted before,
		// but one unit for all five.
		expect(out.lineHeight).toBe('24px');
	});

	// A paragraph's own spcBef NEVER becomes its own margin-top (spaceBeforePx
	// is always undefined): both its own spcBef and spcAft fold into
	// spaceAfterPx, the paragraph's trailing margin only. See
	// `resolveParagraphSpacing`'s doc comment for the COM measurement behind
	// this, in `paragraph-spacing.ts`.
	it('combines per-paragraph before/after margins from paraProps into the trailing margin', () => {
		const result = resolveParagraphSpacing({
			...base,
			paraProps: { paragraphSpacingBefore: 12, paragraphSpacingAfter: 8 } as TextStyle,
			bodyStyle: undefined,
		});
		expect(result.spaceBeforePx).toBeUndefined();
		expect(result.spaceAfterPx).toBe(20);
	});

	it('falls back to body-level spacing when the paragraph has none', () => {
		const result = resolveParagraphSpacing({
			...base,
			paraProps: undefined,
			bodyStyle: { paragraphSpacingBefore: 5, paragraphSpacingAfter: 7 } as TextStyle,
		});
		expect(result.spaceBeforePx).toBeUndefined();
		expect(result.spaceAfterPx).toBe(12);
	});

	it('prefers paragraph spacing over the body fallback', () => {
		const result = resolveParagraphSpacing({
			...base,
			paraProps: { paragraphSpacingBefore: 20 } as TextStyle,
			bodyStyle: { paragraphSpacingBefore: 5 } as TextStyle,
		});
		// Still lands in spaceAfterPx, not spaceBeforePx: it is the resolved
		// VALUE that prefers paragraph over body, not which margin it becomes.
		expect(result.spaceBeforePx).toBeUndefined();
		expect(result.spaceAfterPx).toBe(20);
	});

	it('maps a line-spacing multiplier to a unitless line-height', () => {
		const result = resolveParagraphSpacing({
			...base,
			paraProps: { lineSpacing: 1.5 } as TextStyle,
			bodyStyle: undefined,
		});
		// 1.5 stacks on the 1.2 single-spacing base (spcPct multiplies the pitch).
		expect(result.lineHeight).toBeCloseTo(1.8, 10);
	});

	it('maps exact-pt line spacing to a px line-height', () => {
		const result = resolveParagraphSpacing({
			...base,
			paraProps: { lineSpacingExactPt: 18 } as TextStyle,
			bodyStyle: undefined,
		});
		// 18pt * 96/72 = 24px
		expect(result.lineHeight).toBe('24px');
	});

	it('uses the paragraph line-spacing unit without mixing body values', () => {
		const result = resolveParagraphSpacing({
			...base,
			paraProps: { lineSpacing: 2 } as TextStyle,
			bodyStyle: { lineSpacingExactPt: 40 } as TextStyle,
		});
		expect(result.lineHeight).toBeCloseTo(2.4, 10);
	});

	it('suppresses the first paragraphs own before-spacing when spaceFirstLast is false', () => {
		const result = resolveParagraphSpacing({
			...base,
			isFirst: true,
			spaceFirstLast: false,
			paraProps: { paragraphSpacingBefore: 12, paragraphSpacingAfter: 8 } as TextStyle,
			bodyStyle: undefined,
		});
		// Before suppressed (0) + after (8, unconditional: not last) = 8.
		expect(result.spaceAfterPx).toBe(8);
	});

	it('suppresses the last paragraphs own after-spacing when spaceFirstLast is false', () => {
		const result = resolveParagraphSpacing({
			...base,
			isLast: true,
			spaceFirstLast: false,
			paraProps: { paragraphSpacingBefore: 12, paragraphSpacingAfter: 8 } as TextStyle,
			bodyStyle: undefined,
		});
		// Before (12, unconditional: not first) + after suppressed (0) = 12.
		expect(result.spaceAfterPx).toBe(12);
	});

	it('suppresses first/last edge spacing by default when spaceFirstLast is omitted', () => {
		// ECMA-376's default for `a:bodyPr/@spcFirstLastPara` is false, confirmed
		// by PowerPoint COM measurement (TextRange2.Paragraphs(n).BoundTop):
		// an omitted attribute behaves as "0", not "1".
		const firstResult = resolveParagraphSpacing({
			isFirst: true,
			isLast: false,
			paraProps: { paragraphSpacingBefore: 12, paragraphSpacingAfter: 8 } as TextStyle,
			bodyStyle: undefined,
		});
		expect(firstResult.spaceAfterPx).toBe(8);

		const lastResult = resolveParagraphSpacing({
			isFirst: false,
			isLast: true,
			paraProps: { paragraphSpacingBefore: 12, paragraphSpacingAfter: 8 } as TextStyle,
			bodyStyle: undefined,
		});
		expect(lastResult.spaceAfterPx).toBe(12);
	});

	it('applies first/last edge spacing when spaceFirstLast is true, still as one trailing margin', () => {
		const result = resolveParagraphSpacing({
			...base,
			isFirst: true,
			isLast: true,
			spaceFirstLast: true,
			paraProps: { paragraphSpacingBefore: 12, paragraphSpacingAfter: 8 } as TextStyle,
			bodyStyle: undefined,
		});
		expect(result.spaceBeforePx).toBeUndefined();
		expect(result.spaceAfterPx).toBe(20);
	});

	it('leaves an interior paragraph fully unaffected by spaceFirstLast either way', () => {
		const interior = {
			isFirst: false,
			isLast: false,
			paraProps: { paragraphSpacingBefore: 40, paragraphSpacingAfter: 30 } as TextStyle,
			bodyStyle: undefined,
		};
		const withFlagOff = resolveParagraphSpacing({ ...interior, spaceFirstLast: false });
		const withFlagOn = resolveParagraphSpacing({ ...interior, spaceFirstLast: true });
		expect(withFlagOff).toStrictEqual({ spaceAfterPx: 70 });
		expect(withFlagOn).toStrictEqual({ spaceAfterPx: 70 });
	});

	it('gates only the first paragraph before-spacing and last paragraph after-spacing independently', () => {
		// p1 in a body of >= 3 paragraphs: own before gated, own after always on
		// (it is not the last paragraph). Both fold into spaceAfterPx.
		const p1 = {
			isFirst: true,
			isLast: false,
			paraProps: { paragraphSpacingBefore: 40, paragraphSpacingAfter: 30 } as TextStyle,
			bodyStyle: undefined,
		};
		expect(resolveParagraphSpacing({ ...p1, spaceFirstLast: false })).toStrictEqual({
			spaceAfterPx: 30,
		});
		expect(resolveParagraphSpacing({ ...p1, spaceFirstLast: true })).toStrictEqual({
			spaceAfterPx: 70,
		});

		// pN in a body of >= 3 paragraphs: own after gated, own before always on
		// (it is not the first paragraph). Both fold into spaceAfterPx.
		const pN = {
			isFirst: false,
			isLast: true,
			paraProps: { paragraphSpacingBefore: 40, paragraphSpacingAfter: 30 } as TextStyle,
			bodyStyle: undefined,
		};
		expect(resolveParagraphSpacing({ ...pN, spaceFirstLast: false })).toStrictEqual({
			spaceAfterPx: 40,
		});
		expect(resolveParagraphSpacing({ ...pN, spaceFirstLast: true })).toStrictEqual({
			spaceAfterPx: 70,
		});
	});

	it('reduces a proportional line-height by the autofit lnSpcReduction fraction', () => {
		const result = resolveParagraphSpacing({
			...base,
			paraProps: { lineSpacing: 1.5 } as TextStyle,
			bodyStyle: undefined,
			lineSpacingReduction: 0.2,
		});
		// 1.5 * 1.2 pitch = 1.8, reduced by 20% -> 1.44.
		expect(result.lineHeight).toBeCloseTo(1.44, 10);
	});

	it('does not apply lnSpcReduction to an exact-pt line-height', () => {
		const result = resolveParagraphSpacing({
			...base,
			paraProps: { lineSpacingExactPt: 18 } as TextStyle,
			bodyStyle: undefined,
			lineSpacingReduction: 0.2,
		});
		expect(result.lineHeight).toBe('24px');
	});

	it('ignores a zero or absent lnSpcReduction', () => {
		const noReduction = resolveParagraphSpacing({
			...base,
			paraProps: { lineSpacing: 1.5 } as TextStyle,
			bodyStyle: undefined,
			lineSpacingReduction: 0,
		});
		expect(noReduction.lineHeight).toBeCloseTo(1.8, 10);
	});

	it('ignores zero / negative spacing values', () => {
		const result = resolveParagraphSpacing({
			...base,
			paraProps: { paragraphSpacingBefore: 0, paragraphSpacingAfter: -4 } as TextStyle,
			bodyStyle: undefined,
		});
		expect(result.spaceBeforePx).toBeUndefined();
		expect(result.spaceAfterPx).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Direct pins of the raw PowerPoint COM measurements behind the doc comment
// above `resolveParagraphSpacing`. Both decks use DISTINCT spcBef/spcAft per
// paragraph specifically so a measured number can only be explained by ONE
// paragraph's own authored value, unlike a uniform deck (spcBef/spcAft equal
// across paragraphs) where "spcAft(i) + spcBef(i+1)" and "spcBef(i) +
// spcAft(i)" predict the same total and cannot be told apart. Units here are
// the raw COM point values, used directly as the "already px" input
// `resolveParagraphSpacing` expects: what is being pinned is the ARITHMETIC
// relationship (which paragraph's numbers combine, and how), not a px/pt
// conversion (covered separately by the line-height tests above).
// ---------------------------------------------------------------------------
describe('resolveParagraphSpacing - measured multi-paragraph gaps', () => {
	// 4-paragraph deck, spcBef/spcAft distinct per paragraph:
	// p1 11/21, p2 32/42, p3 53/63, p4 74/84 (points). Own BoundHeight per
	// paragraph, read over COM, was (line = 21.6pt in both variants):
	//   spaceFirstLast off:  p1 42.6  p2 95.6  p3 137.6  p4 95.6
	//   spaceFirstLast on:   p1 53.6  p2 95.6  p3 137.6  p4 179.6
	// (only p1 and p4, the edges, move between variants; p2 and p3 do not.)
	const distinctParas = [
		{ paragraphSpacingBefore: 11, paragraphSpacingAfter: 21 },
		{ paragraphSpacingBefore: 32, paragraphSpacingAfter: 42 },
		{ paragraphSpacingBefore: 53, paragraphSpacingAfter: 63 },
		{ paragraphSpacingBefore: 74, paragraphSpacingAfter: 84 },
	] as TextStyle[];

	function ownAfterPx(paraIndex: number, spaceFirstLast: boolean): number | undefined {
		return resolveParagraphSpacing({
			paraProps: distinctParas[paraIndex],
			bodyStyle: undefined,
			isFirst: paraIndex === 0,
			isLast: paraIndex === distinctParas.length - 1,
			spaceFirstLast,
		}).spaceAfterPx;
	}

	it('matches the measured own-margin for every paragraph with spaceFirstLast off', () => {
		expect(ownAfterPx(0, false)).toBe(21); // p1: before suppressed, after 21
		expect(ownAfterPx(1, false)).toBe(74); // p2: 32 + 42
		expect(ownAfterPx(2, false)).toBe(116); // p3: 53 + 63
		expect(ownAfterPx(3, false)).toBe(74); // p4: before 74, after suppressed
	});

	it('matches the measured own-margin for every paragraph with spaceFirstLast on', () => {
		expect(ownAfterPx(0, true)).toBe(32); // p1: 11 + 21, both now applied
		expect(ownAfterPx(1, true)).toBe(74); // p2: unaffected by the flag
		expect(ownAfterPx(2, true)).toBe(116); // p3: unaffected by the flag
		expect(ownAfterPx(3, true)).toBe(158); // p4: 74 + 84, both now applied
	});

	// Isolation deck: only the MIDDLE paragraph authors a spcBef (100pt);
	// everything else is 0. Measured over COM: the gap BEFORE it is
	// unaffected (line height only), and the gap AFTER it carries the full
	// 100pt - proof spcBef never manifests as space above its own paragraph,
	// for an INTERIOR paragraph specifically (not just the documented first/
	// last edge cases).
	it('matches the isolation deck: a middle paragraphs spcBef lands entirely after it, never before', () => {
		const p1 = resolveParagraphSpacing({
			paraProps: { paragraphSpacingBefore: 0, paragraphSpacingAfter: 0 } as TextStyle,
			bodyStyle: undefined,
			isFirst: true,
			isLast: false,
			spaceFirstLast: false,
		});
		const p2 = resolveParagraphSpacing({
			paraProps: { paragraphSpacingBefore: 100, paragraphSpacingAfter: 0 } as TextStyle,
			bodyStyle: undefined,
			isFirst: false,
			isLast: false,
			spaceFirstLast: false,
		});
		const p3 = resolveParagraphSpacing({
			paraProps: { paragraphSpacingBefore: 0, paragraphSpacingAfter: 0 } as TextStyle,
			bodyStyle: undefined,
			isFirst: false,
			isLast: true,
			spaceFirstLast: false,
		});
		expect(p1.spaceAfterPx).toBeUndefined(); // gap p1->p2: line only
		expect(p2.spaceAfterPx).toBe(100); // gap p2->p3: line + all 100pt
		expect(p3.spaceAfterPx).toBeUndefined();
	});
});
