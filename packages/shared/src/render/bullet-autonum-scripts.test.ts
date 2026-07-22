import { describe, expect, it } from 'vitest';

import { formatAutoNumber } from './bullet-autonum';
import {
	bijectiveLabel,
	formatScriptAutoNumber,
	THAI_CONSONANTS,
	toChineseNumeral,
	toDevanagariDigits,
	toFullWidthDigits,
	toHebrewNumeral,
	toThaiDigits,
} from './bullet-autonum-scripts';

describe('script digit converters', () => {
	it('maps Devanagari / Thai / full-width digits', () => {
		expect(toDevanagariDigits(0)).toBe('०');
		expect(toDevanagariDigits(12)).toBe('१२');
		expect(toThaiDigits(0)).toBe('๐');
		expect(toThaiDigits(305)).toBe('๓๐๕');
		expect(toFullWidthDigits(7)).toBe('７');
		expect(toFullWidthDigits(10)).toBe('１０');
	});
});

describe('toChineseNumeral', () => {
	it('renders the common range with collapsed leading ten', () => {
		expect(toChineseNumeral(1, false)).toBe('一');
		expect(toChineseNumeral(10, false)).toBe('十');
		expect(toChineseNumeral(11, false)).toBe('十一');
		expect(toChineseNumeral(20, false)).toBe('二十');
		expect(toChineseNumeral(100, false)).toBe('一百');
		expect(toChineseNumeral(101, false)).toBe('一百零一');
		expect(toChineseNumeral(110, false)).toBe('一百一十');
	});

	it('renders myriads and swaps the traditional glyph', () => {
		expect(toChineseNumeral(10000, false)).toBe('一万');
		expect(toChineseNumeral(10001, false)).toBe('一万零一');
		expect(toChineseNumeral(10000, true)).toBe('一萬');
	});
});

describe('toHebrewNumeral', () => {
	it('renders gematria with the 15/16 special-case', () => {
		expect(toHebrewNumeral(1)).toBe('א');
		expect(toHebrewNumeral(10)).toBe('י');
		expect(toHebrewNumeral(15)).toBe('טו');
		expect(toHebrewNumeral(16)).toBe('טז');
		expect(toHebrewNumeral(21)).toBe('כא');
		expect(toHebrewNumeral(115)).toBe('קטו');
	});
});

describe('bijectiveLabel', () => {
	it('cycles a script alphabet like spreadsheet columns', () => {
		expect(bijectiveLabel(1, THAI_CONSONANTS)).toBe('ก');
		expect(bijectiveLabel(THAI_CONSONANTS.length, THAI_CONSONANTS)).toBe('ฮ');
		expect(bijectiveLabel(THAI_CONSONANTS.length + 1, THAI_CONSONANTS)).toBe('กก');
	});
});

describe('formatScriptAutoNumber', () => {
	it('formats East-Asian schemes with suffixes', () => {
		expect(formatScriptAutoNumber('ea1ChsPeriod', 3)).toBe('三.');
		expect(formatScriptAutoNumber('ea1ChsPlain', 3)).toBe('三');
		expect(formatScriptAutoNumber('ea1ChtPlain', 10000)).toBe('一萬');
		expect(formatScriptAutoNumber('ea1JpnChsDbPeriod', 2)).toBe('二．');
		expect(formatScriptAutoNumber('ea1JpnKorPlain', 4)).toBe('４');
		expect(formatScriptAutoNumber('ea1JpnKorPeriod', 4)).toBe('４.');
	});

	it('formats Hebrew, Hindi and Thai schemes', () => {
		expect(formatScriptAutoNumber('hebrew2Minus', 15)).toBe('טו-');
		expect(formatScriptAutoNumber('hindiNumPeriod', 12)).toBe('१२.');
		expect(formatScriptAutoNumber('hindiNumParenR', 3)).toBe('३)');
		expect(formatScriptAutoNumber('hindiAlphaPeriod', 1)).toBe('अ.');
		expect(formatScriptAutoNumber('hindiAlpha1Period', 1)).toBe('क.');
		expect(formatScriptAutoNumber('thaiNumParenBoth', 5)).toBe('(๕)');
		expect(formatScriptAutoNumber('thaiAlphaParenR', 1)).toBe('ก)');
	});

	it('returns undefined for a non-script scheme', () => {
		expect(formatScriptAutoNumber('arabicPeriod', 1)).toBeUndefined();
	});
});

describe('formatAutoNumber integration', () => {
	it('routes script schemes through the shared entry point', () => {
		expect(formatAutoNumber('ea1ChsPeriod', 3)).toBe('三.');
		expect(formatAutoNumber('thaiNumPeriod', 9)).toBe('๙.');
		// Genuinely unknown scheme still falls back to Arabic "n.".
		expect(formatAutoNumber('totallyUnknown', 7)).toBe('7.');
	});
});
