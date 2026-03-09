import { describe, it, expect } from "vitest";
import {
  extractGuidFromPartName,
  guidToKey,
  deobfuscateFont,
  detectFontFormat,
} from "./font-deobfuscation";

// ---------------------------------------------------------------------------
// extractGuidFromPartName
// ---------------------------------------------------------------------------

describe("extractGuidFromPartName", () => {
  it("extracts GUID from brace-wrapped path", () => {
    const result = extractGuidFromPartName(
      "ppt/fonts/{F7A0C94A-3F90-4c3a-AE50-B05A7B0F6C65}.fntdata",
    );
    expect(result).toBe("F7A0C94A-3F90-4c3a-AE50-B05A7B0F6C65");
  });

  it("extracts GUID from bare (no braces) path", () => {
    const result = extractGuidFromPartName(
      "ppt/fonts/F7A0C94A-3F90-4c3a-AE50-B05A7B0F6C65.fntdata",
    );
    expect(result).toBe("F7A0C94A-3F90-4c3a-AE50-B05A7B0F6C65");
  });

  it("returns null when no GUID is present", () => {
    expect(extractGuidFromPartName("ppt/fonts/arial.ttf")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractGuidFromPartName("")).toBeNull();
  });

  it("extracts GUID with uppercase hex", () => {
    const result = extractGuidFromPartName(
      "{AABBCCDD-1122-3344-5566-778899AABBCC}.odttf",
    );
    expect(result).toBe("AABBCCDD-1122-3344-5566-778899AABBCC");
  });

  it("extracts GUID with lowercase hex", () => {
    const result = extractGuidFromPartName(
      "{aabbccdd-1122-3344-5566-778899aabbcc}.fntdata",
    );
    expect(result).toBe("aabbccdd-1122-3344-5566-778899aabbcc");
  });

  it("handles mixed case GUIDs", () => {
    const result = extractGuidFromPartName(
      "ppt/fonts/{AaBbCcDd-1122-3344-5566-778899AaBbCc}.fntdata",
    );
    expect(result).toBe("AaBbCcDd-1122-3344-5566-778899AaBbCc");
  });

  it("returns null for partial GUID", () => {
    expect(extractGuidFromPartName("ppt/fonts/{F7A0C94A-3F90}.fntdata")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// guidToKey
// ---------------------------------------------------------------------------

describe("guidToKey", () => {
  it("converts a GUID to a 16-byte key", () => {
    const key = guidToKey("F7A0C94A-3F90-4c3a-AE50-B05A7B0F6C65");
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(16);
  });

  it("produces correct bytes for known GUID", () => {
    // GUID: AABBCCDD-1122-3344-5566-778899AABBCC
    // Stripped: AABBCCDD11223344556677889 9AABBCC
    const key = guidToKey("AABBCCDD-1122-3344-5566-778899AABBCC");
    expect(key[0]).toBe(0xaa);
    expect(key[1]).toBe(0xbb);
    expect(key[2]).toBe(0xcc);
    expect(key[3]).toBe(0xdd);
    expect(key[4]).toBe(0x11);
    expect(key[5]).toBe(0x22);
  });

  it("throws for invalid GUID length", () => {
    expect(() => guidToKey("short")).toThrow("Invalid GUID length");
  });

  it("handles GUID with braces (braces are stripped)", () => {
    const key = guidToKey("{AABBCCDD-1122-3344-5566-778899AABBCC}");
    expect(key.length).toBe(16);
    expect(key[0]).toBe(0xaa);
  });
});

// ---------------------------------------------------------------------------
// deobfuscateFont
// ---------------------------------------------------------------------------

describe("deobfuscateFont", () => {
  it("XOR-deobfuscates the first 32 bytes", () => {
    const guid = "00000000-0000-0000-0000-000000000000";
    // All-zero GUID means XOR with 0 = identity
    const fontData = new Uint8Array(64);
    for (let i = 0; i < 64; i++) fontData[i] = i;
    const result = deobfuscateFont(fontData, guid);
    // With a zero key, XOR does nothing
    expect(result[0]).toBe(0);
    expect(result[31]).toBe(31);
    expect(result[32]).toBe(32); // Unchanged beyond 32 bytes
  });

  it("leaves bytes after position 32 unchanged", () => {
    const guid = "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF";
    const fontData = new Uint8Array(64);
    for (let i = 0; i < 64; i++) fontData[i] = 0x42;
    const result = deobfuscateFont(fontData, guid);
    // First 32 bytes are XOR'd with 0xFF
    expect(result[0]).toBe(0x42 ^ 0xff);
    // Bytes 32+ are untouched
    expect(result[32]).toBe(0x42);
    expect(result[63]).toBe(0x42);
  });

  it("returns a copy for font data shorter than 32 bytes", () => {
    const guid = "AABBCCDD-1122-3344-5566-778899AABBCC";
    const fontData = new Uint8Array([1, 2, 3]);
    const result = deobfuscateFont(fontData, guid);
    expect(result).toEqual(fontData);
    // Should be a copy, not the same reference
    expect(result).not.toBe(fontData);
  });

  it("round-trips (double XOR restores original)", () => {
    const guid = "AABBCCDD-1122-3344-5566-778899AABBCC";
    const original = new Uint8Array(64);
    for (let i = 0; i < 64; i++) original[i] = i * 3;
    const obfuscated = deobfuscateFont(original, guid);
    const restored = deobfuscateFont(obfuscated, guid);
    expect(restored).toEqual(original);
  });

  it("uses key modulo 16 for bytes 16-31", () => {
    const guid = "AABBCCDD-1122-3344-5566-778899AABBCC";
    const key = guidToKey(guid);
    const fontData = new Uint8Array(32);
    fontData.fill(0);
    const result = deobfuscateFont(fontData, guid);
    // Byte 16 should be XOR'd with key[0] (since 16 % 16 = 0)
    expect(result[16]).toBe(key[0]);
    expect(result[17]).toBe(key[1]);
  });
});

// ---------------------------------------------------------------------------
// detectFontFormat
// ---------------------------------------------------------------------------

describe("detectFontFormat", () => {
  it('returns "truetype" for short data', () => {
    expect(detectFontFormat(new Uint8Array([0, 1, 2]))).toBe("truetype");
  });

  it('detects WOFF2 format', () => {
    // 'wOF2' = 0x77 0x4F 0x46 0x32
    const data = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 0, 0, 0]);
    expect(detectFontFormat(data)).toBe("woff2");
  });

  it('detects WOFF format', () => {
    // 'wOFF' = 0x77 0x4F 0x46 0x46
    const data = new Uint8Array([0x77, 0x4f, 0x46, 0x46, 0, 0, 0, 0]);
    expect(detectFontFormat(data)).toBe("woff");
  });

  it('detects OpenType (CFF) format', () => {
    // 'OTTO' = 0x4F 0x54 0x54 0x4F
    const data = new Uint8Array([0x4f, 0x54, 0x54, 0x4f, 0, 0, 0, 0]);
    expect(detectFontFormat(data)).toBe("opentype");
  });

  it('returns "truetype" for TrueType header', () => {
    // TrueType version 1.0: 0x00010000
    const data = new Uint8Array([0x00, 0x01, 0x00, 0x00, 0, 0, 0, 0]);
    expect(detectFontFormat(data)).toBe("truetype");
  });

  it('returns "truetype" for unknown magic bytes', () => {
    const data = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0, 0, 0, 0]);
    expect(detectFontFormat(data)).toBe("truetype");
  });
});
