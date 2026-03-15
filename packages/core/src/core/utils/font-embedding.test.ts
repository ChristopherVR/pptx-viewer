import { describe, it, expect } from "vitest";
import {
  deobfuscateFont,
  obfuscateFont,
  generateFontGuid,
  guidToKey,
  extractGuidFromPartName,
} from "./font-deobfuscation";

// ---------------------------------------------------------------------------
// obfuscateFont
// ---------------------------------------------------------------------------

describe("obfuscateFont", () => {
  it("is the inverse of deobfuscateFont (round-trip)", () => {
    const guid = "AABBCCDD-1122-3344-5566-778899AABBCC";
    // Simulate clear-text font data (e.g. TrueType header + body)
    const clearText = new Uint8Array(128);
    // TrueType magic: 0x00 0x01 0x00 0x00
    clearText[0] = 0x00;
    clearText[1] = 0x01;
    clearText[2] = 0x00;
    clearText[3] = 0x00;
    for (let i = 4; i < 128; i++) clearText[i] = i * 7;

    // Obfuscate clear-text to get what would be stored in .fntdata
    const obfuscated = obfuscateFont(clearText, guid);

    // The first 32 bytes should be different (since key is non-zero)
    let firstBytesDiffer = false;
    for (let i = 0; i < 32; i++) {
      if (obfuscated[i] !== clearText[i]) {
        firstBytesDiffer = true;
        break;
      }
    }
    expect(firstBytesDiffer).toBe(true);

    // Bytes beyond 32 should be unchanged
    for (let i = 32; i < 128; i++) {
      expect(obfuscated[i]).toBe(clearText[i]);
    }

    // Deobfuscate to get back the original
    const restored = deobfuscateFont(obfuscated, guid);
    expect(restored).toEqual(clearText);
  });

  it("obfuscate(deobfuscate(data)) restores original obfuscated data", () => {
    const guid = "F7A0C94A-3F90-4c3a-AE50-B05A7B0F6C65";

    // Start with "obfuscated" data (as stored in .fntdata)
    const obfuscatedOriginal = new Uint8Array(64);
    for (let i = 0; i < 64; i++) obfuscatedOriginal[i] = (i * 13 + 7) & 0xff;

    // Deobfuscate (as during load)
    const clearText = deobfuscateFont(obfuscatedOriginal, guid);

    // Re-obfuscate (as during save)
    const reObfuscated = obfuscateFont(clearText, guid);

    // Should be identical to the original obfuscated data
    expect(reObfuscated).toEqual(obfuscatedOriginal);
  });

  it("produces the correct XOR for known data", () => {
    const guid = "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF";
    const clearText = new Uint8Array(32);
    clearText.fill(0x42);

    const obfuscated = obfuscateFont(clearText, guid);

    // XOR with all-FF key: 0x42 ^ 0xFF = 0xBD
    for (let i = 0; i < 32; i++) {
      expect(obfuscated[i]).toBe(0x42 ^ 0xff);
    }
  });

  it("handles short data (< 32 bytes) by returning a copy", () => {
    const guid = "AABBCCDD-1122-3344-5566-778899AABBCC";
    const short = new Uint8Array([1, 2, 3, 4, 5]);
    const result = obfuscateFont(short, guid);
    expect(result).toEqual(short);
    expect(result).not.toBe(short); // Should be a copy
  });

  it("preserves data beyond byte 32", () => {
    const guid = "AABBCCDD-1122-3344-5566-778899AABBCC";
    const data = new Uint8Array(100);
    for (let i = 0; i < 100; i++) data[i] = i;

    const result = obfuscateFont(data, guid);

    // Bytes 32-99 should be identical to the input
    for (let i = 32; i < 100; i++) {
      expect(result[i]).toBe(data[i]);
    }
  });

  it("uses different bytes for different GUIDs", () => {
    const guid1 = "AABBCCDD-1122-3344-5566-778899AABBCC";
    const guid2 = "11223344-5566-7788-99AA-BBCCDDEEFF00";
    const data = new Uint8Array(64);
    data.fill(0x55);

    const r1 = obfuscateFont(data, guid1);
    const r2 = obfuscateFont(data, guid2);

    // At least some of the first 32 bytes must differ
    let anyDifferent = false;
    for (let i = 0; i < 32; i++) {
      if (r1[i] !== r2[i]) {
        anyDifferent = true;
        break;
      }
    }
    expect(anyDifferent).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateFontGuid
// ---------------------------------------------------------------------------

describe("generateFontGuid", () => {
  it("generates a valid GUID string", () => {
    const guid = generateFontGuid();
    // Format: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX (8-4-4-4-12)
    const guidRegex =
      /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;
    expect(guid).toMatch(guidRegex);
  });

  it("generates unique GUIDs on successive calls", () => {
    const guids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      guids.add(generateFontGuid());
    }
    // Should have 50 unique GUIDs
    expect(guids.size).toBe(50);
  });

  it("can be used as a valid key for guidToKey", () => {
    const guid = generateFontGuid();
    const key = guidToKey(guid);
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(16);
  });

  it("can be extracted from a part name constructed with it", () => {
    const guid = generateFontGuid();
    const partName = `ppt/fonts/{${guid}}.fntdata`;
    const extracted = extractGuidFromPartName(partName);
    expect(extracted).toBe(guid);
  });

  it("generates uppercase hex characters", () => {
    // Run multiple times to ensure consistent case
    for (let i = 0; i < 10; i++) {
      const guid = generateFontGuid();
      const hexOnly = guid.replace(/-/g, "");
      // All characters should be 0-9 or A-F (uppercase)
      expect(hexOnly).toMatch(/^[0-9A-F]+$/);
    }
  });
});

// ---------------------------------------------------------------------------
// Full round-trip: clear → obfuscate → store → deobfuscate → verify
// ---------------------------------------------------------------------------

describe("font embedding round-trip", () => {
  it("simulates full load-save cycle preserving font data", () => {
    // Simulate a TrueType font (header + table data)
    const fontData = new Uint8Array(256);
    // TrueType header: version 1.0
    fontData[0] = 0x00;
    fontData[1] = 0x01;
    fontData[2] = 0x00;
    fontData[3] = 0x00;
    // Fill body
    for (let i = 4; i < 256; i++) {
      fontData[i] = (i * 17 + 3) & 0xff;
    }

    // === Step 1: Create PPTX (obfuscate) ===
    const originalGuid = generateFontGuid();
    const storedData = obfuscateFont(fontData, originalGuid);

    // Verify it looks different from the original in the first 32 bytes
    expect(storedData.slice(0, 4)).not.toEqual(fontData.slice(0, 4));

    // === Step 2: Load PPTX (deobfuscate) ===
    const loadedData = deobfuscateFont(storedData, originalGuid);
    expect(loadedData).toEqual(fontData);

    // === Step 3: Save PPTX (re-obfuscate with same GUID) ===
    const reStoredData = obfuscateFont(loadedData, originalGuid);
    expect(reStoredData).toEqual(storedData);
  });

  it("supports re-obfuscating with a new GUID", () => {
    const fontData = new Uint8Array(64);
    for (let i = 0; i < 64; i++) fontData[i] = i;

    // Obfuscate with GUID A
    const guidA = generateFontGuid();
    const obfuscatedA = obfuscateFont(fontData, guidA);

    // Deobfuscate with GUID A
    const restored = deobfuscateFont(obfuscatedA, guidA);
    expect(restored).toEqual(fontData);

    // Re-obfuscate with a different GUID B
    const guidB = generateFontGuid();
    const obfuscatedB = obfuscateFont(restored, guidB);

    // Deobfuscate with GUID B should give back original
    const restoredB = deobfuscateFont(obfuscatedB, guidB);
    expect(restoredB).toEqual(fontData);

    // But the two obfuscated versions should differ
    expect(obfuscatedA).not.toEqual(obfuscatedB);
  });

  it("preserves OpenType (OTTO) font headers through round-trip", () => {
    const fontData = new Uint8Array(64);
    // OTTO magic
    fontData[0] = 0x4f;
    fontData[1] = 0x54;
    fontData[2] = 0x54;
    fontData[3] = 0x4f;
    for (let i = 4; i < 64; i++) fontData[i] = i;

    const guid = generateFontGuid();
    const obfuscated = obfuscateFont(fontData, guid);
    const restored = deobfuscateFont(obfuscated, guid);

    expect(restored[0]).toBe(0x4f); // O
    expect(restored[1]).toBe(0x54); // T
    expect(restored[2]).toBe(0x54); // T
    expect(restored[3]).toBe(0x4f); // O
    expect(restored).toEqual(fontData);
  });
});
