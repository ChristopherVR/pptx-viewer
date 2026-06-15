import type { TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	alphaLabel,
	bulletIndentPx,
	formatAutoNumber,
	resolveParagraphBullet,
	romanNumeral,
} from './text-bullets';

// ---------------------------------------------------------------------------
// romanNumeral
// ---------------------------------------------------------------------------

describe('romanNumeral', () => {
	it('converts 1 to "I"', () => {
		expect(romanNumeral(1)).toBe('I');
	});

	it('converts 4 to "IV"', () => {
		expect(romanNumeral(4)).toBe('IV');
	});

	it('converts 9 to "IX"', () => {
		expect(romanNumeral(9)).toBe('IX');
	});

	it('converts 40 to "XL"', () => {
		expect(romanNumeral(40)).toBe('XL');
	});

	it('converts 14 to "XIV"', () => {
		expect(romanNumeral(14)).toBe('XIV');
	});

	it('converts 2024 to "MMXXIV"', () => {
		expect(romanNumeral(2024)).toBe('MMXXIV');
	});

	it('clamps values below 1 to 1 → "I"', () => {
		expect(romanNumeral(0)).toBe('I');
		expect(romanNumeral(-5)).toBe('I');
	});

	it('clamps values above 3999 to 3999 → "MMMCMXCIX"', () => {
		expect(romanNumeral(4000)).toBe('MMMCMXCIX');
	});
});

// ---------------------------------------------------------------------------
// alphaLabel
// ---------------------------------------------------------------------------

describe('alphaLabel', () => {
	it('converts 1 to "a"', () => {
		expect(alphaLabel(1)).toBe('a');
	});

	it('converts 26 to "z"', () => {
		expect(alphaLabel(26)).toBe('z');
	});

	it('converts 27 to "aa"', () => {
		expect(alphaLabel(27)).toBe('aa');
	});

	it('converts 52 to "az"', () => {
		expect(alphaLabel(52)).toBe('az');
	});

	it('converts 53 to "ba"', () => {
		expect(alphaLabel(53)).toBe('ba');
	});

	it('clamps values below 1 to 1 → "a"', () => {
		expect(alphaLabel(0)).toBe('a');
		expect(alphaLabel(-1)).toBe('a');
	});
});

// ---------------------------------------------------------------------------
// formatAutoNumber — Arabic variants
// ---------------------------------------------------------------------------

describe('formatAutoNumber – arabic', () => {
	it('arabicPeriod formats "1."', () => {
		expect(formatAutoNumber('arabicPeriod', 1)).toBe('1.');
	});

	it('arabicPeriod formats "10."', () => {
		expect(formatAutoNumber('arabicPeriod', 10)).toBe('10.');
	});

	it('arabicParenR formats "1)"', () => {
		expect(formatAutoNumber('arabicParenR', 1)).toBe('1)');
	});

	it('arabicParenBoth formats "(3)"', () => {
		expect(formatAutoNumber('arabicParenBoth', 3)).toBe('(3)');
	});

	it('arabicPlain formats "5"', () => {
		expect(formatAutoNumber('arabicPlain', 5)).toBe('5');
	});

	it('arabicDbPeriod formats "2." (double-byte variant)', () => {
		expect(formatAutoNumber('arabicDbPeriod', 2)).toBe('2.');
	});
});

// ---------------------------------------------------------------------------
// formatAutoNumber — Alpha lower-case variants
// ---------------------------------------------------------------------------

describe('formatAutoNumber – alpha lower-case', () => {
	it('alphaLcPeriod: 1 → "a."', () => {
		expect(formatAutoNumber('alphaLcPeriod', 1)).toBe('a.');
	});

	it('alphaLcPeriod: 3 → "c."', () => {
		expect(formatAutoNumber('alphaLcPeriod', 3)).toBe('c.');
	});

	it('alphaLcPeriod: 26 → "z."', () => {
		expect(formatAutoNumber('alphaLcPeriod', 26)).toBe('z.');
	});

	it('alphaLcPeriod: 27 → "aa." (wrap-around)', () => {
		expect(formatAutoNumber('alphaLcPeriod', 27)).toBe('aa.');
	});

	it('alphaLcParenR: 1 → "a)"', () => {
		expect(formatAutoNumber('alphaLcParenR', 1)).toBe('a)');
	});

	it('alphaLcParenBoth: 2 → "(b)"', () => {
		expect(formatAutoNumber('alphaLcParenBoth', 2)).toBe('(b)');
	});
});

// ---------------------------------------------------------------------------
// formatAutoNumber — Alpha upper-case variants
// ---------------------------------------------------------------------------

describe('formatAutoNumber – alpha upper-case', () => {
	it('alphaUcPeriod: 1 → "A."', () => {
		expect(formatAutoNumber('alphaUcPeriod', 1)).toBe('A.');
	});

	it('alphaUcPeriod: 26 → "Z."', () => {
		expect(formatAutoNumber('alphaUcPeriod', 26)).toBe('Z.');
	});

	it('alphaUcParenR: 2 → "B)"', () => {
		expect(formatAutoNumber('alphaUcParenR', 2)).toBe('B)');
	});

	it('alphaUcParenBoth: 3 → "(C)"', () => {
		expect(formatAutoNumber('alphaUcParenBoth', 3)).toBe('(C)');
	});
});

// ---------------------------------------------------------------------------
// formatAutoNumber — Roman lower-case variants
// ---------------------------------------------------------------------------

describe('formatAutoNumber – roman lower-case', () => {
	it('romanLcPeriod: 1 → "i."', () => {
		expect(formatAutoNumber('romanLcPeriod', 1)).toBe('i.');
	});

	it('romanLcPeriod: 4 → "iv."', () => {
		expect(formatAutoNumber('romanLcPeriod', 4)).toBe('iv.');
	});

	it('romanLcPeriod: 9 → "ix."', () => {
		expect(formatAutoNumber('romanLcPeriod', 9)).toBe('ix.');
	});

	it('romanLcPeriod: 14 → "xiv."', () => {
		expect(formatAutoNumber('romanLcPeriod', 14)).toBe('xiv.');
	});

	it('romanLcParenR: 1 → "i)"', () => {
		expect(formatAutoNumber('romanLcParenR', 1)).toBe('i)');
	});

	it('romanLcParenBoth: 4 → "(iv)"', () => {
		expect(formatAutoNumber('romanLcParenBoth', 4)).toBe('(iv)');
	});
});

// ---------------------------------------------------------------------------
// formatAutoNumber — Roman upper-case variants
// ---------------------------------------------------------------------------

describe('formatAutoNumber – roman upper-case', () => {
	it('romanUcPeriod: 1 → "I."', () => {
		expect(formatAutoNumber('romanUcPeriod', 1)).toBe('I.');
	});

	it('romanUcPeriod: 4 → "IV."', () => {
		expect(formatAutoNumber('romanUcPeriod', 4)).toBe('IV.');
	});

	it('romanUcPeriod: 9 → "IX."', () => {
		expect(formatAutoNumber('romanUcPeriod', 9)).toBe('IX.');
	});

	it('romanUcPeriod: 40 → "XL."', () => {
		expect(formatAutoNumber('romanUcPeriod', 40)).toBe('XL.');
	});

	it('romanUcParenR: 4 → "IV)"', () => {
		expect(formatAutoNumber('romanUcParenR', 4)).toBe('IV)');
	});

	it('romanUcParenBoth: 9 → "(IX)"', () => {
		expect(formatAutoNumber('romanUcParenBoth', 9)).toBe('(IX)');
	});
});

// ---------------------------------------------------------------------------
// formatAutoNumber — fallback
// ---------------------------------------------------------------------------

describe('formatAutoNumber – fallback', () => {
	it('unknown type falls back to "<n>."', () => {
		expect(formatAutoNumber('unknownScheme', 7)).toBe('7.');
	});

	it('undefined autoNumType falls back to "<n>."', () => {
		expect(formatAutoNumber(undefined, 3)).toBe('3.');
	});
});

// ---------------------------------------------------------------------------
// resolveParagraphBullet
// ---------------------------------------------------------------------------

function seg(overrides: Partial<TextSegment> = {}): TextSegment {
	return {
		text: 'Hello',
		style: {},
		...overrides,
	};
}

describe('resolveParagraphBullet', () => {
	it('returns undefined for undefined firstSegment', () => {
		expect(resolveParagraphBullet(undefined)).toBeUndefined();
	});

	it('returns undefined when no bulletInfo present', () => {
		expect(resolveParagraphBullet(seg())).toBeUndefined();
	});

	it('returns undefined when bulletInfo.none is true', () => {
		expect(resolveParagraphBullet(seg({ bulletInfo: { none: true } }))).toBeUndefined();
	});

	it('returns undefined when listType is "none"', () => {
		expect(
			resolveParagraphBullet(seg({ style: { listType: 'none' }, bulletInfo: { char: '•' } })),
		).toBeUndefined();
	});

	// ── Character bullets ──

	it('returns the char marker for a character bullet', () => {
		const result = resolveParagraphBullet(seg({ bulletInfo: { char: '•' } }));
		expect(result).toBeDefined();
		expect(result!.marker).toBe('•');
		expect(result!.isNumbered).toBeFalsy();
	});

	it('carries color and fontFamily from bulletInfo', () => {
		const result = resolveParagraphBullet(
			seg({
				bulletInfo: {
					char: '→',
					color: '#FF0000',
					fontFamily: 'Wingdings',
				},
			}),
		);
		expect(result).toBeDefined();
		expect(result!.marker).toBe('→');
		expect(result!.color).toBe('#FF0000');
		expect(result!.fontFamily).toBe('Wingdings');
	});

	// ── Auto-numbered bullets ──

	it('returns a numbered marker for arabicPeriod, paragraphIndex 0', () => {
		const result = resolveParagraphBullet(
			seg({
				bulletInfo: {
					autoNumType: 'arabicPeriod',
					autoNumStartAt: 1,
					paragraphIndex: 0,
				},
			}),
		);
		expect(result).toBeDefined();
		expect(result!.marker).toBe('1.');
		expect(result!.isNumbered).toBeTruthy();
	});

	it('returns "3." for arabicPeriod with startAt=1, paragraphIndex=2', () => {
		const result = resolveParagraphBullet(
			seg({
				bulletInfo: {
					autoNumType: 'arabicPeriod',
					autoNumStartAt: 1,
					paragraphIndex: 2,
				},
			}),
		);
		expect(result!.marker).toBe('3.');
	});

	it('respects startAt offset: startAt=5, paragraphIndex=0 → "5."', () => {
		const result = resolveParagraphBullet(
			seg({
				bulletInfo: {
					autoNumType: 'arabicPeriod',
					autoNumStartAt: 5,
					paragraphIndex: 0,
				},
			}),
		);
		expect(result!.marker).toBe('5.');
	});

	it('respects startAt offset: startAt=3, paragraphIndex=2 → "5."', () => {
		const result = resolveParagraphBullet(
			seg({
				bulletInfo: {
					autoNumType: 'arabicPeriod',
					autoNumStartAt: 3,
					paragraphIndex: 2,
				},
			}),
		);
		expect(result!.marker).toBe('5.');
	});

	it('defaults missing autoNumStartAt to 1 and paragraphIndex to 0 → "1."', () => {
		const result = resolveParagraphBullet(seg({ bulletInfo: { autoNumType: 'arabicPeriod' } }));
		expect(result!.marker).toBe('1.');
	});

	it('returns "IV." for romanUcPeriod at the 4th item', () => {
		const result = resolveParagraphBullet(
			seg({
				bulletInfo: {
					autoNumType: 'romanUcPeriod',
					autoNumStartAt: 1,
					paragraphIndex: 3,
				},
			}),
		);
		expect(result!.marker).toBe('IV.');
	});

	it('returns "aa." for alphaLcPeriod at the 27th item', () => {
		const result = resolveParagraphBullet(
			seg({
				bulletInfo: {
					autoNumType: 'alphaLcPeriod',
					autoNumStartAt: 1,
					paragraphIndex: 26,
				},
			}),
		);
		expect(result!.marker).toBe('aa.');
	});

	it('returns "B)" for alphaUcParenR at the 2nd item', () => {
		const result = resolveParagraphBullet(
			seg({
				bulletInfo: {
					autoNumType: 'alphaUcParenR',
					autoNumStartAt: 1,
					paragraphIndex: 1,
				},
			}),
		);
		expect(result!.marker).toBe('B)');
	});

	it('returns undefined for picture bullets (no char or autoNumType)', () => {
		const result = resolveParagraphBullet(seg({ bulletInfo: { imageRelId: 'rId1' } }));
		expect(result).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// bulletIndentPx
// ---------------------------------------------------------------------------

describe('bulletIndentPx', () => {
	it('returns 0 for level 0', () => {
		expect(bulletIndentPx(0)).toBe(0);
	});

	it('returns 18 for level 1', () => {
		expect(bulletIndentPx(1)).toBe(18);
	});

	it('returns 36 for level 2', () => {
		expect(bulletIndentPx(2)).toBe(36);
	});

	it('returns 54 for level 3', () => {
		expect(bulletIndentPx(3)).toBe(54);
	});

	it('scales linearly with level', () => {
		expect(bulletIndentPx(5)).toBe(90);
	});

	it('returns 0 for undefined level', () => {
		expect(bulletIndentPx(undefined)).toBe(0);
	});

	it('returns 0 for negative level', () => {
		expect(bulletIndentPx(-2)).toBe(0);
	});
});
