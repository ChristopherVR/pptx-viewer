import { describe, expect, it } from 'vitest';

import { lineHeightToPx, proportionalLineHeight, resolveLineHeight } from './text-line-height';

describe('resolveLineHeight', () => {
	it('returns an exact pt string when lineSpacingExactPt is set', () => {
		expect(resolveLineHeight({ lineSpacingExactPt: 18 }, false)).toBe('18pt');
	});

	it('ignores a non-positive exact pt and uses the multiplier', () => {
		// 1.5 stacks on the 1.2 single-spacing base (spcPct multiplies the pitch).
		expect(resolveLineHeight({ lineSpacingExactPt: 0, lineSpacing: 1.5 }, false)).toBeCloseTo(
			1.8,
			10,
		);
	});

	it('uses the proportional multiplier when set', () => {
		// 200% spacing lays out at 2.4x the font size in PowerPoint (COM-measured
		// on the issue #132 deck), not 2.0x: spcPct stacks on the 1.2 base.
		expect(resolveLineHeight({ lineSpacing: 2 }, false)).toBeCloseTo(2.4, 10);
	});

	it('defaults to PowerPoint single spacing (1.2x), italic or not', () => {
		// Measured against PowerPoint (COM TextRange2.BoundHeight, issue #131
		// deck): single-spaced lines are exactly 1.2x the font point size.
		expect(resolveLineHeight(undefined, false)).toBe(1.2);
		expect(resolveLineHeight(undefined, true)).toBe(1.2);
	});

	it('compatLnSpc uses the multiplier directly, without the 1.2 pitch', () => {
		expect(resolveLineHeight({ lineSpacing: 1.5, compatibleLineSpacing: true }, false)).toBeCloseTo(
			1.5,
			10,
		);
		expect(resolveLineHeight({ compatibleLineSpacing: true }, false)).toBe(1);
	});

	it('exact pt spacing is unaffected by compatLnSpc', () => {
		expect(resolveLineHeight({ lineSpacingExactPt: 18, compatibleLineSpacing: true }, false)).toBe(
			'18pt',
		);
	});
});

describe('proportionalLineHeight', () => {
	it('stacks the multiplier on the 1.2 single-spacing pitch by default', () => {
		expect(proportionalLineHeight(1.5)).toBeCloseTo(1.8, 10);
		expect(proportionalLineHeight(undefined)).toBe(1.2);
	});

	it('compatLineSpacing uses the multiplier alone, no 1.2 stacking', () => {
		expect(proportionalLineHeight(1.5, true)).toBeCloseTo(1.5, 10);
		expect(proportionalLineHeight(undefined, true)).toBe(1);
	});
});

describe('lineHeightToPx', () => {
	it('multiplies a unitless multiplier by the font size', () => {
		expect(lineHeightToPx(20, 1.2)).toBe(24);
	});

	it('converts a pt string to px', () => {
		expect(lineHeightToPx(20, '18pt')).toBeCloseTo(24, 5);
	});

	it('reads a px string verbatim', () => {
		expect(lineHeightToPx(20, '30px')).toBe(30);
	});

	it('falls back to the single-spacing pitch for an unrecognised/absent value', () => {
		expect(lineHeightToPx(20, undefined)).toBeCloseTo(24, 5);
		expect(lineHeightToPx(20, 'normal')).toBeCloseTo(24, 5);
	});
});
