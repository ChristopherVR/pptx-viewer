/**
 * Ordered alphabets and the label/numeral builders PowerPoint uses for the
 * alphabetic `ST_TextAutonumberScheme` families (Latin, Arabic, Hebrew, Hindi,
 * Thai) and the East-Asian `ea1*` numerals.
 *
 * Every table and rule here is COM-verified: a PowerPoint export of every
 * scheme at startAt 1..45 plus 99/100/101/110/1000/10000/12345 (the
 * 2026-09 limitations wave). Two findings shaped this module:
 *
 * - PowerPoint's alphabetic labels past the end of the alphabet REPEAT the
 *   letter (`z`, `aa`, `zz`, `aaa`), they are not spreadsheet-style bijective
 *   (`aa`, `ab`, ...). The same rule holds for the Arabic, Hindi and Thai
 *   letter schemes, and `hebrew2Minus` prefixes one `ת` per completed pass.
 * - The alphabets are not the naive Unicode blocks: Thai omits the obsolete
 *   `ฃ`/`ฅ` and also `ฆ`; Hindi vowels are the contiguous U+0905..U+0914
 *   (incl. `ऌ ऍ ऎ ऑ ऒ`); Hindi consonants include `ळ`; `arabic1Minus`
 *   starts at `أ`, and `arabic2Minus` walks the abjadi letter order rather
 *   than computing abjad numerals.
 *
 * @module auto-number-alphabets
 */

/** Devanagari independent vowels U+0905..U+0914, for `hindiAlphaPeriod`. */
export const HINDI_VOWELS: ReadonlyArray<string> = Array.from({ length: 16 }, (_v, i) =>
	String.fromCodePoint(0x0905 + i),
);

/** Devanagari consonants (with `ळ` after `ल`), for `hindiAlpha1Period`. */
export const HINDI_CONSONANTS: ReadonlyArray<string> = [
	'क',
	'ख',
	'ग',
	'घ',
	'ङ',
	'च',
	'छ',
	'ज',
	'झ',
	'ञ',
	'ट',
	'ठ',
	'ड',
	'ढ',
	'ण',
	'त',
	'थ',
	'द',
	'ध',
	'न',
	'प',
	'फ',
	'ब',
	'भ',
	'म',
	'य',
	'र',
	'ल',
	'ळ',
	'व',
	'श',
	'ष',
	'स',
	'ह',
];

/** Code points PowerPoint skips inside U+0E01..U+0E2E for the Thai letter schemes. */
const THAI_SKIPPED = new Set([0x0e03, 0x0e05, 0x0e06, 0x0e24, 0x0e26]);

/** The 41 Thai consonants PowerPoint counts for the `thaiAlpha*` schemes. */
export const THAI_CONSONANTS: ReadonlyArray<string> = Array.from(
	{ length: 46 },
	(_v, i) => 0x0e01 + i,
)
	.filter((cp) => !THAI_SKIPPED.has(cp))
	.map((cp) => String.fromCodePoint(cp));

/** The 28 Arabic letters in hija'i order (starting at `أ`), for `arabic1Minus`. */
export const ARABIC_HIJAI_LETTERS: ReadonlyArray<string> = [
	'أ',
	'ب',
	'ت',
	'ث',
	'ج',
	'ح',
	'خ',
	'د',
	'ذ',
	'ر',
	'ز',
	'س',
	'ش',
	'ص',
	'ض',
	'ط',
	'ظ',
	'ع',
	'غ',
	'ف',
	'ق',
	'ك',
	'ل',
	'م',
	'ن',
	'ه',
	'و',
	'ي',
];

/** The 28 Arabic letters in abjadi order, as PowerPoint walks them for `arabic2Minus`. */
export const ARABIC_ABJADI_LETTERS: ReadonlyArray<string> = [
	'أ',
	'ب',
	'ج',
	'د',
	'ه',
	'و',
	'ز',
	'ح',
	'ط',
	'ي',
	'ك',
	'ل',
	'م',
	'ن',
	'س',
	'ع',
	'ف',
	'ص',
	'ق',
	'ر',
	'ش',
	'ت',
	'ث',
	'خ',
	'ذ',
	'ض',
	'غ',
	'ظ',
];

/** The 22 Hebrew letters, for `hebrew2Minus`. */
export const HEBREW_LETTERS: ReadonlyArray<string> = Array.from('אבגדהוזחטיכלמנסעפצקרשת');

/**
 * PowerPoint's repeated-letter label: the letter at `(n-1) % len`, written
 * `floor((n-1) / len) + 1` times (`a`..`z`, `aa`..`zz`, `aaa`, ...).
 */
export function repeatedLabel(n: number, alphabet: ReadonlyArray<string>): string {
	const index = Math.max(0, Math.floor(n) - 1);
	const letter = alphabet[index % alphabet.length];
	return letter.repeat(Math.floor(index / alphabet.length) + 1);
}

/**
 * `hebrew2Minus` label: one `ת` per completed pass of the 22 letters, then
 * the letter for the remainder (23 -> `תא`, 100 -> `תתתתל`).
 */
export function hebrewAlphaLabel(n: number): string {
	const index = Math.max(0, Math.floor(n) - 1);
	return 'ת'.repeat(Math.floor(index / HEBREW_LETTERS.length)) + HEBREW_LETTERS[index % 22];
}

const CJK_DIGITS = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** Digit-by-digit CJK numeral with `〇` for zero (10 -> `一〇`, 12345 -> `一二三四五`). */
export function toCjkDigitString(n: number): string {
	return String(Math.max(0, Math.floor(n))).replace(/[0-9]/gu, (d) => CJK_DIGITS[Number(d)]);
}

/**
 * `ea1Cht*` numeral: 10..19 use the `十` form (`十`, `十一`, `十九`), every
 * other value is digit-by-digit (`二〇`, `九九`, `一〇一`).
 */
export function toEa1ChtNumeral(n: number): string {
	const value = Math.max(1, Math.floor(n));
	if (value >= 10 && value < 20) {
		return value === 10 ? '十' : `十${CJK_DIGITS[value - 10]}`;
	}
	return toCjkDigitString(value);
}
