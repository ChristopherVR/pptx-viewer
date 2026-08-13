import { TEXT_AUTONUMBER_SCHEMES, formatAutoNumberMarker } from 'pptx-viewer-core';
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

describe('single implementation shared with the load path', () => {
	it('is literally the function core stamps the marker segment with', () => {
		// Two independent tables is what produced the double marker: core wrote
		// "1." for `ea1ChsPeriod` while this module wrote "一.", and the
		// paragraph builder drops the parsed marker segment only when the two
		// strings agree.
		expect(formatAutoNumber).toBe(formatAutoNumberMarker);
	});

	it('agrees with the load path on every ST_TextAutonumberScheme value', () => {
		for (const scheme of TEXT_AUTONUMBER_SCHEMES) {
			for (const n of [1, 2, 11, 27]) {
				expect(formatAutoNumber(scheme, n)).toBe(formatAutoNumberMarker(scheme, n));
			}
		}
	});

	it('renders the non-Latin families in their own script', () => {
		expect(formatAutoNumber('ea1ChsPeriod', 1)).toBe('一.');
		expect(formatAutoNumber('thaiNumPeriod', 1)).toBe('๑.');
		expect(formatAutoNumber('hindiAlphaPeriod', 1)).toBe('अ.');
		expect(formatAutoNumber('hebrew2Minus', 15)).toBe('טו-');
		// Neither formatter covered the two Arabic minus schemes before.
		expect(formatAutoNumber('arabic1Minus', 1)).toBe('ا-');
		expect(formatAutoNumber('arabic2Minus', 3)).toBe('ج-');
	});
});
