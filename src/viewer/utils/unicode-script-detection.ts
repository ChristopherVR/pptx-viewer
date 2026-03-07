/**
 * Unicode script detection for font fallback.
 *
 * Determines which OOXML font group (latin, eastAsia, complexScript, symbol)
 * should be used for each character based on its Unicode code point.
 */

/** OOXML font script category. */
export type FontScriptCategory =
  | "latin"
  | "eastAsia"
  | "complexScript"
  | "symbol";

/**
 * Detect the OOXML font script category for a single character.
 *
 * Uses Unicode block ranges to determine if a character belongs to:
 * - Latin (Basic Latin, Latin Extended, Greek, Cyrillic, etc.)
 * - East Asian (CJK Unified Ideographs, Hiragana, Katakana, Hangul, etc.)
 * - Complex Script (Arabic, Hebrew, Devanagari, Thai, etc.)
 * - Symbol (Dingbats, Mathematical, etc.)
 */
export function detectFontScript(codePoint: number): FontScriptCategory {
  // East Asian ranges
  if (
    (codePoint >= 0x2e80 && codePoint <= 0x9fff) || // CJK radicals, unified ideographs
    (codePoint >= 0xac00 && codePoint <= 0xd7af) || // Hangul syllables
    (codePoint >= 0xf900 && codePoint <= 0xfaff) || // CJK compatibility ideographs
    (codePoint >= 0xfe30 && codePoint <= 0xfe4f) || // CJK compatibility forms
    (codePoint >= 0x20000 && codePoint <= 0x2fa1f) || // CJK extension B-F
    (codePoint >= 0x3000 && codePoint <= 0x303f) || // CJK symbols & punctuation
    (codePoint >= 0x3040 && codePoint <= 0x309f) || // Hiragana
    (codePoint >= 0x30a0 && codePoint <= 0x30ff) || // Katakana
    (codePoint >= 0x31f0 && codePoint <= 0x31ff) || // Katakana extensions
    (codePoint >= 0xff00 && codePoint <= 0xffef) // Halfwidth/fullwidth forms
  ) {
    return "eastAsia";
  }

  // Complex Script ranges (RTL and Indic)
  if (
    (codePoint >= 0x0590 && codePoint <= 0x05ff) || // Hebrew
    (codePoint >= 0x0600 && codePoint <= 0x06ff) || // Arabic
    (codePoint >= 0x0700 && codePoint <= 0x074f) || // Syriac
    (codePoint >= 0x0750 && codePoint <= 0x077f) || // Arabic Supplement
    (codePoint >= 0x0780 && codePoint <= 0x07bf) || // Thaana
    (codePoint >= 0x07c0 && codePoint <= 0x07ff) || // NKo
    (codePoint >= 0x0800 && codePoint <= 0x083f) || // Samaritan
    (codePoint >= 0x0900 && codePoint <= 0x097f) || // Devanagari
    (codePoint >= 0x0980 && codePoint <= 0x09ff) || // Bengali
    (codePoint >= 0x0a00 && codePoint <= 0x0a7f) || // Gurmukhi
    (codePoint >= 0x0a80 && codePoint <= 0x0aff) || // Gujarati
    (codePoint >= 0x0b00 && codePoint <= 0x0b7f) || // Oriya
    (codePoint >= 0x0b80 && codePoint <= 0x0bff) || // Tamil
    (codePoint >= 0x0c00 && codePoint <= 0x0c7f) || // Telugu
    (codePoint >= 0x0c80 && codePoint <= 0x0cff) || // Kannada
    (codePoint >= 0x0d00 && codePoint <= 0x0d7f) || // Malayalam
    (codePoint >= 0x0d80 && codePoint <= 0x0dff) || // Sinhala
    (codePoint >= 0x0e00 && codePoint <= 0x0e7f) || // Thai
    (codePoint >= 0x0e80 && codePoint <= 0x0eff) || // Lao
    (codePoint >= 0x0f00 && codePoint <= 0x0fff) || // Tibetan
    (codePoint >= 0x1000 && codePoint <= 0x109f) || // Myanmar
    (codePoint >= 0x10a0 && codePoint <= 0x10ff) || // Georgian
    (codePoint >= 0x1780 && codePoint <= 0x17ff) || // Khmer
    (codePoint >= 0xfb50 && codePoint <= 0xfdff) || // Arabic Presentation Forms-A
    (codePoint >= 0xfe70 && codePoint <= 0xfeff) // Arabic Presentation Forms-B
  ) {
    return "complexScript";
  }

  // Symbol ranges
  if (
    (codePoint >= 0x2190 && codePoint <= 0x21ff) || // Arrows
    (codePoint >= 0x2200 && codePoint <= 0x22ff) || // Mathematical operators
    (codePoint >= 0x2300 && codePoint <= 0x23ff) || // Misc technical
    (codePoint >= 0x2500 && codePoint <= 0x257f) || // Box drawing
    (codePoint >= 0x2580 && codePoint <= 0x259f) || // Block elements
    (codePoint >= 0x25a0 && codePoint <= 0x25ff) || // Geometric shapes
    (codePoint >= 0x2600 && codePoint <= 0x26ff) || // Misc symbols
    (codePoint >= 0x2700 && codePoint <= 0x27bf) || // Dingbats
    (codePoint >= 0xe000 && codePoint <= 0xf8ff) || // Private Use Area
    (codePoint >= 0x1f000 && codePoint <= 0x1f9ff) // Emoji/symbols
  ) {
    return "symbol";
  }

  // Default: Latin (includes Basic Latin, Latin Extended, Greek, Cyrillic)
  return "latin";
}

/** A contiguous run of characters sharing the same font script category. */
export interface ScriptRun {
  text: string;
  script: FontScriptCategory;
  startIndex: number;
}

/**
 * Segment a string into runs of the same font script category.
 * Adjacent characters with the same script are grouped together.
 * Whitespace and ASCII punctuation inherit the previous run's script.
 */
export function segmentByScript(text: string): ScriptRun[] {
  if (!text) return [];

  const runs: ScriptRun[] = [];
  let currentScript: FontScriptCategory | null = null;
  let currentStart = 0;
  let currentText = "";

  for (let i = 0; i < text.length; i++) {
    const codePoint = text.codePointAt(i);
    if (codePoint === undefined) continue;

    // Skip surrogate pair second code unit
    const charLength = codePoint > 0xffff ? 2 : 1;
    const char = text.substring(i, i + charLength);

    // Whitespace/punctuation in ASCII range inherits previous script
    const isNeutral = codePoint <= 0x7f && !/[a-zA-Z0-9]/.test(char);
    const script: FontScriptCategory = isNeutral
      ? (currentScript ?? "latin")
      : detectFontScript(codePoint);

    if (script !== currentScript && currentScript !== null) {
      runs.push({
        text: currentText,
        script: currentScript,
        startIndex: currentStart,
      });
      currentStart = i;
      currentText = "";
    }

    currentScript = script;
    currentText += char;

    if (charLength === 2) i++; // skip surrogate pair
  }

  if (currentText && currentScript) {
    runs.push({
      text: currentText,
      script: currentScript,
      startIndex: currentStart,
    });
  }

  return runs;
}

/**
 * Resolve the font family for a given script category from available fonts.
 * Falls back to latin when a script-specific font is not available.
 */
export function resolveFontForScript(
  script: FontScriptCategory,
  fonts: {
    latin?: string;
    eastAsia?: string;
    complexScript?: string;
    symbol?: string;
  },
): string | undefined {
  switch (script) {
    case "latin":
      return fonts.latin;
    case "eastAsia":
      return fonts.eastAsia || fonts.latin;
    case "complexScript":
      return fonts.complexScript || fonts.latin;
    case "symbol":
      return fonts.symbol || fonts.latin;
  }
}

/**
 * Check whether per-script fonts are actually different from the base latin font.
 * Returns `true` when at least one script-specific font differs.
 */
export function hasDistinctScriptFonts(fonts: {
  latin?: string;
  eastAsia?: string;
  complexScript?: string;
  symbol?: string;
}): boolean {
  const base = fonts.latin;
  if (!base) return false;
  return (
    (!!fonts.eastAsia && fonts.eastAsia !== base) ||
    (!!fonts.complexScript && fonts.complexScript !== base) ||
    (!!fonts.symbol && fonts.symbol !== base)
  );
}
