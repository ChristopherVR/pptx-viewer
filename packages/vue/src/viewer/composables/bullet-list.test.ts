import type { TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	alphaLabel,
	bulletIndentPx,
	formatAutoNumber,
	resolveParagraphBullet,
	resolveParagraphIndent,
	romanNumeral,
} from './bullet-list';

// ---------------------------------------------------------------------------
// romanNumeral / alphaLabel
// ---------------------------------------------------------------------------

describe('romanNumeral', () => {
	it('converts 1/4/9/40/2024', () => {
		expect(romanNumeral(1)).toBe('I');
		expect(romanNumeral(4)).toBe('IV');
		expect(romanNumeral(9)).toBe('IX');
		expect(romanNumeral(40)).toBe('XL');
		expect(romanNumeral(2024)).toBe('MMXXIV');
	});

	it('clamps out-of-range values', () => {
		expect(romanNumeral(0)).toBe('I');
		expect(romanNumeral(-5)).toBe('I');
		expect(romanNumeral(4000)).toBe('MMMCMXCIX');
	});
});

describe('alphaLabel', () => {
	it('converts 1/26/27/53 with wrap-around', () => {
		expect(alphaLabel(1)).toBe('a');
		expect(alphaLabel(26)).toBe('z');
		expect(alphaLabel(27)).toBe('aa');
		expect(alphaLabel(53)).toBe('ba');
	});
});

// ---------------------------------------------------------------------------
// formatAutoNumber
// ---------------------------------------------------------------------------

describe('formatAutoNumber', () => {
	it('formats arabic variants', () => {
		expect(formatAutoNumber('arabicPeriod', 1)).toBe('1.');
		expect(formatAutoNumber('arabicParenR', 1)).toBe('1)');
		expect(formatAutoNumber('arabicParenBoth', 3)).toBe('(3)');
		expect(formatAutoNumber('arabicPlain', 5)).toBe('5');
	});

	it('formats alpha variants', () => {
		expect(formatAutoNumber('alphaLcPeriod', 3)).toBe('c.');
		expect(formatAutoNumber('alphaUcPeriod', 26)).toBe('Z.');
		expect(formatAutoNumber('alphaUcParenR', 2)).toBe('B)');
		expect(formatAutoNumber('alphaLcParenBoth', 2)).toBe('(b)');
	});

	it('formats roman variants', () => {
		expect(formatAutoNumber('romanLcPeriod', 4)).toBe('iv.');
		expect(formatAutoNumber('romanUcPeriod', 9)).toBe('IX.');
		expect(formatAutoNumber('romanUcParenBoth', 9)).toBe('(IX)');
	});

	it('falls back to "<n>." for unknown / undefined schemes', () => {
		expect(formatAutoNumber('unknownScheme', 7)).toBe('7.');
		expect(formatAutoNumber(undefined, 3)).toBe('3.');
	});
});

// ---------------------------------------------------------------------------
// resolveParagraphBullet
// ---------------------------------------------------------------------------

function seg(overrides: Partial<TextSegment> = {}): TextSegment {
	return { text: 'Hello', style: {}, ...overrides };
}

describe('resolveParagraphBullet', () => {
	it('returns undefined when no firstSegment / no bulletInfo', () => {
		expect(resolveParagraphBullet(undefined)).toBeUndefined();
		expect(resolveParagraphBullet(seg())).toBeUndefined();
	});

	it('returns undefined when bulletInfo.none is true (buNone)', () => {
		expect(resolveParagraphBullet(seg({ bulletInfo: { none: true } }))).toBeUndefined();
	});

	it('returns undefined when listType is "none"', () => {
		expect(
			resolveParagraphBullet(seg({ style: { listType: 'none' }, bulletInfo: { char: '•' } })),
		).toBeUndefined();
	});

	it('returns a "•" character bullet marker', () => {
		const result = resolveParagraphBullet(seg({ bulletInfo: { char: '•' } }));
		expect(result?.marker).toBe('•');
		expect(result?.isNumbered).toBeFalsy();
	});

	it('carries colour / font / size from bulletInfo', () => {
		const result = resolveParagraphBullet(
			seg({
				bulletInfo: {
					char: '→',
					color: '#FF0000',
					fontFamily: 'Wingdings',
					sizePercent: 75,
				},
			}),
		);
		expect(result?.marker).toBe('→');
		expect(result?.color).toBe('#FF0000');
		expect(result?.fontFamily).toBe('Wingdings');
		expect(result?.sizePercent).toBe(75);
	});

	it('renders auto-numbered markers using startAt + paragraphIndex', () => {
		expect(
			resolveParagraphBullet(seg({ bulletInfo: { autoNumType: 'arabicPeriod' } }))?.marker,
		).toBe('1.');
		expect(
			resolveParagraphBullet(
				seg({ bulletInfo: { autoNumType: 'arabicPeriod', autoNumStartAt: 1, paragraphIndex: 2 } }),
			)?.marker,
		).toBe('3.');
		expect(
			resolveParagraphBullet(
				seg({ bulletInfo: { autoNumType: 'romanUcPeriod', paragraphIndex: 3 } }),
			)?.marker,
		).toBe('IV.');
	});

	it('returns undefined for picture bullets (no char / autoNumType)', () => {
		expect(resolveParagraphBullet(seg({ bulletInfo: { imageRelId: 'rId1' } }))).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// bulletIndentPx / resolveParagraphIndent
// ---------------------------------------------------------------------------

describe('bulletIndentPx', () => {
	it('scales 18px per level, clamps undefined / negative to 0', () => {
		expect(bulletIndentPx(0)).toBe(0);
		expect(bulletIndentPx(1)).toBe(18);
		expect(bulletIndentPx(3)).toBe(54);
		expect(bulletIndentPx(undefined)).toBe(0);
		expect(bulletIndentPx(-2)).toBe(0);
	});
});

describe('resolveParagraphIndent', () => {
	it('uses explicit marginLeft / indent verbatim, omitting zeros', () => {
		expect(resolveParagraphIndent({ marginLeft: 40, indent: -20 }, 0)).toStrictEqual({
			marginLeftPx: 40,
			textIndentPx: -20,
		});
		expect(resolveParagraphIndent({ marginLeft: 0, indent: 0 }, 0)).toStrictEqual({});
	});

	it('falls back to per-level indent when no explicit indent present', () => {
		expect(resolveParagraphIndent(undefined, 2)).toStrictEqual({ marginLeftPx: 36 });
		expect(resolveParagraphIndent(undefined, 0)).toStrictEqual({});
	});
});
