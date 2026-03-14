/**
 * PANOSE-based font substitution for PPTX rendering.
 *
 * When a font referenced in a PPTX presentation is not available (neither
 * embedded nor installed on the user's system), this module provides
 * intelligent fallback selection based on:
 *
 * 1. **Direct substitution map** — maps common Office font names to
 *    web-safe alternatives with ordered preference.
 * 2. **PANOSE classification** — uses the 10-digit PANOSE classification
 *    system to determine the font's visual family (serif, sans-serif, etc.)
 *    and select an appropriate generic CSS family.
 * 3. **PANOSE weight mapping** — maps PANOSE weight digits to CSS
 *    font-weight-aware alternatives for better visual fidelity.
 *
 * PANOSE byte layout (ISO/IEC 14496-22, OpenType §5.2.8.1):
 * ```
 * [0] bFamilyType      — 0=Any, 2=Latin Text, 3=Latin Hand Written, 4=Latin Decorative, 5=Latin Symbol
 * [1] bSerifStyle       — serif classification (0–15)
 * [2] bWeight           — visual weight (0–11+)
 * [3] bProportion       — proportional vs monospace (0–9)
 * [4] bContrast         — stroke contrast
 * [5] bStrokeVariation  — stroke variation
 * [6] bArmStyle         — arm/terminal style
 * [7] bLetterform       — letterform
 * [8] bMidline          — midline position
 * [9] bXHeight          — x-height
 * ```
 *
 * @module font-substitution
 */

/* ------------------------------------------------------------------ */
/*  Direct font substitution map                                      */
/* ------------------------------------------------------------------ */

/**
 * Map of common PowerPoint / Office font names to web-safe alternatives.
 *
 * The alternatives are listed in preference order — the first available
 * font on the user's system will be used. Each chain ends with a
 * CSS generic family keyword as the ultimate fallback.
 */
export const FONT_SUBSTITUTION_MAP: Record<string, readonly string[]> = {
  // Microsoft Office default fonts
  Calibri: ["Carlito", "Liberation Sans", "Arial", "sans-serif"],
  "Calibri Light": [
    "Carlito",
    "Liberation Sans",
    "Arial",
    "sans-serif",
  ],
  Cambria: ["Caladea", "Liberation Serif", "Times New Roman", "serif"],
  "Cambria Math": [
    "STIX Two Math",
    "Latin Modern Math",
    "Times New Roman",
    "serif",
  ],
  Consolas: ["Liberation Mono", "Courier New", "monospace"],
  "Segoe UI": [
    "Liberation Sans",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
  "Segoe UI Light": [
    "Liberation Sans",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
  "Segoe UI Semibold": [
    "Liberation Sans",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],

  // Classic Windows fonts → cross-platform equivalents
  "Times New Roman": ["Liberation Serif", "Times", "serif"],
  Arial: ["Liberation Sans", "Helvetica", "sans-serif"],
  "Arial Black": ["Liberation Sans", "Helvetica", "sans-serif"],
  "Arial Narrow": ["Liberation Sans Narrow", "Helvetica Neue", "sans-serif"],
  "Courier New": ["Liberation Mono", "Courier", "monospace"],
  Verdana: ["DejaVu Sans", "Bitstream Vera Sans", "sans-serif"],
  Georgia: ["Liberation Serif", "Times New Roman", "serif"],
  Tahoma: ["DejaVu Sans", "Liberation Sans", "sans-serif"],
  Trebuchet: ["Liberation Sans", "sans-serif"],
  "Trebuchet MS": ["Liberation Sans", "sans-serif"],
  "Comic Sans MS": ["Comic Neue", "cursive"],
  Impact: ["Charcoal", "sans-serif"],
  "Lucida Console": ["Liberation Mono", "monospace"],
  "Lucida Sans Unicode": ["Lucida Grande", "Liberation Sans", "sans-serif"],
  Palatino: ["Palatino Linotype", "Book Antiqua", "serif"],
  "Palatino Linotype": ["Palatino", "Book Antiqua", "serif"],
  "Book Antiqua": ["Palatino Linotype", "Palatino", "serif"],

  // CJK fonts
  "MS PGothic": [
    "Noto Sans CJK JP",
    "Hiragino Sans",
    "Yu Gothic",
    "sans-serif",
  ],
  "MS PMincho": [
    "Noto Serif CJK JP",
    "Hiragino Mincho ProN",
    "Yu Mincho",
    "serif",
  ],
  "MS Gothic": [
    "Noto Sans CJK JP",
    "Hiragino Sans",
    "Yu Gothic",
    "sans-serif",
  ],
  "MS Mincho": [
    "Noto Serif CJK JP",
    "Hiragino Mincho ProN",
    "Yu Mincho",
    "serif",
  ],
  SimSun: ["Noto Serif CJK SC", "STSong", "serif"],
  SimHei: ["Noto Sans CJK SC", "STHeiti", "sans-serif"],
  "Microsoft YaHei": [
    "Noto Sans CJK SC",
    "PingFang SC",
    "sans-serif",
  ],
  NSimSun: ["Noto Serif CJK SC", "STSong", "serif"],
  FangSong: ["Noto Serif CJK SC", "STFangsong", "serif"],
  KaiTi: ["Noto Serif CJK SC", "STKaiti", "serif"],
  Batang: ["Noto Serif CJK KR", "AppleMyungjo", "serif"],
  Dotum: ["Noto Sans CJK KR", "AppleGothic", "sans-serif"],
  Gulim: ["Noto Sans CJK KR", "AppleGothic", "sans-serif"],
  Malgun: ["Noto Sans CJK KR", "Apple SD Gothic Neo", "sans-serif"],
  "Malgun Gothic": [
    "Noto Sans CJK KR",
    "Apple SD Gothic Neo",
    "sans-serif",
  ],

  // Complex script fonts
  "Arabic Typesetting": ["Noto Naskh Arabic", "serif"],
  "Simplified Arabic": ["Noto Sans Arabic", "sans-serif"],
  "Traditional Arabic": ["Noto Naskh Arabic", "serif"],
  Mangal: ["Noto Sans Devanagari", "sans-serif"],
  Vrinda: ["Noto Sans Bengali", "sans-serif"],
  Raavi: ["Noto Sans Gurmukhi", "sans-serif"],
  Shruti: ["Noto Sans Gujarati", "sans-serif"],
  Tunga: ["Noto Sans Kannada", "sans-serif"],
  Kartika: ["Noto Sans Malayalam", "sans-serif"],
  Iskoola: ["Noto Sans Sinhala", "sans-serif"],
  "Iskoola Pota": ["Noto Sans Sinhala", "sans-serif"],
  Leelawadee: ["Noto Sans Thai", "sans-serif"],
  "Leelawadee UI": ["Noto Sans Thai", "sans-serif"],
  "Cordia New": ["Noto Sans Thai", "sans-serif"],
  DokChampa: ["Noto Sans Lao", "sans-serif"],
  Nyala: ["Noto Sans Ethiopic", "sans-serif"],
  MoolBoran: ["Noto Sans Khmer", "sans-serif"],

  // Decorative / Display
  "Century Gothic": [
    "URW Gothic",
    "Futura",
    "sans-serif",
  ],
  "Franklin Gothic": [
    "Liberation Sans",
    "Helvetica Neue",
    "sans-serif",
  ],
  "Franklin Gothic Medium": [
    "Liberation Sans",
    "Helvetica Neue",
    "sans-serif",
  ],
  Garamond: ["EB Garamond", "Cormorant Garamond", "serif"],
  "Tw Cen MT": ["Century Gothic", "Futura", "sans-serif"],
  Rockwell: ["Roboto Slab", "Rockwell", "serif"],
  Candara: ["Liberation Sans", "Optima", "sans-serif"],
  Constantia: ["Liberation Serif", "Palatino", "serif"],
  Corbel: ["Liberation Sans", "Lucida Grande", "sans-serif"],
};

/* ------------------------------------------------------------------ */
/*  PANOSE classification maps                                        */
/* ------------------------------------------------------------------ */

/**
 * PANOSE byte 0 (bFamilyType) → CSS generic font family.
 *
 * The PANOSE family type classifies the overall visual group of a typeface.
 * Value 0 ("Any") and 1 ("No Fit") are treated as unknown / sans-serif.
 */
export const PANOSE_FAMILY_MAP: Record<number, string> = {
  0: "sans-serif", // Any — default to sans-serif
  1: "sans-serif", // No Fit — default to sans-serif
  2: "serif", // Latin Text (most serif fonts)
  3: "cursive", // Latin Hand Written
  4: "fantasy", // Latin Decorative
  5: "sans-serif", // Latin Symbol (approximation)
};

/**
 * PANOSE byte 1 (bSerifStyle) → whether the font is actually sans-serif.
 *
 * Within PANOSE family type 2 ("Latin Text"), the serif style byte
 * distinguishes serif from sans-serif faces. Values 11–13 indicate
 * sans-serif (Flared, Rounded, Normal Sans).
 *
 * This allows correct classification of sans-serif fonts like Arial
 * that have bFamilyType=2 but are clearly not serif fonts.
 */
export const PANOSE_SANS_SERIF_STYLES = new Set<number>([
  11, // Normal Sans
  12, // Obtuse Sans
  13, // Perpendicular Sans
  // Also note: some fonts use these values for sans-serif
  // 14+ are rarely used and vendor-specific
]);

/**
 * PANOSE byte 3 (bProportion) → monospace detection.
 *
 * A bProportion value of 9 indicates a monospaced font.
 */
export const PANOSE_MONOSPACE_PROPORTION = 9;

/**
 * PANOSE byte 2 (bWeight) → approximate CSS font-weight mapping.
 *
 * PANOSE weight values range from 1 (very light) to 11 (extra black).
 * This maps them to standard CSS font-weight values.
 */
export const PANOSE_WEIGHT_MAP: Record<number, number> = {
  1: 100, // Very Light
  2: 100, // Light
  3: 200, // Thin
  4: 300, // Book / Light
  5: 400, // Medium / Regular
  6: 500, // Demi / Medium
  7: 600, // Semi-Bold
  8: 700, // Bold
  9: 800, // Heavy / Extra-Bold
  10: 900, // Black
  11: 900, // Extra Black / Nord
};

/* ------------------------------------------------------------------ */
/*  PANOSE-aware fallback fonts                                       */
/* ------------------------------------------------------------------ */

/**
 * Maps CSS generic families to ordered lists of concrete web-safe fonts.
 * Used when PANOSE classification yields a generic family but we want
 * to try concrete fonts first for better rendering.
 */
const GENERIC_FAMILY_CONCRETE_FONTS: Record<string, readonly string[]> = {
  serif: ["Times New Roman", "Georgia", "serif"],
  "sans-serif": ["Arial", "Helvetica", "sans-serif"],
  monospace: ["Courier New", "Consolas", "monospace"],
  cursive: ["Comic Sans MS", "cursive"],
  fantasy: ["Impact", "fantasy"],
};

/* ------------------------------------------------------------------ */
/*  PANOSE parsing                                                    */
/* ------------------------------------------------------------------ */

/**
 * Parse a PANOSE string (hex-encoded, 20 characters / 10 bytes) into
 * an array of 10 numeric values.
 *
 * The PANOSE string appears in OOXML font elements, e.g.:
 * ```xml
 * <a:buFont typeface="Arial" panose="020B0604020202020204"/>
 * ```
 *
 * @param panoseStr The hex-encoded PANOSE string (20 hex characters).
 * @returns Array of 10 PANOSE byte values, or `undefined` if invalid.
 */
export function parsePanoseString(
  panoseStr: string | undefined | null,
): number[] | undefined {
  if (!panoseStr) return undefined;

  const cleaned = panoseStr.trim();
  if (cleaned.length !== 20) return undefined;

  // Validate that all characters are valid hex digits
  if (!/^[0-9a-fA-F]{20}$/.test(cleaned)) return undefined;

  const bytes: number[] = [];
  for (let i = 0; i < 20; i += 2) {
    bytes.push(parseInt(cleaned.substring(i, i + 2), 16));
  }
  return bytes;
}

/**
 * Parse a raw PANOSE byte array (10 bytes from a font binary or EOT header)
 * into a typed numeric array.
 *
 * @param data Raw byte array (must be exactly 10 bytes).
 * @returns Array of 10 PANOSE byte values, or `undefined` if invalid.
 */
export function parsePanoseBytes(
  data: Uint8Array | number[] | undefined | null,
): number[] | undefined {
  if (!data || data.length !== 10) return undefined;
  return Array.from(data);
}

/* ------------------------------------------------------------------ */
/*  Classification                                                    */
/* ------------------------------------------------------------------ */

/**
 * Classify a PANOSE value array into a CSS generic font family.
 *
 * The classification logic considers:
 * 1. bFamilyType (byte 0) — the primary family classification
 * 2. bSerifStyle (byte 1) — distinguishes serif from sans-serif within Latin Text
 * 3. bProportion (byte 3) — detects monospaced fonts
 *
 * @param panose Array of 10 PANOSE byte values.
 * @returns CSS generic font family string.
 */
export function classifyPanose(panose: number[]): string {
  if (!panose || panose.length < 4) return "sans-serif";

  const familyType = panose[0];
  const serifStyle = panose[1];
  const proportion = panose[3];

  // Monospace detection takes priority — any font that is monospaced
  // should use the monospace family regardless of other classification
  if (proportion === PANOSE_MONOSPACE_PROPORTION) {
    return "monospace";
  }

  // Look up the family type
  const family = PANOSE_FAMILY_MAP[familyType];

  // For Latin Text (family type 2), further check serif style
  if (familyType === 2) {
    if (PANOSE_SANS_SERIF_STYLES.has(serifStyle)) {
      return "sans-serif";
    }
    return "serif";
  }

  return family ?? "sans-serif";
}

/**
 * Get the approximate CSS font-weight from a PANOSE classification.
 *
 * @param panose Array of 10 PANOSE byte values.
 * @returns CSS font-weight number (100–900) or `undefined` if not determinable.
 */
export function getPanoseWeight(
  panose: number[] | undefined,
): number | undefined {
  if (!panose || panose.length < 3) return undefined;
  const weight = panose[2];
  return PANOSE_WEIGHT_MAP[weight];
}

/* ------------------------------------------------------------------ */
/*  Main substitution function                                        */
/* ------------------------------------------------------------------ */

/**
 * Build a CSS `font-family` fallback string for a given font name.
 *
 * The resolution strategy (in order of priority):
 *
 * 1. **Direct substitution** — if the font name is in the known
 *    substitution map, use the predefined fallback chain.
 * 2. **PANOSE classification** — if PANOSE data is available, classify
 *    the font and build a fallback chain using the generic family.
 * 3. **Default fallback** — returns the font name quoted with a
 *    `sans-serif` generic fallback.
 *
 * The returned string is ready for use in CSS `font-family` declarations.
 *
 * @param fontName The font family name as referenced in the PPTX.
 * @param panose Optional PANOSE classification array (10 bytes).
 * @returns A CSS font-family value string with fallbacks.
 *
 * @example
 * ```ts
 * getSubstituteFontFamily("Calibri");
 * // => '"Calibri", "Carlito", "Liberation Sans", "Arial", sans-serif'
 *
 * getSubstituteFontFamily("Unknown Font", [2, 11, 5, 2, 2, 2, 2, 2, 2, 4]);
 * // => '"Unknown Font", "Arial", "Helvetica", sans-serif'
 *
 * getSubstituteFontFamily("Another Font");
 * // => '"Another Font", sans-serif'
 * ```
 */
export function getSubstituteFontFamily(
  fontName: string,
  panose?: number[],
): string {
  const trimmed = fontName.trim();
  if (!trimmed) return "sans-serif";

  // Strategy 1: Direct substitution map
  const directSubs = FONT_SUBSTITUTION_MAP[trimmed];
  if (directSubs) {
    return buildFontFamilyString(trimmed, directSubs);
  }

  // Strategy 2: PANOSE-based classification
  if (panose && panose.length >= 4) {
    const genericFamily = classifyPanose(panose);
    const concreteFonts = GENERIC_FAMILY_CONCRETE_FONTS[genericFamily];
    if (concreteFonts) {
      return buildFontFamilyString(trimmed, concreteFonts);
    }
  }

  // Strategy 3: Default fallback
  return buildFontFamilyString(trimmed, ["sans-serif"]);
}

/**
 * Get only the fallback fonts for a given font name (without the
 * original font name itself). Useful when building font-family chains
 * where the primary font is already included.
 *
 * @param fontName The font family name as referenced in the PPTX.
 * @param panose Optional PANOSE classification array (10 bytes).
 * @returns Array of fallback font names (may include generic CSS families).
 */
export function getSubstituteFonts(
  fontName: string,
  panose?: number[],
): readonly string[] {
  const trimmed = fontName.trim();
  if (!trimmed) return ["sans-serif"];

  // Strategy 1: Direct substitution map
  const directSubs = FONT_SUBSTITUTION_MAP[trimmed];
  if (directSubs) return directSubs;

  // Strategy 2: PANOSE-based classification
  if (panose && panose.length >= 4) {
    const genericFamily = classifyPanose(panose);
    const concreteFonts = GENERIC_FAMILY_CONCRETE_FONTS[genericFamily];
    if (concreteFonts) return concreteFonts;
  }

  // Strategy 3: Default fallback
  return ["sans-serif"];
}

/**
 * Check whether a font name has a known direct substitution.
 *
 * @param fontName The font family name.
 * @returns `true` if the font is in the direct substitution map.
 */
export function hasDirectSubstitution(fontName: string): boolean {
  return fontName.trim() in FONT_SUBSTITUTION_MAP;
}

/* ------------------------------------------------------------------ */
/*  CSS string builder                                                */
/* ------------------------------------------------------------------ */

/** CSS generic font family keywords that should NOT be quoted. */
const CSS_GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "math",
  "emoji",
  "fangsong",
]);

/**
 * Build a CSS `font-family` value string from a primary font name
 * and an ordered list of fallback fonts.
 *
 * Generic CSS family keywords (serif, sans-serif, etc.) are not quoted.
 * All other font names are wrapped in double quotes.
 *
 * @param primary The primary font family name.
 * @param fallbacks Ordered array of fallback font names / generic families.
 * @returns A properly formatted CSS font-family string.
 */
export function buildFontFamilyString(
  primary: string,
  fallbacks: readonly string[],
): string {
  const parts: string[] = [quoteFontName(primary)];
  for (const fb of fallbacks) {
    const quoted = quoteFontName(fb);
    // Avoid duplicates in the chain
    if (!parts.includes(quoted)) {
      parts.push(quoted);
    }
  }
  return parts.join(", ");
}

/**
 * Quote a font family name for CSS use, unless it is a generic
 * CSS family keyword.
 */
function quoteFontName(name: string): string {
  const trimmed = name.trim();
  if (CSS_GENERIC_FAMILIES.has(trimmed.toLowerCase())) {
    return trimmed;
  }
  return `"${trimmed}"`;
}
