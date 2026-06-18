import { describe, expect, it } from 'vitest';

import { alphaLabel, formatAutoNumber, romanNumeral } from './bullet-autonum';

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
