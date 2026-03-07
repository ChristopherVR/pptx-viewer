/**
 * EOT (Embedded OpenType) Container Parser
 *
 * Parses EOT containers that may appear in PPTX embedded font parts
 * (.fntdata / .odttf files). EOT is a wrapper format around font data
 * defined by the W3C: https://www.w3.org/Submission/EOT/
 *
 * Some PPTX producers (e.g. Google Slides) embed fonts in EOT format
 * rather than using the simple OOXML XOR obfuscation.
 */

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

/** Offset of the EOT magic number (0x504C = "LP") in the header. */
const EOT_MAGIC_OFFSET = 34;

/** Expected magic value at the magic offset (little-endian uint16). */
const EOT_MAGIC = 0x504c;

/** Flag: font data is MicroType Express (MTX / BSGP) compressed. */
const TTEMBED_TTCOMPRESSED = 0x0001;

/** Flag: font data is XOR-encrypted using the embedding page URL. */
const TTEMBED_XORENCRYPTDATA = 0x0004;

/** MicroType Express / BSGP signature bytes. */
const BSGP_SIGNATURE = [0x42, 0x53, 0x47, 0x50]; // 'BSGP'

/* ------------------------------------------------------------------ */
/*  Binary read helpers                                               */
/* ------------------------------------------------------------------ */

function readUint32LE(data: Uint8Array, offset: number): number {
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    ((data[offset + 3] << 24) >>> 0)
  );
}

function readUint16LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

function readUtf16LE(
  data: Uint8Array,
  offset: number,
  byteLength: number,
): string {
  const chars: string[] = [];
  for (let i = 0; i < byteLength; i += 2) {
    if (offset + i + 1 >= data.length) break;
    const code = data[offset + i] | (data[offset + i + 1] << 8);
    if (code === 0) break;
    chars.push(String.fromCharCode(code));
  }
  return chars.join("");
}

/* ------------------------------------------------------------------ */
/*  EOT header structure                                              */
/* ------------------------------------------------------------------ */

export interface EotHeader {
  /** Total size of the EOT container in bytes. */
  eotSize: number;
  /** Size of the embedded font data in bytes. */
  fontDataSize: number;
  /** EOT format version (typically 0x00020001 or 0x00020002). */
  version: number;
  /** Embedding flags. */
  flags: number;
  /** Whether the font data is MTX/BSGP compressed. */
  isCompressed: boolean;
  /** Whether the font data is XOR-encrypted (URL-based key). */
  isXorEncrypted: boolean;
  /** Font family name from the EOT header. */
  familyName: string;
  /** Font style name from the EOT header. */
  styleName: string;
  /** Font version string from the EOT header. */
  versionName: string;
  /** Full font name from the EOT header. */
  fullName: string;
  /** Byte offset where the font data begins within the container. */
  fontDataOffset: number;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Check whether a binary buffer is an EOT container.
 * Verifies the magic number 0x504C at the documented offset.
 */
export function isEotFormat(data: Uint8Array): boolean {
  if (data.length < 36) return false;
  const magic = readUint16LE(data, EOT_MAGIC_OFFSET);
  return magic === EOT_MAGIC;
}

/**
 * Parse the EOT container header and return its metadata.
 * Returns `null` if the data is not a valid EOT container.
 *
 * EOT header layout (W3C Submission):
 * ```
 * Offset  Size   Field
 * 0       4      EOTSize
 * 4       4      FontDataSize
 * 8       4      Version
 * 12      4      Flags
 * 16      10     PANOSE
 * 26      1      Charset
 * 27      1      Italic
 * 28      4      Weight
 * 32      2      fsType
 * 34      2      MagicNumber (0x504C)
 * 36      16     UnicodeRange (4 × uint32)
 * 52      8      CodePageRange (2 × uint32)
 * 60      4      CheckSumAdjustment
 * 64      16     Reserved (4 × uint32)
 * 80      ...    Variable-length name strings + font data
 * ```
 */
export function parseEotHeader(data: Uint8Array): EotHeader | null {
  if (!isEotFormat(data)) return null;
  if (data.length < 82) return null;

  const eotSize = readUint32LE(data, 0);
  const fontDataSize = readUint32LE(data, 4);
  const version = readUint32LE(data, 8);
  const flags = readUint32LE(data, 12);

  // --- Variable-length name strings start at offset 80 ---
  let offset = 80;

  // Helper: read a padded name string (2-byte padding + 2-byte size + data)
  const readNameString = (): string => {
    if (offset + 4 > data.length) return "";
    /* const padding = */ readUint16LE(data, offset);
    offset += 2;
    const size = readUint16LE(data, offset);
    offset += 2;
    if (size === 0 || offset + size > data.length) {
      offset += size;
      return "";
    }
    const str = readUtf16LE(data, offset, size);
    offset += size;
    return str;
  };

  const familyName = readNameString();
  const styleName = readNameString();
  const versionName = readNameString();
  const fullName = readNameString();

  // Version 0x00020002+ has an additional RootString
  if (version >= 0x00020002) {
    readNameString(); // RootString — not used
  }

  return {
    eotSize,
    fontDataSize,
    version,
    flags,
    isCompressed: (flags & TTEMBED_TTCOMPRESSED) !== 0,
    isXorEncrypted: (flags & TTEMBED_XORENCRYPTDATA) !== 0,
    familyName,
    styleName,
    versionName,
    fullName,
    fontDataOffset: offset,
  };
}

/**
 * Extract the raw font binary (TrueType / OpenType) from an EOT container.
 *
 * - If the embedded font data is **uncompressed**, returns the raw TTF/OTF.
 * - If the font data is **MTX/BSGP compressed**, returns `null` — the
 *   MicroType Express decompression algorithm is not implemented.
 *
 * @returns An object with the extracted `fontData` and parsed `familyName`,
 *          or `null` if extraction is not possible.
 */
export function extractFontFromEot(
  data: Uint8Array,
): { fontData: Uint8Array; header: EotHeader } | null {
  const header = parseEotHeader(data);
  if (!header) return null;

  const { fontDataOffset, fontDataSize } = header;

  // Bounds check
  if (fontDataOffset + fontDataSize > data.length) {
    return null;
  }

  const fontData = data.slice(fontDataOffset, fontDataOffset + fontDataSize);

  // Check for BSGP (MicroType Express) compression signature
  if (
    fontData.length >= 4 &&
    fontData[0] === BSGP_SIGNATURE[0] &&
    fontData[1] === BSGP_SIGNATURE[1] &&
    fontData[2] === BSGP_SIGNATURE[2] &&
    fontData[3] === BSGP_SIGNATURE[3]
  ) {
    // MTX-compressed — cannot currently decompress
    return null;
  }

  return { fontData, header };
}
