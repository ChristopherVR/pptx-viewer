import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Extracted logic from PptxHandlerRuntimeEmbeddedFonts
// ---------------------------------------------------------------------------

interface XmlObject {
  [key: string]: unknown;
}

function ensureArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Extracted from getEmbeddedFonts — parses embedded font entry metadata
 * from the presentation XML. Returns typeface and variant descriptors.
 */
function parseEmbeddedFontEntries(
  presentationData: XmlObject | undefined,
): Array<{
  typeface: string;
  variants: Array<{ key: string; rId: string; fontKey?: string; bold: boolean; italic: boolean }>;
}> {
  const embeddedFontEntries = ensureArray(
    (presentationData?.["p:presentation"] as XmlObject | undefined)?.[
      "p:embeddedFontLst"
    ]?.["p:embeddedFont"],
  ) as XmlObject[];

  if (embeddedFontEntries.length === 0) return [];

  const results: Array<{
    typeface: string;
    variants: Array<{ key: string; rId: string; fontKey?: string; bold: boolean; italic: boolean }>;
  }> = [];

  for (const entry of embeddedFontEntries) {
    const typeface = String(entry?.["p:font"]?.["@_typeface"] || "").trim();
    if (!typeface) continue;

    const variantDefs = [
      { key: "p:regular", bold: false, italic: false },
      { key: "p:bold", bold: true, italic: false },
      { key: "p:italic", bold: false, italic: true },
      { key: "p:boldItalic", bold: true, italic: true },
    ];

    const variants: Array<{ key: string; rId: string; fontKey?: string; bold: boolean; italic: boolean }> = [];
    for (const variant of variantDefs) {
      const variantEl = entry?.[variant.key] as XmlObject | undefined;
      if (!variantEl) continue;
      const rId = String(variantEl["@_r:id"] || "").trim();
      if (!rId) continue;
      const fontKey = String(variantEl["@_fontKey"] || "").trim() || undefined;
      variants.push({
        key: variant.key,
        rId,
        fontKey,
        bold: variant.bold,
        italic: variant.italic,
      });
    }

    if (variants.length > 0) {
      results.push({ typeface, variants });
    }
  }

  return results;
}

/**
 * Extracted from loadPresentationFontRels — parses presentation rels
 * to build rId → font path map.
 */
function parseFontRelationships(
  relationships: XmlObject[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const rel of relationships) {
    const type = String(rel?.["@_Type"] || "");
    if (!type.includes("/font")) continue;
    const id = String(rel?.["@_Id"] || "");
    const target = String(rel?.["@_Target"] || "");
    if (id && target) {
      map.set(
        id,
        target.startsWith("/") ? target.substring(1) : `ppt/${target}`,
      );
    }
  }
  return map;
}

/**
 * Extracted from getLayoutOptions — parses layout options from layoutXmlMap entries.
 */
function parseLayoutOption(
  path: string,
  xmlObj: XmlObject,
): { path: string; name: string; type?: string } {
  const sldLayout = (xmlObj as XmlObject)["p:sldLayout"] as XmlObject | undefined;
  const name = String(sldLayout?.["p:cSld"]?.["@_name"] || "").trim() || path;
  const type = sldLayout?.["@_type"] != null
    ? String(sldLayout["@_type"]).trim()
    : undefined;
  return { path, name, ...(type ? { type } : {}) };
}

// ---------------------------------------------------------------------------
// Tests: parseEmbeddedFontEntries
// ---------------------------------------------------------------------------
describe("parseEmbeddedFontEntries", () => {
  it("should return empty array for undefined presentation data", () => {
    expect(parseEmbeddedFontEntries(undefined)).toEqual([]);
  });

  it("should return empty array when no embeddedFontLst", () => {
    expect(parseEmbeddedFontEntries({ "p:presentation": {} })).toEqual([]);
  });

  it("should parse a single font with regular variant", () => {
    const data: XmlObject = {
      "p:presentation": {
        "p:embeddedFontLst": {
          "p:embeddedFont": {
            "p:font": { "@_typeface": "Calibri" },
            "p:regular": { "@_r:id": "rId1" },
          },
        },
      },
    };
    const result = parseEmbeddedFontEntries(data);
    expect(result).toHaveLength(1);
    expect(result[0].typeface).toBe("Calibri");
    expect(result[0].variants).toHaveLength(1);
    expect(result[0].variants[0]).toEqual({
      key: "p:regular",
      rId: "rId1",
      fontKey: undefined,
      bold: false,
      italic: false,
    });
  });

  it("should parse multiple variants", () => {
    const data: XmlObject = {
      "p:presentation": {
        "p:embeddedFontLst": {
          "p:embeddedFont": {
            "p:font": { "@_typeface": "Arial" },
            "p:regular": { "@_r:id": "rId1" },
            "p:bold": { "@_r:id": "rId2" },
            "p:italic": { "@_r:id": "rId3" },
            "p:boldItalic": { "@_r:id": "rId4" },
          },
        },
      },
    };
    const result = parseEmbeddedFontEntries(data);
    expect(result[0].variants).toHaveLength(4);
    expect(result[0].variants[0].bold).toBe(false);
    expect(result[0].variants[0].italic).toBe(false);
    expect(result[0].variants[1].bold).toBe(true);
    expect(result[0].variants[1].italic).toBe(false);
    expect(result[0].variants[2].bold).toBe(false);
    expect(result[0].variants[2].italic).toBe(true);
    expect(result[0].variants[3].bold).toBe(true);
    expect(result[0].variants[3].italic).toBe(true);
  });

  it("should skip fonts without typeface", () => {
    const data: XmlObject = {
      "p:presentation": {
        "p:embeddedFontLst": {
          "p:embeddedFont": {
            "p:font": {},
            "p:regular": { "@_r:id": "rId1" },
          },
        },
      },
    };
    expect(parseEmbeddedFontEntries(data)).toEqual([]);
  });

  it("should skip variants without r:id", () => {
    const data: XmlObject = {
      "p:presentation": {
        "p:embeddedFontLst": {
          "p:embeddedFont": {
            "p:font": { "@_typeface": "Times" },
            "p:regular": {},
          },
        },
      },
    };
    expect(parseEmbeddedFontEntries(data)).toEqual([]);
  });

  it("should extract fontKey when present", () => {
    const data: XmlObject = {
      "p:presentation": {
        "p:embeddedFontLst": {
          "p:embeddedFont": {
            "p:font": { "@_typeface": "Custom" },
            "p:regular": {
              "@_r:id": "rId5",
              "@_fontKey": "{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}",
            },
          },
        },
      },
    };
    const result = parseEmbeddedFontEntries(data);
    expect(result[0].variants[0].fontKey).toBe("{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}");
  });

  it("should parse multiple fonts in array", () => {
    const data: XmlObject = {
      "p:presentation": {
        "p:embeddedFontLst": {
          "p:embeddedFont": [
            {
              "p:font": { "@_typeface": "Font1" },
              "p:regular": { "@_r:id": "rId1" },
            },
            {
              "p:font": { "@_typeface": "Font2" },
              "p:bold": { "@_r:id": "rId2" },
            },
          ],
        },
      },
    };
    const result = parseEmbeddedFontEntries(data);
    expect(result).toHaveLength(2);
    expect(result[0].typeface).toBe("Font1");
    expect(result[1].typeface).toBe("Font2");
  });
});

// ---------------------------------------------------------------------------
// Tests: parseFontRelationships
// ---------------------------------------------------------------------------
describe("parseFontRelationships", () => {
  it("should return empty map for empty array", () => {
    expect(parseFontRelationships([]).size).toBe(0);
  });

  it("should extract font relationships", () => {
    const rels: XmlObject[] = [
      { "@_Type": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/font", "@_Id": "rId1", "@_Target": "fonts/font1.fntdata" },
    ];
    const map = parseFontRelationships(rels);
    expect(map.get("rId1")).toBe("ppt/fonts/font1.fntdata");
  });

  it("should skip non-font relationships", () => {
    const rels: XmlObject[] = [
      { "@_Type": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide", "@_Id": "rId1", "@_Target": "slides/slide1.xml" },
    ];
    const map = parseFontRelationships(rels);
    expect(map.size).toBe(0);
  });

  it("should handle absolute targets (starting with /)", () => {
    const rels: XmlObject[] = [
      { "@_Type": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/font", "@_Id": "rId1", "@_Target": "/ppt/fonts/font1.fntdata" },
    ];
    const map = parseFontRelationships(rels);
    expect(map.get("rId1")).toBe("ppt/fonts/font1.fntdata");
  });

  it("should handle multiple font entries", () => {
    const rels: XmlObject[] = [
      { "@_Type": ".../font", "@_Id": "rId1", "@_Target": "fonts/a.fntdata" },
      { "@_Type": ".../font", "@_Id": "rId2", "@_Target": "fonts/b.fntdata" },
      { "@_Type": ".../slide", "@_Id": "rId3", "@_Target": "slides/s1.xml" },
    ];
    const map = parseFontRelationships(rels);
    expect(map.size).toBe(2);
  });

  it("should skip entries without Id", () => {
    const rels: XmlObject[] = [
      { "@_Type": ".../font", "@_Target": "fonts/a.fntdata" },
    ];
    const map = parseFontRelationships(rels);
    expect(map.size).toBe(0);
  });

  it("should skip entries without Target", () => {
    const rels: XmlObject[] = [
      { "@_Type": ".../font", "@_Id": "rId1" },
    ];
    const map = parseFontRelationships(rels);
    expect(map.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: parseLayoutOption
// ---------------------------------------------------------------------------
describe("parseLayoutOption", () => {
  it("should extract layout name from p:cSld @_name", () => {
    const result = parseLayoutOption("ppt/slideLayouts/slideLayout1.xml", {
      "p:sldLayout": {
        "p:cSld": { "@_name": "Title Slide" },
      },
    });
    expect(result.name).toBe("Title Slide");
    expect(result.path).toBe("ppt/slideLayouts/slideLayout1.xml");
  });

  it("should fall back to path when name is empty", () => {
    const result = parseLayoutOption("ppt/slideLayouts/slideLayout2.xml", {
      "p:sldLayout": {
        "p:cSld": { "@_name": "" },
      },
    });
    expect(result.name).toBe("ppt/slideLayouts/slideLayout2.xml");
  });

  it("should fall back to path when no p:cSld", () => {
    const result = parseLayoutOption("path.xml", {
      "p:sldLayout": {},
    });
    expect(result.name).toBe("path.xml");
  });

  it("should extract type when present", () => {
    const result = parseLayoutOption("path.xml", {
      "p:sldLayout": {
        "@_type": "title",
        "p:cSld": { "@_name": "Title" },
      },
    });
    expect(result.type).toBe("title");
  });

  it("should not include type when absent", () => {
    const result = parseLayoutOption("path.xml", {
      "p:sldLayout": {
        "p:cSld": { "@_name": "Blank" },
      },
    });
    expect(result.type).toBeUndefined();
  });

  it("should handle missing p:sldLayout", () => {
    const result = parseLayoutOption("path.xml", {});
    expect(result.name).toBe("path.xml");
    expect(result.type).toBeUndefined();
  });
});
