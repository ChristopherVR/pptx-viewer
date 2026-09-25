import { describe, it, expect } from 'vitest';

import {
	TEXT_AUTONUMBER_SCHEMES,
	alphaLabel,
	formatAutoNumberMarker,
	romanNumeral,
} from './auto-number-format';

describe('formatAutoNumberMarker', () => {
	it('covers every ST_TextAutonumberScheme value in the enumeration', () => {
		// The 41 values of ECMA-376 §20.1.10.61.
		expect(TEXT_AUTONUMBER_SCHEMES).toHaveLength(41);
		expect(new Set(TEXT_AUTONUMBER_SCHEMES).size).toBe(41);
	});

	it('formats the Latin families', () => {
		expect(formatAutoNumberMarker('arabicPeriod', 3)).toBe('3.');
		expect(formatAutoNumberMarker('arabicParenR', 3)).toBe('3)');
		expect(formatAutoNumberMarker('arabicParenBoth', 3)).toBe('(3)');
		expect(formatAutoNumberMarker('arabicPlain', 3)).toBe('3');
		expect(formatAutoNumberMarker('alphaUcPeriod', 27)).toBe('AA.');
		expect(formatAutoNumberMarker('alphaLcParenBoth', 2)).toBe('(b)');
		expect(formatAutoNumberMarker('romanUcPeriod', 4)).toBe('IV.');
		expect(formatAutoNumberMarker('romanLcParenR', 9)).toBe('ix)');
	});

	it('formats the circled families with circled glyphs, not bare digits', () => {
		expect(formatAutoNumberMarker('circleNumDbPlain', 1)).toBe('①');
		expect(formatAutoNumberMarker('circleNumDbPlain', 20)).toBe('⑳');
		expect(formatAutoNumberMarker('circleNumDbPlain', 21)).toBe('21');
		expect(formatAutoNumberMarker('circleNumWdBlackPlain', 1)).toBe('❶');
		// COM: the Wingdings circle schemes cycle through 1..10.
		expect(formatAutoNumberMarker('circleNumWdWhitePlain', 12)).toBe('②');
		expect(formatAutoNumberMarker('circleNumWdBlackPlain', 11)).toBe('❶');
		expect(formatAutoNumberMarker('circleNumWdBlackPlain', 45)).toBe('❺');
		expect(formatAutoNumberMarker('circleNumWdBlackPlain', 100)).toBe('❿');
	});

	/**
	 * The load path used to fall through to `"<n>."` for every scheme below,
	 * while the renderer formatted them properly. Since the paragraph builder
	 * drops the parsed marker segment only when the two strings agree, each of
	 * these painted a DOUBLE marker ("一.1. Item").
	 */
	it('formats the East-Asian, Hebrew, Arabic, Hindi and Thai families', () => {
		expect(formatAutoNumberMarker('ea1ChsPeriod', 1)).toBe('一.');
		expect(formatAutoNumberMarker('ea1ChsPlain', 12)).toBe('十二');
		expect(formatAutoNumberMarker('ea1ChtPeriod', 3)).toBe('三.');
		expect(formatAutoNumberMarker('ea1JpnChsDbPeriod', 2)).toBe('二．');
		expect(formatAutoNumberMarker('ea1JpnKorPlain', 5)).toBe('五');
		expect(formatAutoNumberMarker('ea1JpnKorPeriod', 5)).toBe('五.');
		expect(formatAutoNumberMarker('hebrew2Minus', 15)).toBe('ס-');
		expect(formatAutoNumberMarker('hindiNumPeriod', 21)).toBe('२१.');
		expect(formatAutoNumberMarker('hindiAlphaPeriod', 1)).toBe('अ.');
		expect(formatAutoNumberMarker('hindiAlpha1Period', 1)).toBe('क.');
		expect(formatAutoNumberMarker('thaiNumParenBoth', 1)).toBe('(๑)');
		expect(formatAutoNumberMarker('thaiAlphaPeriod', 1)).toBe('ก.');
	});

	it('formats the two Arabic minus schemes that neither formatter covered', () => {
		expect(formatAutoNumberMarker('arabic1Minus', 1)).toBe('أ-');
		expect(formatAutoNumberMarker('arabic1Minus', 3)).toBe('ت-');
		expect(formatAutoNumberMarker('arabic2Minus', 3)).toBe('ج-');
		expect(formatAutoNumberMarker('arabic2Minus', 20)).toBe('ر-');
	});

	/**
	 * Ground truth: a PowerPoint (COM) export of every scheme at startAt
	 * 1..45 plus 99..12345, 2026-09 limitations wave.
	 */
	it.each([
		['alphaLcPeriod', 27, 'aa.'],
		['alphaLcPeriod', 52, 'zz.'],
		['alphaLcPeriod', 53, 'aaa.'],
		['alphaLcParenBoth', 100, '(vvvv)'],
		['arabicDbPeriod', 1, '１．'],
		['arabicDbPeriod', 10, '１０．'],
		['arabicDbPlain', 21, '２１'],
		['ea1ChsPeriod', 45, '四十五.'],
		['ea1ChsPeriod', 99, '九十九.'],
		['ea1ChsPeriod', 100, '一〇〇.'],
		['ea1ChsPeriod', 110, '一一〇.'],
		['ea1ChsPlain', 12345, '一二三四五'],
		['ea1ChtPeriod', 10, '十.'],
		['ea1ChtPeriod', 19, '十九.'],
		['ea1ChtPeriod', 20, '二〇.'],
		['ea1ChtPlain', 45, '四五'],
		['ea1JpnChsDbPeriod', 10, '一〇．'],
		['ea1JpnKorPlain', 11, '一一'],
		['ea1JpnKorPeriod', 1000, '一〇〇〇.'],
		['arabic1Minus', 28, 'ي-'],
		['arabic1Minus', 29, 'أأ-'],
		['arabic2Minus', 10, 'ي-'],
		['arabic2Minus', 28, 'ظ-'],
		['arabic2Minus', 29, 'أأ-'],
		['hebrew2Minus', 22, 'ת-'],
		['hebrew2Minus', 23, 'תא-'],
		['hebrew2Minus', 100, 'תתתתל-'],
		['thaiAlphaPeriod', 3, 'ค.'],
		['thaiAlphaPeriod', 4, 'ง.'],
		['thaiAlphaPeriod', 41, 'ฮ.'],
		['thaiAlphaPeriod', 42, 'กก.'],
		['thaiAlphaParenR', 100, 'ตตต)'],
		['hindiAlphaPeriod', 8, 'ऌ.'],
		['hindiAlphaPeriod', 16, 'औ.'],
		['hindiAlphaPeriod', 17, 'अअ.'],
		['hindiAlpha1Period', 29, 'ळ.'],
		['hindiAlpha1Period', 34, 'ह.'],
		['hindiAlpha1Period', 35, 'कक.'],
	])('%s at %i renders %s like PowerPoint', (scheme, n, expected) => {
		expect(formatAutoNumberMarker(scheme, n)).toBe(expected);
	});

	it('never falls back to the Arabic default for a scheme in the enumeration', () => {
		const arabicByDesign = new Set([
			'arabicPeriod',
			'arabicDbPeriod',
			'arabicParenBoth',
			'arabicParenR',
			'arabicPlain',
			'arabicDbPlain',
		]);
		for (const scheme of TEXT_AUTONUMBER_SCHEMES) {
			if (arabicByDesign.has(scheme)) {
				continue;
			}
			expect(`${scheme}:${formatAutoNumberMarker(scheme, 7)}`).not.toBe(`${scheme}:7.`);
		}
	});

	it('falls back to the Arabic form for an unknown or missing scheme', () => {
		expect(formatAutoNumberMarker(undefined, 4)).toBe('4.');
		expect(formatAutoNumberMarker('notAScheme', 4)).toBe('4.');
	});

	it('exposes the Latin numeral helpers', () => {
		expect(romanNumeral(2024)).toBe('MMXXIV');
		expect(alphaLabel(28)).toBe('bb');
	});
});
