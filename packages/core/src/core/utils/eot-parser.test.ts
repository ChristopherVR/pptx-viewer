import { describe, it, expect, vi } from "vitest";
import { isEotFormat, parseEotHeader, extractFontFromEot } from "./eot-parser";
import type { EotHeader } from "./eot-parser";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal valid EOT buffer with the magic number at offset 34.
 * The header is populated with the given overrides.
 */
function buildEotBuffer(opts: {
  eotSize?: number;
  fontDataSize?: number;
  version?: number;
  flags?: number;
  familyName?: string;
  totalLength?: number;
} = {}): Uint8Array {
  const familyName = opts.familyName ?? "Arial";
  // Encode family name as UTF-16LE
  const familyBytes = new Uint8Array(familyName.length * 2);
  for (let i = 0; i < familyName.length; i++) {
    familyBytes[i * 2] = familyName.charCodeAt(i) & 0xff;
    familyBytes[i * 2 + 1] = (familyName.charCodeAt(i) >> 8) & 0xff;
  }

  // We need at least 80 bytes for the fixed header + variable name strings
  // Each name string has: 2 bytes padding + 2 bytes size + data bytes
  const nameBlockSize = (2 + 2 + familyBytes.length) + (2 + 2) * 3; // family + 3 empty strings
  const fontDataSize = opts.fontDataSize ?? 16;
  const headerSize = 80 + nameBlockSize;
  const totalSize = opts.totalLength ?? (headerSize + fontDataSize);
  const eotSize = opts.eotSize ?? totalSize;

  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);

  // EOTSize at offset 0
  view.setUint32(0, eotSize, true);
  // FontDataSize at offset 4
  view.setUint32(4, fontDataSize, true);
  // Version at offset 8
  view.setUint32(8, opts.version ?? 0x00020001, true);
  // Flags at offset 12
  view.setUint32(12, opts.flags ?? 0, true);
  // Magic at offset 34
  view.setUint16(34, 0x504c, true);

  // Name strings start at offset 80
  let off = 80;

  // Family name: padding(2) + size(2) + data
  view.setUint16(off, 0, true); off += 2;
  view.setUint16(off, familyBytes.length, true); off += 2;
  buf.set(familyBytes, off); off += familyBytes.length;

  // Style name: empty
  view.setUint16(off, 0, true); off += 2;
  view.setUint16(off, 0, true); off += 2;

  // Version name: empty
  view.setUint16(off, 0, true); off += 2;
  view.setUint16(off, 0, true); off += 2;

  // Full name: empty
  view.setUint16(off, 0, true); off += 2;
  view.setUint16(off, 0, true); off += 2;

  // Fill font data area with some bytes
  for (let i = 0; i < fontDataSize && off + i < totalSize; i++) {
    buf[off + i] = 0xaa;
  }

  return buf;
}

// ---------------------------------------------------------------------------
// isEotFormat
// ---------------------------------------------------------------------------

describe("isEotFormat", () => {
  it("returns true for valid EOT data with magic at offset 34", () => {
    const data = buildEotBuffer();
    expect(isEotFormat(data)).toBe(true);
  });

  it("returns false for buffer shorter than 36 bytes", () => {
    const data = new Uint8Array(35);
    expect(isEotFormat(data)).toBe(false);
  });

  it("returns false when magic does not match", () => {
    const data = buildEotBuffer();
    // Corrupt the magic
    data[34] = 0;
    data[35] = 0;
    expect(isEotFormat(data)).toBe(false);
  });

  it("returns false for an empty buffer", () => {
    expect(isEotFormat(new Uint8Array(0))).toBe(false);
  });

  it("returns false for random data without magic", () => {
    const data = new Uint8Array(100);
    for (let i = 0; i < 100; i++) data[i] = i;
    expect(isEotFormat(data)).toBe(false);
  });

  it("returns true regardless of other header fields if magic is correct", () => {
    const data = new Uint8Array(40);
    const view = new DataView(data.buffer);
    view.setUint16(34, 0x504c, true);
    expect(isEotFormat(data)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseEotHeader
// ---------------------------------------------------------------------------

describe("parseEotHeader", () => {
  it("returns null for non-EOT data", () => {
    const data = new Uint8Array(100);
    expect(parseEotHeader(data)).toBeNull();
  });

  it("returns null for too-short buffer", () => {
    const data = new Uint8Array(50);
    const view = new DataView(data.buffer);
    view.setUint16(34, 0x504c, true);
    expect(parseEotHeader(data)).toBeNull();
  });

  it("parses eotSize and fontDataSize", () => {
    const data = buildEotBuffer({ fontDataSize: 32 });
    const header = parseEotHeader(data);
    expect(header).not.toBeNull();
    expect(header!.fontDataSize).toBe(32);
  });

  it("parses version field", () => {
    const data = buildEotBuffer({ version: 0x00020002 });
    const header = parseEotHeader(data);
    expect(header).not.toBeNull();
    expect(header!.version).toBe(0x00020002);
  });

  it("parses familyName from variable-length string", () => {
    const data = buildEotBuffer({ familyName: "Calibri" });
    const header = parseEotHeader(data);
    expect(header).not.toBeNull();
    expect(header!.familyName).toBe("Calibri");
  });

  it("detects compressed flag", () => {
    const data = buildEotBuffer({ flags: 0x0004 });
    const header = parseEotHeader(data);
    expect(header).not.toBeNull();
    expect(header!.isCompressed).toBe(true);
    expect(header!.isXorEncrypted).toBe(false);
  });

  it("detects XOR encrypted flag", () => {
    const data = buildEotBuffer({ flags: 0x10000000 });
    const header = parseEotHeader(data);
    expect(header).not.toBeNull();
    expect(header!.isXorEncrypted).toBe(true);
    expect(header!.isCompressed).toBe(false);
  });

  it("fontDataOffset points past the name strings", () => {
    const data = buildEotBuffer({ familyName: "TestFont" });
    const header = parseEotHeader(data);
    expect(header).not.toBeNull();
    expect(header!.fontDataOffset).toBeGreaterThan(80);
  });
});

// ---------------------------------------------------------------------------
// extractFontFromEot
// ---------------------------------------------------------------------------

describe("extractFontFromEot", () => {
  it("returns null for non-EOT data", () => {
    expect(extractFontFromEot(new Uint8Array(100))).toBeNull();
  });

  it("returns font data and header for uncompressed EOT", () => {
    const data = buildEotBuffer({ fontDataSize: 16 });
    const result = extractFontFromEot(data);
    expect(result).not.toBeNull();
    expect(result!.header.familyName).toBe("Arial");
    expect(result!.fontData.length).toBe(16);
  });

  it("returns null when fontData extends beyond buffer", () => {
    // Set fontDataSize larger than actual buffer
    const data = buildEotBuffer({ fontDataSize: 10000, totalLength: 120 });
    expect(extractFontFromEot(data)).toBeNull();
  });

  it("extracted font data contains expected bytes", () => {
    const data = buildEotBuffer({ fontDataSize: 8 });
    const result = extractFontFromEot(data);
    expect(result).not.toBeNull();
    // All font data bytes were set to 0xAA in buildEotBuffer
    for (let i = 0; i < result!.fontData.length; i++) {
      expect(result!.fontData[i]).toBe(0xaa);
    }
  });

  it("returns header with correct metadata alongside font data", () => {
    const data = buildEotBuffer({ familyName: "Roboto", version: 0x00020001 });
    const result = extractFontFromEot(data);
    expect(result).not.toBeNull();
    expect(result!.header.familyName).toBe("Roboto");
    expect(result!.header.version).toBe(0x00020001);
  });

  it("returns null for empty buffer", () => {
    expect(extractFontFromEot(new Uint8Array(0))).toBeNull();
  });
});
