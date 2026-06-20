/**
 * Pure paragraph bullet / list-marker helpers for the Angular text renderer.
 *
 * No Angular imports: all exports are plain TypeScript functions suitable for
 * use inside computed signals or template helper calls.
 *
 * Numbering schemes follow the OOXML `ST_TextAutonumberScheme` enumeration
 * (ECMA-376 §20.1.10.81). The `autoNumType` strings come from
 * `BulletInfo.autoNumType` as parsed by `pptx-viewer-core`.
 */

import type { BulletInfo, TextSegment } from 'pptx-viewer-core';

// ---------------------------------------------------------------------------
// Low-level number-formatting helpers
// ---------------------------------------------------------------------------

/**
 * Convert a positive integer to a Roman numeral string (upper-case).
 * Input is clamped to [1, 3999].
 *
 * @example
 * romanNumeral(4)    // "IV"
 * romanNumeral(9)    // "IX"
 * romanNumeral(40)   // "XL"
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
 *
 * @example
 * alphaLabel(1)  // "a"
 * alphaLabel(26) // "z"
 * alphaLabel(27) // "aa"
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

// ---------------------------------------------------------------------------
// autoNumType → marker string
// ---------------------------------------------------------------------------

/**
 * Render the n-th (1-based) marker for an OOXML auto-numbering scheme.
 *
 * Suffix conventions:
 * - `…Period`    →  `label.`  (e.g. "1.", "a.", "i.")
 * - `…ParenR`    →  `label)`  (e.g. "1)", "a)", "i)")
 * - `…ParenBoth` →  `(label)` (e.g. "(1)", "(a)", "(i)")
 * - `…Plain`     →  `label`   (bare numeral)
 *
 * Unrecognised schemes fall back to `"<n>."`.
 *
 * @param autoNumType - The OOXML auto-number type string (e.g. "arabicPeriod").
 * @param n           - 1-based sequence number to format.
 */
export function formatAutoNumber(autoNumType: string | undefined, n: number): string {
	if (!autoNumType) {
		return `${n}.`;
	}

	// circled-digit helpers (Unicode block U+2460…)
	const toCircledStd = (v: number): string => {
		if (v < 0 || v > 9) {
			return `${v}`;
		}
		return v === 0 ? '⓪' : String.fromCodePoint(0x245f + v);
	};
	const toCircledBlack = (v: number): string => {
		if (v < 0 || v > 9) {
			return `${v}`;
		}
		return v === 0 ? '⓿' : String.fromCodePoint(0x24eb + v);
	};

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
			return `${n}.`;
	}
}

// ---------------------------------------------------------------------------
// Paragraph-level bullet resolution
// ---------------------------------------------------------------------------

/**
 * Resolved bullet marker for a single paragraph.
 *
 * `marker`     : the text to prepend (e.g. "•", "1.", "a)").
 * `isNumbered` : true for auto-numbered lists; false for character bullets.
 * `color`      : optional explicit bullet colour (hex string from `BulletInfo.color`).
 * `fontFamily` : optional explicit bullet font (from `BulletInfo.fontFamily`).
 */
export interface ParagraphBulletResult {
	marker: string;
	isNumbered: boolean;
	color?: string;
	fontFamily?: string;
}

/**
 * Resolve the bullet marker for the first segment of a paragraph.
 *
 * Returns `undefined` when:
 * - `firstSegment` is undefined or carries no `bulletInfo`.
 * - `bulletInfo.none` is `true` (`a:buNone` explicitly suppresses the bullet).
 * - The paragraph's `listType` is `'none'`.
 * - Neither `char` nor `autoNumType` is present.
 *
 * For auto-numbered bullets the 1-based sequence index is derived from
 * `bulletInfo.autoNumStartAt` (default 1) plus `bulletInfo.paragraphIndex`
 * (0-based paragraph position within the text body).
 *
 * @param firstSegment - The first `TextSegment` of the paragraph (carries `bulletInfo`).
 */
export function resolveParagraphBullet(
	firstSegment: TextSegment | undefined,
): ParagraphBulletResult | undefined {
	if (!firstSegment) {
		return undefined;
	}

	// listType on the style of the first segment can explicitly suppress bullets.
	if (firstSegment.style?.listType === 'none') {
		return undefined;
	}

	const info: BulletInfo | undefined = firstSegment.bulletInfo;
	if (!info) {
		return undefined;
	}

	// `a:buNone` explicitly suppresses any inherited bullet.
	if (info.none) {
		return undefined;
	}

	const color: string | undefined = info.color;
	const fontFamily: string | undefined = info.fontFamily;

	// ── Auto-numbered list ──
	if (info.autoNumType) {
		const startAt = typeof info.autoNumStartAt === 'number' ? info.autoNumStartAt : 1;
		const paraIdx = typeof info.paragraphIndex === 'number' ? info.paragraphIndex : 0;
		// Convert from 0-based paragraph index + startAt to a 1-based sequence number.
		const seqNum = Math.max(1, startAt + paraIdx);
		return {
			marker: formatAutoNumber(info.autoNumType, seqNum),
			isNumbered: true,
			color,
			fontFamily,
		};
	}

	// ── Character bullet ──
	if (info.char) {
		return {
			marker: info.char,
			isNumbered: false,
			color,
			fontFamily,
		};
	}

	// Picture bullets and unsupported cases: no marker to show as text.
	return undefined;
}

// ---------------------------------------------------------------------------
// Indent helpers
// ---------------------------------------------------------------------------

/** Pixels of left-padding to apply per list nesting level. */
const INDENT_PX_PER_LEVEL = 18;

/**
 * Return the left-indent in pixels for the given list nesting level.
 *
 * `level` is the 0-based `paragraphLevel` from `TextSegment` (matches
 * OOXML `a:p/@lvl`). `undefined` or negative values are treated as level 0.
 *
 * @example
 * bulletIndentPx(0)         // 0
 * bulletIndentPx(1)         // 18
 * bulletIndentPx(3)         // 54
 * bulletIndentPx(undefined) // 0
 */
export function bulletIndentPx(level: number | undefined): number {
	const lvl = typeof level === 'number' && level > 0 ? level : 0;
	return lvl * INDENT_PX_PER_LEVEL;
}
