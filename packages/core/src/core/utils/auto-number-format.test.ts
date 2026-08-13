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
		expect(formatAutoNumberMarker('circleNumWdWhitePlain', 12)).toBe('⑫');
		expect(formatAutoNumberMarker('circleNumWdBlackPlain', 1)).toBe('❶');
		expect(formatAutoNumberMarker('circleNumWdBlackPlain', 11)).toBe('⓫');
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
		expect(formatAutoNumberMarker('ea1JpnKorPlain', 5)).toBe('５');
		expect(formatAutoNumberMarker('ea1JpnKorPeriod', 5)).toBe('５.');
		expect(formatAutoNumberMarker('hebrew2Minus', 15)).toBe('טו-');
		expect(formatAutoNumberMarker('hindiNumPeriod', 21)).toBe('२१.');
		expect(formatAutoNumberMarker('hindiAlphaPeriod', 1)).toBe('अ.');
		expect(formatAutoNumberMarker('hindiAlpha1Period', 1)).toBe('क.');
		expect(formatAutoNumberMarker('thaiNumParenBoth', 1)).toBe('(๑)');
		expect(formatAutoNumberMarker('thaiAlphaPeriod', 1)).toBe('ก.');
	});

	it('formats the two Arabic minus schemes that neither formatter covered', () => {
		expect(formatAutoNumberMarker('arabic1Minus', 1)).toBe('ا-');
		expect(formatAutoNumberMarker('arabic1Minus', 3)).toBe('ت-');
		expect(formatAutoNumberMarker('arabic2Minus', 3)).toBe('ج-');
		expect(formatAutoNumberMarker('arabic2Minus', 20)).toBe('ك-');
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
		expect(alphaLabel(28)).toBe('ab');
	});
});
