import { describe, it, expect } from "vitest";
import { detectFileFormat, EncryptedFileError } from "./encryption-detection";

// ---------------------------------------------------------------------------
// detectFileFormat
// ---------------------------------------------------------------------------

describe("detectFileFormat", () => {
  it('returns { format: "unknown" } for data shorter than 8 bytes', () => {
    const data = new ArrayBuffer(4);
    const result = detectFileFormat(data);
    expect(result.format).toBe("unknown");
    expect(result.encrypted).toBe(false);
  });

  it('returns { format: "unknown" } for empty buffer', () => {
    const data = new ArrayBuffer(0);
    const result = detectFileFormat(data);
    expect(result.format).toBe("unknown");
    expect(result.encrypted).toBe(false);
  });

  it('detects ZIP format (normal PPTX)', () => {
    const data = new ArrayBuffer(8);
    const view = new Uint8Array(data);
    // ZIP magic: 50 4B (PK)
    view[0] = 0x50;
    view[1] = 0x4b;
    const result = detectFileFormat(data);
    expect(result.format).toBe("zip");
    expect(result.encrypted).toBe(false);
  });

  it('detects OLE format (encrypted PPTX)', () => {
    const data = new ArrayBuffer(8);
    const view = new Uint8Array(data);
    // OLE magic: D0 CF 11 E0 A1 1B 1A E1
    const oleMagic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0x1b, 0x1a, 0xe1];
    oleMagic.forEach((byte, i) => { view[i] = byte; });
    const result = detectFileFormat(data);
    expect(result.format).toBe("ole");
    expect(result.encrypted).toBe(true);
  });

  it('returns unknown for non-ZIP non-OLE data', () => {
    const data = new ArrayBuffer(8);
    const view = new Uint8Array(data);
    // Random bytes that don't match either magic
    view[0] = 0x89;
    view[1] = 0x50;
    view[2] = 0x4e;
    view[3] = 0x47; // PNG header
    const result = detectFileFormat(data);
    expect(result.format).toBe("unknown");
    expect(result.encrypted).toBe(false);
  });

  it('detects ZIP even with trailing garbage bytes', () => {
    const data = new ArrayBuffer(100);
    const view = new Uint8Array(data);
    view[0] = 0x50;
    view[1] = 0x4b;
    // Fill rest with garbage
    for (let i = 2; i < 100; i++) view[i] = 0xff;
    const result = detectFileFormat(data);
    expect(result.format).toBe("zip");
    expect(result.encrypted).toBe(false);
  });

  it('does not detect partial OLE magic as encrypted', () => {
    const data = new ArrayBuffer(8);
    const view = new Uint8Array(data);
    // Only first 4 bytes of OLE magic
    view[0] = 0xd0;
    view[1] = 0xcf;
    view[2] = 0x11;
    view[3] = 0xe0;
    // Remaining bytes differ
    view[4] = 0x00;
    view[5] = 0x00;
    view[6] = 0x00;
    view[7] = 0x00;
    const result = detectFileFormat(data);
    expect(result.format).toBe("unknown");
    expect(result.encrypted).toBe(false);
  });

  it('handles exactly 8-byte buffer with all zeros', () => {
    const data = new ArrayBuffer(8);
    const result = detectFileFormat(data);
    expect(result.format).toBe("unknown");
    expect(result.encrypted).toBe(false);
  });

  it('correctly identifies ZIP with version bytes', () => {
    const data = new ArrayBuffer(30);
    const view = new Uint8Array(data);
    // PK\x03\x04 = ZIP local file header
    view[0] = 0x50;
    view[1] = 0x4b;
    view[2] = 0x03;
    view[3] = 0x04;
    const result = detectFileFormat(data);
    expect(result.format).toBe("zip");
    expect(result.encrypted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EncryptedFileError
// ---------------------------------------------------------------------------

describe("EncryptedFileError", () => {
  it("has correct name", () => {
    const err = new EncryptedFileError("Test");
    expect(err.name).toBe("EncryptedFileError");
  });

  it("has correct message", () => {
    const err = new EncryptedFileError("File is encrypted");
    expect(err.message).toBe("File is encrypted");
  });

  it("has isEncrypted flag", () => {
    const err = new EncryptedFileError("Test");
    expect(err.isEncrypted).toBe(true);
  });

  it("is instanceof Error", () => {
    const err = new EncryptedFileError("Test");
    expect(err).toBeInstanceOf(Error);
  });

  it("is instanceof EncryptedFileError", () => {
    const err = new EncryptedFileError("Test");
    expect(err).toBeInstanceOf(EncryptedFileError);
  });
});
