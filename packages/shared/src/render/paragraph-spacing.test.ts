import type { TextStyle } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { resolveParagraphSpacing } from './text-paragraphs';

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

	it('applies per-paragraph before/after margins from paraProps', () => {
		const result = resolveParagraphSpacing({
			...base,
			paraProps: { paragraphSpacingBefore: 12, paragraphSpacingAfter: 8 } as TextStyle,
			bodyStyle: undefined,
		});
		expect(result.spaceBeforePx).toBe(12);
		expect(result.spaceAfterPx).toBe(8);
	});

	it('falls back to body-level spacing when the paragraph has none', () => {
		const result = resolveParagraphSpacing({
			...base,
			paraProps: undefined,
			bodyStyle: { paragraphSpacingBefore: 5, paragraphSpacingAfter: 7 } as TextStyle,
		});
		expect(result.spaceBeforePx).toBe(5);
		expect(result.spaceAfterPx).toBe(7);
	});

	it('prefers paragraph spacing over the body fallback', () => {
		const result = resolveParagraphSpacing({
			...base,
			paraProps: { paragraphSpacingBefore: 20 } as TextStyle,
			bodyStyle: { paragraphSpacingBefore: 5 } as TextStyle,
		});
		expect(result.spaceBeforePx).toBe(20);
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

	it('suppresses first-paragraph top spacing when spaceFirstLast is false', () => {
		const result = resolveParagraphSpacing({
			...base,
			isFirst: true,
			spaceFirstLast: false,
			paraProps: { paragraphSpacingBefore: 12, paragraphSpacingAfter: 8 } as TextStyle,
			bodyStyle: undefined,
		});
		expect(result.spaceBeforePx).toBeUndefined();
		expect(result.spaceAfterPx).toBe(8);
	});

	it('suppresses last-paragraph bottom spacing when spaceFirstLast is false', () => {
		const result = resolveParagraphSpacing({
			...base,
			isLast: true,
			spaceFirstLast: false,
			paraProps: { paragraphSpacingBefore: 12, paragraphSpacingAfter: 8 } as TextStyle,
			bodyStyle: undefined,
		});
		expect(result.spaceBeforePx).toBe(12);
		expect(result.spaceAfterPx).toBeUndefined();
	});

	it('applies first/last edge spacing when spaceFirstLast is true', () => {
		const result = resolveParagraphSpacing({
			...base,
			isFirst: true,
			isLast: true,
			spaceFirstLast: true,
			paraProps: { paragraphSpacingBefore: 12, paragraphSpacingAfter: 8 } as TextStyle,
			bodyStyle: undefined,
		});
		expect(result.spaceBeforePx).toBe(12);
		expect(result.spaceAfterPx).toBe(8);
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
