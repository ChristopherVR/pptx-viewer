/**
 * Script-specific numeral converters for OOXML `ST_TextAutonumberScheme`
 * auto-numbered bullets (framework-agnostic). Covers the East-Asian (`ea1*`),
 * Hebrew, Hindi (Devanagari), and Thai numbering families that previously fell
 * back to plain Arabic `n.`. Split out of `bullet-autonum` to keep each module
 * focused; consumed only by {@link ./bullet-autonum}.
 */

/** Clamp to a positive integer for indexing/formatting. */
function posInt(n: number, max: number): number {
	return Math.max(1, Math.min(Math.floor(n), max));
}

/** Map ASCII digits of `n` onto a script digit block (e.g. Devanagari `U+0966`). */
function mapDigits(n: number, base: number): string {
	return String(Math.max(0, Math.floor(n))).replace(/[0-9]/gu, (d) =>
		String.fromCodePoint(base + Number(d)),
	);
}

/** Devanagari (Hindi) digits `०१२…` (U+0966). */
export function toDevanagariDigits(n: number): string {
	return mapDigits(n, 0x0966);
}

/** Thai digits `๐๑๒…` (U+0E50). */
export function toThaiDigits(n: number): string {
	return mapDigits(n, 0x0e50);
}

/** Full-width Arabic digits `０１２…` (U+FF10), used by JPN/KOR schemes. */
export function toFullWidthDigits(n: number): string {
	return mapDigits(n, 0xff10);
}

/**
 * Bijective (spreadsheet-style) label over an arbitrary ordered alphabet:
 * 1→a, len→last, len+1→aa. Reused for Hindi/Thai alphabetic schemes.
 */
export function bijectiveLabel(n: number, alphabet: ReadonlyArray<string>): string {
	const base = alphabet.length;
	let remaining = Math.max(1, Math.floor(n));
	let result = '';
	while (remaining > 0) {
		remaining -= 1;
		result = alphabet[remaining % base] + result;
		remaining = Math.floor(remaining / base);
	}
	return result;
}

/** Devanagari independent vowels, for the Hindi `hindiAlpha*` schemes. */
export const HINDI_VOWELS: ReadonlyArray<string> = [
	'अ',
	'आ',
	'इ',
	'ई',
	'उ',
	'ऊ',
	'ए',
	'ऐ',
	'ओ',
	'औ',
	'अं',
	'अः',
];

/** Devanagari consonants, for the Hindi `hindiAlpha1*` schemes. */
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
	'व',
	'श',
	'ष',
	'स',
	'ह',
];

/**
 * The 44 Thai consonants `ก…ฮ` for the `thaiAlpha*` schemes. Generated across
 * `U+0E01…U+0E2E`, excluding the two vowel-like code points `ฤ` (U+0E24) and
 * `ฦ` (U+0E26) that fall inside the block but are not counted as consonants.
 */
export const THAI_CONSONANTS: ReadonlyArray<string> = Array.from({ length: 46 }, (_v, i) => i)
	.filter((i) => i !== 0x0e24 - 0x0e01 && i !== 0x0e26 - 0x0e01)
	.map((i) => String.fromCodePoint(0x0e01 + i));

/**
 * Hebrew alphabetic (gematria) numeral for the `hebrew2Minus` scheme.
 * Handles the 15/16 special-casing (`טו`/`טז`) that avoids spelling the divine
 * name. Clamped to [1, 999].
 */
export function toHebrewNumeral(n: number): string {
	const value = posInt(n, 999);
	const hundreds = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
	const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
	const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
	const result =
		hundreds[Math.floor(value / 100)] + tens[Math.floor((value % 100) / 10)] + ones[value % 10];
	return result.replace('יה', 'טו').replace('יו', 'טז');
}

/** Render 0..9999 as a CJK numeral, inserting `零` fillers between gaps. */
function cjkUnder10000(x: number, digits: ReadonlyArray<string>): string {
	const smallUnits = ['', '十', '百', '千'];
	const str = String(x);
	const len = str.length;
	let result = '';
	let zeroPending = false;
	let started = false;
	for (let i = 0; i < len; i++) {
		const digit = Number(str[i]);
		const unitPos = len - 1 - i;
		if (digit === 0) {
			zeroPending = started;
			continue;
		}
		if (zeroPending) {
			result += digits[0];
			zeroPending = false;
		}
		result += digits[digit] + smallUnits[unitPos];
		started = true;
	}
	return result;
}

/**
 * Convert `n` to a Chinese numeral string. `traditional` selects the
 * traditional myriad glyph (`萬`) over the simplified (`万`); the 0-9 digit and
 * 十/百/千 unit glyphs are shared. Clamped below 100,000,000. Leading `一十`
 * (10-19) collapses to `十`, matching PowerPoint.
 */
export function toChineseNumeral(n: number, traditional: boolean): string {
	const value = posInt(n, 99_999_999);
	const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
	const myriad = traditional ? '萬' : '万';
	if (value < 10000) {
		const label = cjkUnder10000(value, digits);
		return value >= 10 && value < 20 ? label.replace(/^一十/u, '十') : label;
	}
	const high = Math.floor(value / 10000);
	const low = value % 10000;
	let result = cjkUnder10000(high, digits) + myriad;
	if (low > 0) {
		if (low < 1000) {
			result += digits[0];
		}
		result += cjkUnder10000(low, digits);
	}
	return result;
}

/** Apply an OOXML suffix convention to a raw numeral label. */
function suffixed(label: string, suffix: 'period' | 'dbPeriod' | 'parenR' | 'parenBoth'): string {
	switch (suffix) {
		case 'period':
			return `${label}.`;
		case 'dbPeriod':
			// Full-width period (U+FF0E) for the double-byte JPN scheme.
			return `${label}．`;
		case 'parenR':
			return `${label})`;
		case 'parenBoth':
			return `(${label})`;
	}
}

/**
 * Format the n-th (1-based) marker for the East-Asian / Hebrew / Hindi / Thai
 * `ST_TextAutonumberScheme` families. Returns `undefined` for any scheme this
 * module does not handle, so the caller can fall back to its Arabic default.
 */
export function formatScriptAutoNumber(autoNumType: string, n: number): string | undefined {
	switch (autoNumType) {
		// ── East Asian (Chinese / Japanese / Korean) ──
		case 'ea1ChsPeriod':
			return suffixed(toChineseNumeral(n, false), 'period');
		case 'ea1ChsPlain':
			return toChineseNumeral(n, false);
		case 'ea1ChtPeriod':
			return suffixed(toChineseNumeral(n, true), 'period');
		case 'ea1ChtPlain':
			return toChineseNumeral(n, true);
		case 'ea1JpnChsDbPeriod':
			return suffixed(toChineseNumeral(n, false), 'dbPeriod');
		case 'ea1JpnKorPlain':
			return toFullWidthDigits(n);
		case 'ea1JpnKorPeriod':
			return suffixed(toFullWidthDigits(n), 'period');
		// ── Hebrew (gematria, trailing minus separator) ──
		case 'hebrew2Minus':
			return `${toHebrewNumeral(n)}-`;
		// ── Hindi (Devanagari) ──
		case 'hindiNumPeriod':
			return suffixed(toDevanagariDigits(n), 'period');
		case 'hindiNumParenR':
			return suffixed(toDevanagariDigits(n), 'parenR');
		case 'hindiAlphaPeriod':
			return suffixed(bijectiveLabel(n, HINDI_VOWELS), 'period');
		case 'hindiAlpha1Period':
			return suffixed(bijectiveLabel(n, HINDI_CONSONANTS), 'period');
		// ── Thai ──
		case 'thaiNumPeriod':
			return suffixed(toThaiDigits(n), 'period');
		case 'thaiNumParenR':
			return suffixed(toThaiDigits(n), 'parenR');
		case 'thaiNumParenBoth':
			return suffixed(toThaiDigits(n), 'parenBoth');
		case 'thaiAlphaPeriod':
			return suffixed(bijectiveLabel(n, THAI_CONSONANTS), 'period');
		case 'thaiAlphaParenR':
			return suffixed(bijectiveLabel(n, THAI_CONSONANTS), 'parenR');
		case 'thaiAlphaParenBoth':
			return suffixed(bijectiveLabel(n, THAI_CONSONANTS), 'parenBoth');
		default:
			return undefined;
	}
}
