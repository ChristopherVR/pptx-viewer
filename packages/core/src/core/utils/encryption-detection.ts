/**
 * Detect whether an ArrayBuffer contains an OLE Compound Binary File
 * (which indicates an encrypted OOXML package) rather than a normal ZIP.
 *
 * Encrypted OOXML files are wrapped in OLE structured storage format.
 * The OLE magic bytes are: D0 CF 11 E0 A1 1B 1A E1
 * Normal PPTX files start with ZIP magic: 50 4B (PK)
 */

/** OLE Compound Binary File magic signature. */
const OLE_MAGIC = new Uint8Array([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0x1b, 0x1a, 0xe1,
]);

/** ZIP file magic signature (first 2 bytes). */
const ZIP_MAGIC = new Uint8Array([0x50, 0x4b]);

export type FileFormatDetection =
  | { format: "zip"; encrypted: false }
  | { format: "ole"; encrypted: true }
  | { format: "unknown"; encrypted: false };

/**
 * Detect the file format and whether it's encrypted.
 * Must be called BEFORE attempting to parse as ZIP.
 */
export function detectFileFormat(data: ArrayBuffer): FileFormatDetection {
  if (data.byteLength < 8) {
    return { format: "unknown", encrypted: false };
  }

  const header = new Uint8Array(data, 0, 8);

  // Check OLE magic (encrypted OOXML)
  if (OLE_MAGIC.every((byte, i) => header[i] === byte)) {
    return { format: "ole", encrypted: true };
  }

  // Check ZIP magic (normal OOXML)
  if (header[0] === ZIP_MAGIC[0] && header[1] === ZIP_MAGIC[1]) {
    return { format: "zip", encrypted: false };
  }

  return { format: "unknown", encrypted: false };
}

/**
 * Custom error thrown when an encrypted PPTX file is detected.
 * Callers can check `instanceof EncryptedFileError` to distinguish
 * this from generic parse failures.
 */
export class EncryptedFileError extends Error {
  public readonly isEncrypted = true;

  public constructor(message: string) {
    super(message);
    this.name = "EncryptedFileError";
  }
}
