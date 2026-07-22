/**
 * Auto-numbering helpers for paragraph bullets (framework-agnostic).
 *
 * Numbering schemes follow the OOXML `ST_TextAutonumberScheme` enumeration
 * (ECMA-376 §20.1.10.81). The `autoNumType` strings come from
 * `BulletInfo.autoNumType` as parsed by `pptx-viewer-core`. Split out of
 * `bullet-list` to keep each module focused and small.
 */

import { formatScriptAutoNumber } from './bullet-autonum-scripts';

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
 * Convert a positive integer to a spreadsheet-style alphabetic label (lower-case).
 * 1→"a", 26→"z", 27→"aa", 52→"az", 53→"ba", …
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

/** Circled-digit (Unicode U+2460…) for circle-number schemes. */
function toCircledStd(v: number): string {
	if (v < 0 || v > 9) {
		return `${v}`;
	}
	return v === 0 ? '⓪' : String.fromCodePoint(0x245f + v);
}

/** Negative (black) circled digit (Unicode U+24EB…). */
function toCircledBlack(v: number): string {
	if (v < 0 || v > 9) {
		return `${v}`;
	}
	return v === 0 ? '⓿' : String.fromCodePoint(0x24eb + v);
}

/**
 * Render the n-th (1-based) marker for an OOXML auto-numbering scheme.
 *
 * Suffix conventions: `…Period` → `label.`, `…ParenR` → `label)`,
 * `…ParenBoth` → `(label)`, `…Plain` → bare numeral. Unrecognised schemes
 * fall back to `"<n>."`.
 */
export function formatAutoNumber(autoNumType: string | undefined, n: number): string {
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
			// East-Asian (ea1*) / Hebrew / Hindi / Thai schemes; falls through to
			// the Arabic `n.` default only when the scheme is genuinely unknown.
			return formatScriptAutoNumber(autoNumType, n) ?? `${n}.`;
	}
}
