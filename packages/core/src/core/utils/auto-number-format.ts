/**
 * The single implementation of OOXML auto-numbered bullet markers
 * (`ST_TextAutonumberScheme`, ECMA-376 §20.1.10.61 - all 41 values).
 *
 * Both the load path and the render layer need the SAME marker string for a
 * paragraph: core stamps it onto the parsed bullet segment, and the renderer
 * resolves it again from `BulletInfo`. While the two carried separate tables
 * they disagreed for every non-Latin scheme and painted a double marker
 * (`一.1. Item`). `pptx-viewer-shared` therefore re-exports this module rather
 * than keeping a second copy (core cannot import shared: shared depends on
 * core).
 *
 * The returned marker carries NO trailing space; callers that need one (the
 * bullet marker segment stamped at parse time) append it.
 *
 * @module auto-number-format
 */

import { formatScriptAutoNumber } from './auto-number-scripts';

/**
 * Convert a positive integer to a Roman numeral string (upper-case).
 * Input is clamped to [1, 3999].
 *
 * @example
 * romanNumeral(4)    // "IV"
 * romanNumeral(2024) // "MMXXIV"
 */
export function romanNumeral(n: number): string {
	const values: ReadonlyArray<number> = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
	const numerals: ReadonlyArray<string> = [
		'M',
		'CM',
		'D',
		'CD',
		'C',
		'XC',
		'L',
		'XL',
		'X',
		'IX',
		'V',
		'IV',
		'I',
	];
	let remaining = Math.max(1, Math.min(n, 3999));
	let result = '';
	for (let i = 0; i < values.length; i++) {
		while (remaining >= values[i]) {
			result += numerals[i];
			remaining -= values[i];
		}
	}
	return result;
}

/**
 * Convert a positive integer to a spreadsheet-style alphabetic label
 * (lower-case). 1 -> "a", 26 -> "z", 27 -> "aa", 52 -> "az", 53 -> "ba", …
 */
export function alphaLabel(n: number): string {
	let remaining = Math.max(1, n);
	let result = '';
	while (remaining > 0) {
		remaining -= 1;
		result = String.fromCharCode(97 + (remaining % 26)) + result;
		remaining = Math.floor(remaining / 26);
	}
	return result;
}

/**
 * Circled digit for the white/double-byte circle schemes: `①`..`⑳`
 * (U+2460..U+2473), `⓪` for zero. Values past 20 have no circled glyph and
 * degrade to the plain digits.
 */
function toCircledStd(v: number): string {
	if (v === 0) {
		return '⓪';
	}
	if (v < 1 || v > 20) {
		return `${v}`;
	}
	return String.fromCodePoint(0x245f + v);
}

/**
 * Negative (black) circled digit for `circleNumWdBlackPlain`: `❶`..`❿`
 * (U+2776..U+277F) then `⓫`..`⓴` (U+24EB..U+24F4), `⓿` (U+24FF) for zero.
 */
function toCircledBlack(v: number): string {
	if (v === 0) {
		return '⓿';
	}
	if (v >= 1 && v <= 10) {
		return String.fromCodePoint(0x2775 + v);
	}
	if (v >= 11 && v <= 20) {
		return String.fromCodePoint(0x24eb + (v - 11));
	}
	return `${v}`;
}

/**
 * Render the n-th (1-based) marker for an OOXML auto-numbering scheme.
 *
 * Suffix conventions: `…Period` -> `label.`, `…ParenR` -> `label)`,
 * `…ParenBoth` -> `(label)`, `…Minus` -> `label-`, `…Plain` -> bare numeral.
 * Unrecognised schemes fall back to `"<n>."`.
 */
export function formatAutoNumberMarker(autoNumType: string | undefined, n: number): string {
	if (!autoNumType) {
		return `${n}.`;
	}

	switch (autoNumType) {
		case 'arabicPeriod':
		case 'arabicDbPeriod':
			return `${n}.`;
		case 'arabicParenR':
			return `${n})`;
		case 'arabicParenBoth':
			return `(${n})`;
		case 'arabicPlain':
		case 'arabicDbPlain':
			return `${n}`;
		case 'alphaLcPeriod':
			return `${alphaLabel(n)}.`;
		case 'alphaUcPeriod':
			return `${alphaLabel(n).toUpperCase()}.`;
		case 'alphaLcParenR':
			return `${alphaLabel(n)})`;
		case 'alphaUcParenR':
			return `${alphaLabel(n).toUpperCase()})`;
		case 'alphaLcParenBoth':
			return `(${alphaLabel(n)})`;
		case 'alphaUcParenBoth':
			return `(${alphaLabel(n).toUpperCase()})`;
		case 'romanLcPeriod':
			return `${romanNumeral(n).toLowerCase()}.`;
		case 'romanUcPeriod':
			return `${romanNumeral(n)}.`;
		case 'romanLcParenR':
			return `${romanNumeral(n).toLowerCase()})`;
		case 'romanUcParenR':
			return `${romanNumeral(n)})`;
		case 'romanLcParenBoth':
			return `(${romanNumeral(n).toLowerCase()})`;
		case 'romanUcParenBoth':
			return `(${romanNumeral(n)})`;
		case 'circleNumDbPlain':
		case 'circleNumWdWhitePlain':
			return toCircledStd(n);
		case 'circleNumWdBlackPlain':
			return toCircledBlack(n);
		default:
			// East-Asian (ea1*) / Hebrew / Arabic / Hindi / Thai schemes; falls
			// through to the Arabic `n.` default only when the scheme is
			// genuinely unknown.
			return formatScriptAutoNumber(autoNumType, n) ?? `${n}.`;
	}
}

/**
 * Every `ST_TextAutonumberScheme` value, for exhaustiveness tests and pickers.
 * Order follows the schema's enumeration.
 */
export const TEXT_AUTONUMBER_SCHEMES: ReadonlyArray<string> = [
	'alphaLcParenBoth',
	'alphaUcParenBoth',
	'alphaLcParenR',
	'alphaUcParenR',
	'alphaLcPeriod',
	'alphaUcPeriod',
	'arabicParenBoth',
	'arabicParenR',
	'arabicPeriod',
	'arabicPlain',
	'romanLcParenBoth',
	'romanUcParenBoth',
	'romanLcParenR',
	'romanUcParenR',
	'romanLcPeriod',
	'romanUcPeriod',
	'circleNumDbPlain',
	'circleNumWdBlackPlain',
	'circleNumWdWhitePlain',
	'arabicDbPeriod',
	'arabicDbPlain',
	'ea1ChsPeriod',
	'ea1ChsPlain',
	'ea1ChtPeriod',
	'ea1ChtPlain',
	'ea1JpnChsDbPeriod',
	'ea1JpnKorPlain',
	'ea1JpnKorPeriod',
	'arabic1Minus',
	'arabic2Minus',
	'hebrew2Minus',
	'thaiAlphaPeriod',
	'thaiAlphaParenR',
	'thaiAlphaParenBoth',
	'thaiNumPeriod',
	'thaiNumParenR',
	'thaiNumParenBoth',
	'hindiAlphaPeriod',
	'hindiNumPeriod',
	'hindiNumParenR',
	'hindiAlpha1Period',
];
