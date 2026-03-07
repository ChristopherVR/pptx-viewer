/**
 * OOXML Embedded Font De-obfuscation
 *
 * Implements the font de-obfuscation algorithm from ISO/IEC 29500-2 §14.2.1.
 * Embedded fonts in OOXML packages are XOR-obfuscated using a GUID key derived
 * from the font part's file name.
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
 * Per the OOXML spec, the GUID is converted to its binary representation
 * using standard little-endian GUID byte ordering:
 *   - Group 1 (4 bytes): reversed
 *   - Group 2 (2 bytes): reversed
 *   - Group 3 (2 bytes): reversed
 *   - Group 4 (2 bytes): not reversed (big-endian)
 *   - Group 5 (6 bytes): not reversed (big-endian)
 */
export function guidToKey(guid: string): Uint8Array {
  const stripped = guid.replace(/[-{}]/g, "");
  if (stripped.length !== 32) {
    throw new Error(
      `Invalid GUID length: expected 32 hex chars, got ${stripped.length}`,
    );
  }

  const hexBytes = (hex: string): number[] => {
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substring(i, i + 2), 16));
    }
    return bytes;
  };

  // Split GUID into standard groups: 8-4-4-4-12 hex chars
  const g1 = stripped.substring(0, 8);
  const g2 = stripped.substring(8, 12);
  const g3 = stripped.substring(12, 16);
  const g4 = stripped.substring(16, 20);
  const g5 = stripped.substring(20, 32);

  const key = new Uint8Array(KEY_LENGTH);
  let offset = 0;

  // Group 1: 4 bytes, little-endian (reversed)
  const b1 = hexBytes(g1);
  key[offset++] = b1[3];
  key[offset++] = b1[2];
  key[offset++] = b1[1];
  key[offset++] = b1[0];

  // Group 2: 2 bytes, little-endian (reversed)
  const b2 = hexBytes(g2);
  key[offset++] = b2[1];
  key[offset++] = b2[0];

  // Group 3: 2 bytes, little-endian (reversed)
  const b3 = hexBytes(g3);
  key[offset++] = b3[1];
  key[offset++] = b3[0];

  // Group 4: 2 bytes, big-endian (not reversed)
  const b4 = hexBytes(g4);
  key[offset++] = b4[0];
  key[offset++] = b4[1];

  // Group 5: 6 bytes, big-endian (not reversed)
  const b5 = hexBytes(g5);
  for (const byte of b5) {
    key[offset++] = byte;
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
