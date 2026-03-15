import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  obfuscateFont,
  deobfuscateFont,
  generateFontGuid,
  guidToKey,
  extractGuidFromPartName,
} from "../../utils/font-deobfuscation";
import type { PptxEmbeddedFont, XmlObject } from "../../types";

// ---------------------------------------------------------------------------
// Helper: simulate the save-pipeline font re-embedding logic extracted from
// PptxHandlerRuntimeSaveDocumentParts.applyEmbeddedFontPreservation
// ---------------------------------------------------------------------------

interface FontEmbedResult {
  /** Font files written to the ZIP, keyed by path. */
  writtenFiles: Map<string, Uint8Array>;
  /** Relationship entries added. */
  relationships: Array<{ id: string; type: string; target: string }>;
  /** The embeddedFontLst XML structure. */
  embeddedFontEntries: XmlObject[];
}

/**
 * Extracted/simplified re-embedding logic to test in isolation without
 * needing the full PptxHandlerRuntime class hierarchy.
 */
function simulateFontReEmbedding(
  fonts: PptxEmbeddedFont[],
  existingRels: Array<{ id: string; type: string; target: string }> = [],
): FontEmbedResult {
  const FONT_REL_TYPE =
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/font";

  const fontsWithData = fonts.filter(
    (f) => f.rawFontData && f.rawFontData.length > 0,
  );

  const writtenFiles = new Map<string, Uint8Array>();
  const relationships = [...existingRels];
  const embeddedFontEntries: XmlObject[] = [];

  // Group fonts by name
  const fontsByName = new Map<string, PptxEmbeddedFont[]>();
  for (const font of fontsWithData) {
    const existing = fontsByName.get(font.name) ?? [];
    existing.push(font);
    fontsByName.set(font.name, existing);
  }

  // Find max rId
  let maxId = 0;
  for (const rel of relationships) {
    const num = parseInt(rel.id.replace(/^rId/, ""), 10);
    if (Number.isFinite(num) && num > maxId) maxId = num;
  }

  for (const [typeface, variants] of fontsByName) {
    const entry: XmlObject = {
      "p:font": { "@_typeface": typeface },
    };

    for (const variant of variants) {
      const fontData = variant.rawFontData!;
      const guid = variant.fontGuid ?? generateFontGuid();
      const fileName = `{${guid}}.fntdata`;
      const fontPartPath = `ppt/fonts/${fileName}`;
      const relativeTarget = `fonts/${fileName}`;

      // Obfuscate and write
      const obfuscated = obfuscateFont(fontData, guid);
      writtenFiles.set(fontPartPath, obfuscated);

      // Add relationship
      const existingRel = relationships.find(
        (r) => r.target === relativeTarget,
      );
      let rId: string;
      if (existingRel) {
        rId = existingRel.id;
      } else {
        maxId++;
        rId = `rId${maxId}`;
        relationships.push({
          id: rId,
          type: FONT_REL_TYPE,
          target: relativeTarget,
        });
      }

      const variantKey = variant.bold && variant.italic
        ? "p:boldItalic"
        : variant.bold
          ? "p:bold"
          : variant.italic
            ? "p:italic"
            : "p:regular";

      entry[variantKey] = {
        "@_r:id": rId,
        "@_fontKey": `{${guid}}`,
      };
    }

    embeddedFontEntries.push(entry);
  }

  return { writtenFiles, relationships, embeddedFontEntries };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("font re-embedding (save pipeline)", () => {
  it("should re-embed a single regular font variant", () => {
    const guid = "AABBCCDD-1122-3344-5566-778899AABBCC";
    const clearFontData = new Uint8Array(64);
    clearFontData[0] = 0x00; clearFontData[1] = 0x01;
    clearFontData[2] = 0x00; clearFontData[3] = 0x00;
    for (let i = 4; i < 64; i++) clearFontData[i] = i;

    const fonts: PptxEmbeddedFont[] = [
      {
        name: "TestFont",
        dataUrl: "data:font/ttf;base64,...",
        bold: false,
        italic: false,
        rawFontData: clearFontData,
        fontGuid: guid,
      },
    ];

    const result = simulateFontReEmbedding(fonts);

    // Should write one .fntdata file
    expect(result.writtenFiles.size).toBe(1);
    const writtenPath = `ppt/fonts/{${guid}}.fntdata`;
    expect(result.writtenFiles.has(writtenPath)).toBe(true);

    // Written data should be obfuscated (deobfuscating should give back clear text)
    const writtenData = result.writtenFiles.get(writtenPath)!;
    const deobfuscated = deobfuscateFont(writtenData, guid);
    expect(deobfuscated).toEqual(clearFontData);

    // Should create one relationship
    const fontRels = result.relationships.filter((r) =>
      r.type.includes("/font"),
    );
    expect(fontRels.length).toBe(1);
    expect(fontRels[0].target).toBe(`fonts/{${guid}}.fntdata`);

    // Should produce one embeddedFont entry with p:regular
    expect(result.embeddedFontEntries.length).toBe(1);
    const entry = result.embeddedFontEntries[0];
    expect((entry["p:font"] as XmlObject)["@_typeface"]).toBe("TestFont");
    expect(entry["p:regular"]).toBeDefined();
    expect((entry["p:regular"] as XmlObject)["@_fontKey"]).toBe(`{${guid}}`);
  });

  it("should re-embed multiple variants (regular + bold)", () => {
    const guidRegular = "11111111-1111-1111-1111-111111111111";
    const guidBold = "22222222-2222-2222-2222-222222222222";

    const regularData = new Uint8Array(64);
    regularData.fill(0x10);
    const boldData = new Uint8Array(64);
    boldData.fill(0x20);

    const fonts: PptxEmbeddedFont[] = [
      {
        name: "MultiFace",
        dataUrl: "data:font/ttf;base64,...",
        bold: false,
        italic: false,
        rawFontData: regularData,
        fontGuid: guidRegular,
      },
      {
        name: "MultiFace",
        dataUrl: "data:font/ttf;base64,...",
        bold: true,
        italic: false,
        rawFontData: boldData,
        fontGuid: guidBold,
      },
    ];

    const result = simulateFontReEmbedding(fonts);

    // Two font files
    expect(result.writtenFiles.size).toBe(2);

    // One embeddedFont entry (both variants under same typeface)
    expect(result.embeddedFontEntries.length).toBe(1);
    const entry = result.embeddedFontEntries[0];
    expect(entry["p:regular"]).toBeDefined();
    expect(entry["p:bold"]).toBeDefined();
    expect(entry["p:italic"]).toBeUndefined();
    expect(entry["p:boldItalic"]).toBeUndefined();

    // Two relationships
    const fontRels = result.relationships.filter((r) =>
      r.type.includes("/font"),
    );
    expect(fontRels.length).toBe(2);
  });

  it("should handle all four variants", () => {
    const fonts: PptxEmbeddedFont[] = [
      {
        name: "QuadFont",
        dataUrl: "",
        bold: false,
        italic: false,
        rawFontData: new Uint8Array(64).fill(1),
        fontGuid: "11111111-1111-1111-1111-111111111111",
      },
      {
        name: "QuadFont",
        dataUrl: "",
        bold: true,
        italic: false,
        rawFontData: new Uint8Array(64).fill(2),
        fontGuid: "22222222-2222-2222-2222-222222222222",
      },
      {
        name: "QuadFont",
        dataUrl: "",
        bold: false,
        italic: true,
        rawFontData: new Uint8Array(64).fill(3),
        fontGuid: "33333333-3333-3333-3333-333333333333",
      },
      {
        name: "QuadFont",
        dataUrl: "",
        bold: true,
        italic: true,
        rawFontData: new Uint8Array(64).fill(4),
        fontGuid: "44444444-4444-4444-4444-444444444444",
      },
    ];

    const result = simulateFontReEmbedding(fonts);

    expect(result.writtenFiles.size).toBe(4);
    expect(result.embeddedFontEntries.length).toBe(1);

    const entry = result.embeddedFontEntries[0];
    expect(entry["p:regular"]).toBeDefined();
    expect(entry["p:bold"]).toBeDefined();
    expect(entry["p:italic"]).toBeDefined();
    expect(entry["p:boldItalic"]).toBeDefined();
  });

  it("should handle multiple font families", () => {
    const fonts: PptxEmbeddedFont[] = [
      {
        name: "FontA",
        dataUrl: "",
        bold: false,
        italic: false,
        rawFontData: new Uint8Array(64).fill(0xaa),
        fontGuid: "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA",
      },
      {
        name: "FontB",
        dataUrl: "",
        bold: false,
        italic: false,
        rawFontData: new Uint8Array(64).fill(0xbb),
        fontGuid: "BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB",
      },
    ];

    const result = simulateFontReEmbedding(fonts);

    expect(result.writtenFiles.size).toBe(2);
    expect(result.embeddedFontEntries.length).toBe(2);

    const names = result.embeddedFontEntries.map(
      (e) => (e["p:font"] as XmlObject)["@_typeface"],
    );
    expect(names).toContain("FontA");
    expect(names).toContain("FontB");
  });

  it("should skip fonts without rawFontData", () => {
    const fonts: PptxEmbeddedFont[] = [
      {
        name: "NoDataFont",
        dataUrl: "data:font/ttf;base64,...",
        bold: false,
        italic: false,
        // rawFontData not set
      },
      {
        name: "HasDataFont",
        dataUrl: "",
        bold: false,
        italic: false,
        rawFontData: new Uint8Array(64).fill(0x42),
        fontGuid: "CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC",
      },
    ];

    const result = simulateFontReEmbedding(fonts);

    expect(result.writtenFiles.size).toBe(1);
    expect(result.embeddedFontEntries.length).toBe(1);
    expect(
      (result.embeddedFontEntries[0]["p:font"] as XmlObject)["@_typeface"],
    ).toBe("HasDataFont");
  });

  it("should skip fonts with empty rawFontData", () => {
    const fonts: PptxEmbeddedFont[] = [
      {
        name: "EmptyFont",
        dataUrl: "",
        bold: false,
        italic: false,
        rawFontData: new Uint8Array(0),
      },
    ];

    const result = simulateFontReEmbedding(fonts);
    expect(result.writtenFiles.size).toBe(0);
    expect(result.embeddedFontEntries.length).toBe(0);
  });

  it("should generate a GUID when fontGuid is not provided", () => {
    const fonts: PptxEmbeddedFont[] = [
      {
        name: "NewFont",
        dataUrl: "",
        bold: false,
        italic: false,
        rawFontData: new Uint8Array(64).fill(0x55),
        // fontGuid intentionally not set
      },
    ];

    const result = simulateFontReEmbedding(fonts);

    expect(result.writtenFiles.size).toBe(1);
    const path = Array.from(result.writtenFiles.keys())[0];
    // Path should match ppt/fonts/{GUID}.fntdata format
    expect(path).toMatch(
      /^ppt\/fonts\/\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}\.fntdata$/,
    );

    // Should still be round-trippable
    const guid = extractGuidFromPartName(path)!;
    expect(guid).not.toBeNull();
    const writtenData = result.writtenFiles.get(path)!;
    const deobfuscated = deobfuscateFont(writtenData, guid);
    expect(deobfuscated).toEqual(new Uint8Array(64).fill(0x55));
  });

  it("should not duplicate existing font relationships", () => {
    const guid = "DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD";
    const existingRels = [
      {
        id: "rId99",
        type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/font",
        target: `fonts/{${guid}}.fntdata`,
      },
    ];

    const fonts: PptxEmbeddedFont[] = [
      {
        name: "ExistingFont",
        dataUrl: "",
        bold: false,
        italic: false,
        rawFontData: new Uint8Array(64).fill(0x77),
        fontGuid: guid,
      },
    ];

    const result = simulateFontReEmbedding(fonts, existingRels);

    // Should reuse the existing rId99 instead of creating a new one
    const fontRels = result.relationships.filter((r) =>
      r.type.includes("/font"),
    );
    expect(fontRels.length).toBe(1); // No duplicate
    expect(fontRels[0].id).toBe("rId99");

    // The entry should reference rId99
    const entry = result.embeddedFontEntries[0];
    expect((entry["p:regular"] as XmlObject)["@_r:id"]).toBe("rId99");
  });

  it("should assign incrementing rIds for new fonts", () => {
    const existingRels = [
      { id: "rId1", type: "other", target: "slides/slide1.xml" },
      { id: "rId5", type: "other", target: "theme/theme1.xml" },
    ];

    const fonts: PptxEmbeddedFont[] = [
      {
        name: "FontA",
        dataUrl: "",
        bold: false,
        italic: false,
        rawFontData: new Uint8Array(64).fill(0x11),
        fontGuid: "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA",
      },
      {
        name: "FontB",
        dataUrl: "",
        bold: false,
        italic: false,
        rawFontData: new Uint8Array(64).fill(0x22),
        fontGuid: "BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB",
      },
    ];

    const result = simulateFontReEmbedding(fonts, existingRels);

    const fontRels = result.relationships.filter((r) =>
      r.type.includes("/font"),
    );
    expect(fontRels.length).toBe(2);
    expect(fontRels[0].id).toBe("rId6"); // Next after rId5
    expect(fontRels[1].id).toBe("rId7");
  });
});

// ---------------------------------------------------------------------------
// Full re-embedding data integrity
// ---------------------------------------------------------------------------

describe("font re-embedding data integrity", () => {
  it("obfuscated file can be loaded back correctly", () => {
    // Simulate a real TrueType font
    const fontBody = new Uint8Array(1024);
    fontBody[0] = 0x00;
    fontBody[1] = 0x01;
    fontBody[2] = 0x00;
    fontBody[3] = 0x00;
    for (let i = 4; i < 1024; i++) {
      fontBody[i] = (i * 37 + 13) & 0xff;
    }

    const guid = generateFontGuid();

    // Save: obfuscate
    const stored = obfuscateFont(fontBody, guid);

    // Verify obfuscated header is different from original
    expect(stored[0]).not.toBe(fontBody[0]);

    // Load: deobfuscate
    const loaded = deobfuscateFont(stored, guid);

    // Every byte must match
    expect(loaded.length).toBe(fontBody.length);
    for (let i = 0; i < loaded.length; i++) {
      expect(loaded[i]).toBe(fontBody[i]);
    }
  });

  it("obfuscation only affects first 32 bytes", () => {
    const fontBody = new Uint8Array(256);
    for (let i = 0; i < 256; i++) fontBody[i] = i & 0xff;

    const guid = "12345678-ABCD-EF01-2345-6789ABCDEF01";
    const obfuscated = obfuscateFont(fontBody, guid);

    // Bytes 32-255 should be identical
    for (let i = 32; i < 256; i++) {
      expect(obfuscated[i]).toBe(fontBody[i]);
    }

    // At least one of the first 32 bytes should differ
    // (unless the key has a zero byte at that position AND data is zero)
    const key = guidToKey(guid);
    let allSame = true;
    for (let i = 0; i < 32; i++) {
      if (obfuscated[i] !== fontBody[i]) {
        allSame = false;
        break;
      }
    }
    // With non-zero key and non-zero data, they should differ
    expect(allSame).toBe(false);
  });
});
