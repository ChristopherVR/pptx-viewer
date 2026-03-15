/**
 * OOXML Embedded Font Obfuscation / De-obfuscation
 *
 * Implements the font obfuscation algorithm from ISO/IEC 29500-2 §14.2.1.
 * Embedded fonts in OOXML packages are XOR-obfuscated using a GUID key derived
 * from the font part's file name.
 *
 * Because the algorithm is XOR-based, obfuscation and de-obfuscation are the
 * same operation (XOR is self-inverse). Both {@link obfuscateFont} and
 * {@link deobfuscateFont} are provided for clarity of intent.
 */

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

/** Number of bytes at the start of the font file that are XOR-obfuscated. */
const OBFUSCATED_BYTE_COUNT = 32;

/** Length of the XOR key in bytes (a GUID = 16 bytes). */
const KEY_LENGTH = 16;

/* ------------------------------------------------------------------ */
/*  GUID Extraction                                                   */
/* ------------------------------------------------------------------ */

/**
 * Regex to match a GUID in a font part name.
 * Matches both brace-wrapped `{GUID}` and bare `GUID` forms.
 *
 * Examples:
 *   - `ppt/fonts/{F7A0C94A-3F90-4c3a-AE50-B05A7B0F6C65}.fntdata`
 *   - `ppt/fonts/F7A0C94A-3F90-4c3a-AE50-B05A7B0F6C65.fntdata`
 */
const GUID_REGEX =
  /\{?([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\}?/i;

/**
 * Extract a GUID string from a font part path.
 * Returns the GUID (without braces) or `null` if none found.
 */
export function extractGuidFromPartName(partName: string): string | null {
  const match = GUID_REGEX.exec(partName);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}-${match[4]}-${match[5]}`;
}

/* ------------------------------------------------------------------ */
/*  GUID to Key Conversion                                            */
/* ------------------------------------------------------------------ */

/**
 * Convert a GUID string to a 16-byte XOR key.
 *
 * Per ECMA-376 Part 2 §14.2.1, the key is formed by:
 *   1. Removing '{', '}', and '-' from the GUID string.
 *   2. Converting consecutive pairs of hex characters to bytes.
 *
 * No byte-order reversal is performed — the hex pairs are converted
 * sequentially to produce 16 key bytes.
 */
export function guidToKey(guid: string): Uint8Array {
  const stripped = guid.replace(/[-{}]/g, "");
  if (stripped.length !== 32) {
    throw new Error(
      `Invalid GUID length: expected 32 hex chars, got ${stripped.length}`,
    );
  }

  const key = new Uint8Array(KEY_LENGTH);
  for (let i = 0; i < KEY_LENGTH; i++) {
    key[i] = parseInt(stripped.substring(i * 2, i * 2 + 2), 16);
  }

  return key;
}

/* ------------------------------------------------------------------ */
/*  De-obfuscation                                                    */
/* ------------------------------------------------------------------ */

/**
 * De-obfuscate an OOXML embedded font binary.
 *
 * The first 32 bytes of the font data are XOR'd with the 16-byte GUID key
 * repeated twice. The rest of the data is left unchanged.
 *
 * @param fontData - The obfuscated font binary (`.fntdata` file contents).
 * @param guid - The GUID extracted from the font part name.
 * @returns A new `Uint8Array` containing the de-obfuscated font data (TTF/OTF).
 */
export function deobfuscateFont(
  fontData: Uint8Array,
  guid: string,
): Uint8Array {
  if (fontData.length < OBFUSCATED_BYTE_COUNT) {
    // Font data too short to be obfuscated; return a copy as-is
    return new Uint8Array(fontData);
  }

  const key = guidToKey(guid);
  const result = new Uint8Array(fontData);

  // XOR first 32 bytes with key repeated twice
  for (let i = 0; i < OBFUSCATED_BYTE_COUNT; i++) {
    result[i] = fontData[i] ^ key[i % KEY_LENGTH];
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Obfuscation (re-embedding)                                        */
/* ------------------------------------------------------------------ */

/**
 * Obfuscate a font binary for embedding in an OOXML package.
 *
 * The algorithm is identical to {@link deobfuscateFont} because XOR is
 * self-inverse: `obfuscate(deobfuscate(data, guid), guid) === data`.
 *
 * @param fontData - The clear-text font binary (TTF/OTF).
 * @param guid - The GUID that will be used as the font part file name.
 * @returns A new `Uint8Array` containing the obfuscated font data.
 */
export function obfuscateFont(
  fontData: Uint8Array,
  guid: string,
): Uint8Array {
  // XOR is self-inverse, so obfuscation === de-obfuscation
  return deobfuscateFont(fontData, guid);
}

/* ------------------------------------------------------------------ */
/*  GUID Generation                                                   */
/* ------------------------------------------------------------------ */

/**
 * Generate a random GUID string suitable for use as a font part name.
 *
 * The format follows the standard 8-4-4-4-12 hex GUID pattern:
 * `XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`
 *
 * Uses `crypto.getRandomValues` when available, otherwise falls back
 * to `Math.random`.
 */
export function generateFontGuid(): string {
  const bytes = new Uint8Array(16);

  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.getRandomValues === "function"
  ) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join("");

  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32),
  ].join("-");
}

/* ------------------------------------------------------------------ */
/*  Font Format Detection                                             */
/* ------------------------------------------------------------------ */

/** Detect font format from magic bytes for the CSS `format()` hint. */
export function detectFontFormat(
  data: Uint8Array,
): "truetype" | "opentype" | "woff" | "woff2" {
  if (data.length < 4) return "truetype";

  // WOFF2: 'wOF2'
  if (
    data[0] === 0x77 &&
    data[1] === 0x4f &&
    data[2] === 0x46 &&
    data[3] === 0x32
  ) {
    return "woff2";
  }
  // WOFF: 'wOFF'
  if (
    data[0] === 0x77 &&
    data[1] === 0x4f &&
    data[2] === 0x46 &&
    data[3] === 0x46
  ) {
    return "woff";
  }
  // OpenType with CFF: 'OTTO'
  if (
    data[0] === 0x4f &&
    data[1] === 0x54 &&
    data[2] === 0x54 &&
    data[3] === 0x4f
  ) {
    return "opentype";
  }
  // TrueType: version 1.0 (0x00010000) or 'true'
  return "truetype";
}
