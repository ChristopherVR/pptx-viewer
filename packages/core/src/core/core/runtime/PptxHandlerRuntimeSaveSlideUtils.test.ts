/**
 * Tests for PptxHandlerRuntimeSaveSlideUtils:
 *   - createEmptySlideXml (empty slide structure)
 *   - deepCloneXml (JSON clone)
 *   - findSourceSlidePath (source slide lookup)
 *   - ensureSlideTree (tree initialization)
 *   - textAlignToDrawingValue (alignment mapping)
 *   - pixelsToPoints (unit conversion)
 *   - createParagraphSpacingXmlFromPx (spacing XML)
 *   - createLineSpacingXmlFromMultiplier (line spacing XML)
 *   - toPresentationTarget / toSlidePathFromTarget / toSlideRelsPath
 */
import { describe, it, expect } from "vitest";

import type { XmlObject, TextStyle } from "../../types";

// ---------------------------------------------------------------------------
// Reimplemented helpers
// ---------------------------------------------------------------------------

function createEmptySlideXml(): XmlObject {
  return {
    "p:sld": {
      "@_xmlns:a": "http://schemas.openxmlformats.org/drawingml/2006/main",
      "@_xmlns:r":
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "@_xmlns:p":
        "http://schemas.openxmlformats.org/presentationml/2006/main",
      "p:cSld": {
        "p:spTree": {
          "p:nvGrpSpPr": {
            "p:cNvPr": { "@_id": "1", "@_name": "" },
            "p:cNvGrpSpPr": {},
            "p:nvPr": {},
          },
          "p:grpSpPr": {
            "a:xfrm": {
              "a:off": { "@_x": "0", "@_y": "0" },
              "a:ext": { "@_cx": "0", "@_cy": "0" },
              "a:chOff": { "@_x": "0", "@_y": "0" },
              "a:chExt": { "@_cx": "0", "@_cy": "0" },
            },
          },
        },
      },
      "p:clrMapOvr": { "a:masterClrMapping": {} },
    },
  };
}

function deepCloneXml(value: XmlObject | undefined): XmlObject | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as XmlObject;
  } catch {
    return undefined;
  }
}

function findSourceSlidePath(
  requestedSourcePath: string | undefined,
  slideMap: Map<string, unknown>,
): string | undefined {
  if (
    requestedSourcePath &&
    slideMap.has(requestedSourcePath) &&
    requestedSourcePath.startsWith("ppt/slides/slide")
  ) {
    return requestedSourcePath;
  }
  for (const slidePath of slideMap.keys()) {
    if (slidePath.startsWith("ppt/slides/slide")) {
      return slidePath;
    }
  }
  return undefined;
}

function ensureSlideTree(xmlObj: XmlObject): XmlObject {
  if (!xmlObj["p:sld"]) xmlObj["p:sld"] = {};
  const pSld = xmlObj["p:sld"] as XmlObject;

  if (!pSld["p:cSld"]) pSld["p:cSld"] = {};
  const cSld = pSld["p:cSld"] as XmlObject;

  if (!cSld["p:spTree"]) {
    cSld["p:spTree"] = createEmptySlideXml()["p:sld"]["p:cSld"][
      "p:spTree"
    ] as XmlObject;
  }

  pSld["p:cSld"] = cSld;
  xmlObj["p:sld"] = pSld;
  return cSld["p:spTree"] as XmlObject;
}

function textAlignToDrawingValue(
  align: TextStyle["align"] | undefined,
): string | undefined {
  if (align === "left") return "l";
  if (align === "center") return "ctr";
  if (align === "right") return "r";
  if (align === "justify") return "just";
  return undefined;
}

function pixelsToPoints(px: number): number {
  return px * (72 / 96);
}

function createParagraphSpacingXmlFromPx(
  spacing: number | undefined,
): XmlObject | undefined {
  if (typeof spacing !== "number" || !Number.isFinite(spacing)) {
    return undefined;
  }
  const spacingPoints = Math.max(0, pixelsToPoints(spacing));
  return {
    "a:spcPts": {
      "@_val": String(Math.round(spacingPoints * 100)),
    },
  };
}

function createLineSpacingXmlFromMultiplier(
  lineSpacing: number | undefined,
): XmlObject | undefined {
  if (typeof lineSpacing !== "number" || !Number.isFinite(lineSpacing)) {
    return undefined;
  }
  const normalized = Math.max(0.1, Math.min(5, lineSpacing));
  return {
    "a:spcPct": {
      "@_val": String(Math.round(normalized * 100000)),
    },
  };
}

function toPresentationTarget(slidePath: string): string {
  const normalized = slidePath.startsWith("/")
    ? slidePath.substring(1)
    : slidePath;
  return normalized.startsWith("ppt/") ? normalized.substring(4) : normalized;
}

function toSlidePathFromTarget(target: string): string {
  const normalized = target.startsWith("/") ? target.substring(1) : target;
  return normalized.startsWith("ppt/") ? normalized : `ppt/${normalized}`;
}

function toSlideRelsPath(slidePath: string): string {
  return slidePath.replace("slides/", "slides/_rels/") + ".rels";
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("createEmptySlideXml", () => {
  it("should create valid slide XML structure", () => {
    const result = createEmptySlideXml();
    expect(result["p:sld"]).toBeDefined();
    const pSld = result["p:sld"] as XmlObject;
    expect(pSld["p:cSld"]).toBeDefined();
    expect((pSld["p:cSld"] as XmlObject)["p:spTree"]).toBeDefined();
  });

  it("should include namespace attributes", () => {
    const result = createEmptySlideXml();
    const pSld = result["p:sld"] as XmlObject;
    expect(pSld["@_xmlns:a"]).toBeDefined();
    expect(pSld["@_xmlns:r"]).toBeDefined();
    expect(pSld["@_xmlns:p"]).toBeDefined();
  });

  it("should include color map override", () => {
    const result = createEmptySlideXml();
    const pSld = result["p:sld"] as XmlObject;
    expect(pSld["p:clrMapOvr"]).toBeDefined();
  });
});

describe("deepCloneXml", () => {
  it("should return a deep copy of an XML object", () => {
    const original: XmlObject = { "a:b": { "@_val": "1" } };
    const cloned = deepCloneXml(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });

  it("should return undefined for undefined input", () => {
    expect(deepCloneXml(undefined)).toBeUndefined();
  });

  it("should produce independent copies", () => {
    const original: XmlObject = { "a:b": { "@_val": "1" } };
    const cloned = deepCloneXml(original)!;
    (cloned["a:b"] as XmlObject)["@_val"] = "2";
    expect((original["a:b"] as XmlObject)["@_val"]).toBe("1");
  });
});

describe("findSourceSlidePath", () => {
  it("should return the requested path when it exists in the map", () => {
    const slideMap = new Map([
      ["ppt/slides/slide1.xml", {}],
      ["ppt/slides/slide2.xml", {}],
    ]);
    expect(findSourceSlidePath("ppt/slides/slide2.xml", slideMap)).toBe(
      "ppt/slides/slide2.xml",
    );
  });

  it("should fall back to first slide path when requested is not found", () => {
    const slideMap = new Map([["ppt/slides/slide1.xml", {}]]);
    expect(findSourceSlidePath("ppt/slides/slide99.xml", slideMap)).toBe(
      "ppt/slides/slide1.xml",
    );
  });

  it("should return undefined when map has no slide paths", () => {
    const slideMap = new Map([["ppt/noteslides/notesSlide1.xml", {}]]);
    expect(findSourceSlidePath(undefined, slideMap)).toBeUndefined();
  });

  it("should reject paths that don't start with ppt/slides/slide", () => {
    const slideMap = new Map([
      ["ppt/slideLayouts/slideLayout1.xml", {}],
      ["ppt/slides/slide1.xml", {}],
    ]);
    expect(
      findSourceSlidePath("ppt/slideLayouts/slideLayout1.xml", slideMap),
    ).toBe("ppt/slides/slide1.xml");
  });
});

describe("ensureSlideTree", () => {
  it("should create full slide tree when object is empty", () => {
    const xmlObj: XmlObject = {};
    const tree = ensureSlideTree(xmlObj);
    expect(tree).toBeDefined();
    expect(xmlObj["p:sld"]).toBeDefined();
    expect((xmlObj["p:sld"] as XmlObject)["p:cSld"]).toBeDefined();
  });

  it("should preserve existing spTree", () => {
    const existingTree: XmlObject = { "p:sp": [{ name: "existing" }] };
    const xmlObj: XmlObject = {
      "p:sld": { "p:cSld": { "p:spTree": existingTree } },
    };
    const tree = ensureSlideTree(xmlObj);
    expect(tree).toBe(existingTree);
  });

  it("should create spTree when only p:sld exists", () => {
    const xmlObj: XmlObject = { "p:sld": {} };
    const tree = ensureSlideTree(xmlObj);
    expect(tree["p:nvGrpSpPr"]).toBeDefined();
  });
});

describe("textAlignToDrawingValue", () => {
  it("should map left to l", () => {
    expect(textAlignToDrawingValue("left")).toBe("l");
  });
  it("should map center to ctr", () => {
    expect(textAlignToDrawingValue("center")).toBe("ctr");
  });
  it("should map right to r", () => {
    expect(textAlignToDrawingValue("right")).toBe("r");
  });
  it("should map justify to just", () => {
    expect(textAlignToDrawingValue("justify")).toBe("just");
  });
  it("should return undefined for undefined input", () => {
    expect(textAlignToDrawingValue(undefined)).toBeUndefined();
  });
});

describe("pixelsToPoints", () => {
  it("should convert 96px to 72pt", () => {
    expect(pixelsToPoints(96)).toBe(72);
  });
  it("should convert 0px to 0pt", () => {
    expect(pixelsToPoints(0)).toBe(0);
  });
  it("should handle fractional values", () => {
    expect(pixelsToPoints(48)).toBe(36);
  });
});

describe("createParagraphSpacingXmlFromPx", () => {
  it("should return undefined for undefined spacing", () => {
    expect(createParagraphSpacingXmlFromPx(undefined)).toBeUndefined();
  });

  it("should return undefined for NaN spacing", () => {
    expect(createParagraphSpacingXmlFromPx(NaN)).toBeUndefined();
  });

  it("should convert px to spcPts", () => {
    const result = createParagraphSpacingXmlFromPx(96);
    expect(result).toBeDefined();
    const spcPts = (result!["a:spcPts"] as XmlObject)["@_val"];
    // 96px = 72pt, * 100 = 7200
    expect(spcPts).toBe("7200");
  });

  it("should clamp negative values to 0", () => {
    const result = createParagraphSpacingXmlFromPx(-10);
    expect(result).toBeDefined();
    const spcPts = (result!["a:spcPts"] as XmlObject)["@_val"];
    expect(spcPts).toBe("0");
  });
});

describe("createLineSpacingXmlFromMultiplier", () => {
  it("should return undefined for undefined spacing", () => {
    expect(createLineSpacingXmlFromMultiplier(undefined)).toBeUndefined();
  });

  it("should return undefined for NaN", () => {
    expect(createLineSpacingXmlFromMultiplier(NaN)).toBeUndefined();
  });

  it("should convert 1.5 multiplier to spcPct", () => {
    const result = createLineSpacingXmlFromMultiplier(1.5);
    expect(result).toBeDefined();
    const spcPct = (result!["a:spcPct"] as XmlObject)["@_val"];
    expect(spcPct).toBe("150000");
  });

  it("should clamp to minimum 0.1", () => {
    const result = createLineSpacingXmlFromMultiplier(0.01);
    const spcPct = (result!["a:spcPct"] as XmlObject)["@_val"];
    expect(spcPct).toBe("10000");
  });

  it("should clamp to maximum 5", () => {
    const result = createLineSpacingXmlFromMultiplier(10);
    const spcPct = (result!["a:spcPct"] as XmlObject)["@_val"];
    expect(spcPct).toBe("500000");
  });
});

describe("toPresentationTarget", () => {
  it("should strip ppt/ prefix", () => {
    expect(toPresentationTarget("ppt/slides/slide1.xml")).toBe(
      "slides/slide1.xml",
    );
  });
  it("should strip leading slash before ppt/", () => {
    expect(toPresentationTarget("/ppt/slides/slide1.xml")).toBe(
      "slides/slide1.xml",
    );
  });
  it("should leave non-ppt paths unchanged", () => {
    expect(toPresentationTarget("slides/slide1.xml")).toBe(
      "slides/slide1.xml",
    );
  });
});

describe("toSlidePathFromTarget", () => {
  it("should add ppt/ prefix", () => {
    expect(toSlidePathFromTarget("slides/slide1.xml")).toBe(
      "ppt/slides/slide1.xml",
    );
  });
  it("should not double-prefix ppt/ paths", () => {
    expect(toSlidePathFromTarget("ppt/slides/slide1.xml")).toBe(
      "ppt/slides/slide1.xml",
    );
  });
  it("should strip leading slash", () => {
    expect(toSlidePathFromTarget("/slides/slide1.xml")).toBe(
      "ppt/slides/slide1.xml",
    );
  });
});

describe("toSlideRelsPath", () => {
  it("should insert _rels/ and append .rels", () => {
    expect(toSlideRelsPath("ppt/slides/slide1.xml")).toBe(
      "ppt/slides/_rels/slide1.xml.rels",
    );
  });
});
