import { describe, it, expect } from "vitest";
import type { XmlObject, PptxSmartArtChrome } from "../../types";

// ---------------------------------------------------------------------------
// Extracted from PptxHandlerRuntimeSmartArtXmlUtils
// Pure re-implementations of helper functions for direct testing.
// ---------------------------------------------------------------------------

/**
 * Stub for parseColor — extracts hex from a:srgbClr/@_val.
 */
function parseColor(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as XmlObject;
  const srgb = obj["a:srgbClr"] as XmlObject | undefined;
  if (srgb?.["@_val"]) return `#${srgb["@_val"]}`;
  return null;
}

/**
 * Stub for xmlLookupService.getChildByLocalName — finds first child key
 * matching the given local name (after the colon prefix).
 */
function getChildByLocalName(
  parent: XmlObject | undefined,
  localName: string,
): XmlObject | undefined {
  if (!parent) return undefined;
  for (const [key, value] of Object.entries(parent)) {
    const colonIdx = key.indexOf(":");
    const keyLocal = colonIdx >= 0 ? key.slice(colonIdx + 1) : key;
    if (keyLocal === localName && value && typeof value === "object" && !Array.isArray(value)) {
      return value as XmlObject;
    }
  }
  return undefined;
}

/**
 * Extracted from PptxHandlerRuntimeSmartArtXmlUtils.parseSmartArtChrome.
 */
function parseSmartArtChrome(
  dataModel: XmlObject | undefined,
): PptxSmartArtChrome | undefined {
  if (!dataModel) return undefined;

  const bg = getChildByLocalName(dataModel, "bg");
  const whole = getChildByLocalName(dataModel, "whole");
  if (!bg && !whole) return undefined;

  const chrome: PptxSmartArtChrome = {};

  if (bg) {
    const solidFill = getChildByLocalName(bg, "solidFill");
    const bgColor = parseColor(solidFill);
    if (bgColor) {
      chrome.backgroundColor = bgColor;
    }
  }

  if (whole) {
    const lnNode = getChildByLocalName(whole, "ln");
    if (lnNode) {
      const solidFill = getChildByLocalName(lnNode, "solidFill");
      const outlineColor = parseColor(solidFill);
      if (outlineColor) {
        chrome.outlineColor = outlineColor;
      }
      const widthRaw = parseInt(String(lnNode["@_w"] || ""), 10);
      if (Number.isFinite(widthRaw) && widthRaw > 0) {
        chrome.outlineWidth = widthRaw / 12700; // EMU to pt
      }
    }
  }

  return chrome.backgroundColor || chrome.outlineColor ? chrome : undefined;
}

/**
 * Extracted from PptxHandlerRuntimeSmartArtXmlUtils.resolveSmartArtSchemeColor.
 */
function resolveSmartArtSchemeColor(
  schemeClr: XmlObject | undefined,
  themeColorMap: Record<string, string>,
): string | undefined {
  if (!schemeClr) return undefined;
  const val = String(schemeClr["@_val"] || "").trim();
  if (val.length === 0) return undefined;
  const mapped = themeColorMap[val];
  if (mapped) return mapped.startsWith("#") ? mapped : `#${mapped}`;
  return undefined;
}

/**
 * Extracted from PptxHandlerRuntimeSmartArtXmlUtils.collectLocalTextValues.
 */
function collectLocalTextValues(
  node: unknown,
  localName: string,
  output: string[],
): void {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    node.forEach((entry) => {
      collectLocalTextValues(entry, localName, output);
    });
    return;
  }
  if (typeof node !== "object") return;

  const objectNode = node as XmlObject;
  for (const [key, value] of Object.entries(objectNode)) {
    const colonIdx = key.indexOf(":");
    const keyLocal = colonIdx >= 0 ? key.slice(colonIdx + 1) : key;
    if (keyLocal === localName) {
      if (typeof value === "string" || typeof value === "number") {
        const textValue = String(value).trim();
        if (textValue.length > 0) {
          output.push(textValue);
        }
        continue;
      }
    }
    collectLocalTextValues(value, localName, output);
  }
}

// ---------------------------------------------------------------------------
// parseSmartArtChrome
// ---------------------------------------------------------------------------
describe("parseSmartArtChrome", () => {
  it("should return undefined for undefined dataModel", () => {
    expect(parseSmartArtChrome(undefined)).toBeUndefined();
  });

  it("should return undefined when neither bg nor whole exist", () => {
    expect(parseSmartArtChrome({})).toBeUndefined();
  });

  it("should parse background color from bg solidFill", () => {
    const dataModel: XmlObject = {
      "dgm:bg": {
        "a:solidFill": {
          "a:srgbClr": { "@_val": "AABBCC" },
        },
      },
    };
    const result = parseSmartArtChrome(dataModel);
    expect(result).toBeDefined();
    expect(result!.backgroundColor).toBe("#AABBCC");
  });

  it("should parse outline color and width from whole/ln", () => {
    const dataModel: XmlObject = {
      "dgm:whole": {
        "a:ln": {
          "@_w": "25400", // 2pt
          "a:solidFill": {
            "a:srgbClr": { "@_val": "112233" },
          },
        },
      },
    };
    const result = parseSmartArtChrome(dataModel);
    expect(result).toBeDefined();
    expect(result!.outlineColor).toBe("#112233");
    expect(result!.outlineWidth).toBeCloseTo(2);
  });

  it("should return undefined when bg has no fill and whole has no ln color", () => {
    const dataModel: XmlObject = {
      "dgm:bg": {},
      "dgm:whole": { "a:ln": {} },
    };
    const result = parseSmartArtChrome(dataModel);
    expect(result).toBeUndefined();
  });

  it("should parse both background and outline", () => {
    const dataModel: XmlObject = {
      "dgm:bg": {
        "a:solidFill": { "a:srgbClr": { "@_val": "FFFFFF" } },
      },
      "dgm:whole": {
        "a:ln": {
          "@_w": "12700",
          "a:solidFill": { "a:srgbClr": { "@_val": "000000" } },
        },
      },
    };
    const result = parseSmartArtChrome(dataModel);
    expect(result!.backgroundColor).toBe("#FFFFFF");
    expect(result!.outlineColor).toBe("#000000");
    expect(result!.outlineWidth).toBeCloseTo(1);
  });

  it("should skip outline width when zero or invalid", () => {
    const dataModel: XmlObject = {
      "dgm:whole": {
        "a:ln": {
          "@_w": "0",
          "a:solidFill": { "a:srgbClr": { "@_val": "FF0000" } },
        },
      },
    };
    const result = parseSmartArtChrome(dataModel);
    expect(result!.outlineColor).toBe("#FF0000");
    expect(result!.outlineWidth).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveSmartArtSchemeColor
// ---------------------------------------------------------------------------
describe("resolveSmartArtSchemeColor", () => {
  it("should return undefined for undefined schemeClr", () => {
    expect(resolveSmartArtSchemeColor(undefined, {})).toBeUndefined();
  });

  it("should return undefined when @_val is empty", () => {
    expect(
      resolveSmartArtSchemeColor({ "@_val": "" }, { accent1: "4472C4" }),
    ).toBeUndefined();
  });

  it("should return undefined when scheme value is not in theme map", () => {
    expect(
      resolveSmartArtSchemeColor(
        { "@_val": "accent7" },
        { accent1: "4472C4" },
      ),
    ).toBeUndefined();
  });

  it("should resolve scheme color from theme map (no # prefix)", () => {
    expect(
      resolveSmartArtSchemeColor(
        { "@_val": "accent1" },
        { accent1: "4472C4" },
      ),
    ).toBe("#4472C4");
  });

  it("should pass through # prefix if already present", () => {
    expect(
      resolveSmartArtSchemeColor(
        { "@_val": "dk1" },
        { dk1: "#000000" },
      ),
    ).toBe("#000000");
  });

  it("should resolve different scheme colors", () => {
    const map = {
      lt1: "FFFFFF",
      dk1: "000000",
      accent2: "ED7D31",
    };
    expect(
      resolveSmartArtSchemeColor({ "@_val": "lt1" }, map),
    ).toBe("#FFFFFF");
    expect(
      resolveSmartArtSchemeColor({ "@_val": "accent2" }, map),
    ).toBe("#ED7D31");
  });
});

// ---------------------------------------------------------------------------
// collectLocalTextValues
// ---------------------------------------------------------------------------
describe("collectLocalTextValues", () => {
  it("should handle null/undefined input", () => {
    const output: string[] = [];
    collectLocalTextValues(null, "t", output);
    collectLocalTextValues(undefined, "t", output);
    expect(output).toEqual([]);
  });

  it("should collect text values from direct child with matching local name", () => {
    const output: string[] = [];
    collectLocalTextValues({ "a:t": "Hello" }, "t", output);
    expect(output).toEqual(["Hello"]);
  });

  it("should collect text values from nested structure", () => {
    const output: string[] = [];
    const node = {
      "a:p": {
        "a:r": {
          "a:t": "World",
        },
      },
    };
    collectLocalTextValues(node, "t", output);
    expect(output).toEqual(["World"]);
  });

  it("should collect multiple text values", () => {
    const output: string[] = [];
    const node = {
      "a:p": [
        { "a:r": { "a:t": "Hello" } },
        { "a:r": { "a:t": "World" } },
      ],
    };
    collectLocalTextValues(node, "t", output);
    expect(output).toEqual(["Hello", "World"]);
  });

  it("should skip empty/whitespace-only text values", () => {
    const output: string[] = [];
    collectLocalTextValues({ "a:t": "   " }, "t", output);
    expect(output).toEqual([]);
  });

  it("should handle numeric text values", () => {
    const output: string[] = [];
    collectLocalTextValues({ "a:t": 42 }, "t", output);
    expect(output).toEqual(["42"]);
  });

  it("should handle arrays at any level", () => {
    const output: string[] = [];
    const node = [
      { "ns:t": "A" },
      { "ns:t": "B" },
    ];
    collectLocalTextValues(node, "t", output);
    expect(output).toEqual(["A", "B"]);
  });

  it("should ignore non-matching local names", () => {
    const output: string[] = [];
    collectLocalTextValues({ "a:r": "NotText" }, "t", output);
    expect(output).toEqual([]);
  });
});
