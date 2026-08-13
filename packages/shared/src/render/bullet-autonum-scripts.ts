/**
 * Script-specific numeral converters for OOXML `ST_TextAutonumberScheme`
 * auto-numbered bullets: the East-Asian (`ea1*`), Hebrew, Arabic, Hindi
 * (Devanagari) and Thai numbering families.
 *
 * The implementation lives in `pptx-viewer-core`
 * (`core/utils/auto-number-scripts`) so the load path and the render layer
 * format a marker identically; see {@link ./bullet-autonum} for why. This
 * module stays as the render-layer entry point (and keeps the shape its tests
 * and callers expect).
 */

export {
	formatScriptAutoNumber,
	bijectiveLabel,
	toChineseNumeral,
	toHebrewNumeral,
	toArabicAbjadNumeral,
	toDevanagariDigits,
	toThaiDigits,
	toFullWidthDigits,
	HINDI_VOWELS,
	HINDI_CONSONANTS,
	THAI_CONSONANTS,
	ARABIC_HIJAI_LETTERS,
} from 'pptx-viewer-core';
