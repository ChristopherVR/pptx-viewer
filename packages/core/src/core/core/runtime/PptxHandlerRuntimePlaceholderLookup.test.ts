import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Extracted logic from PptxHandlerRuntimePlaceholderLookup and
// PptxHandlerRuntimeElementParsing (protected methods)
// ---------------------------------------------------------------------------

interface PlaceholderInfo {
  idx?: string;
  type?: string;
  sz?: string;
}

interface XmlObject {
  [key: string]: unknown;
}

/**
 * Extracted from extractPlaceholderInfo
 */
function extractPlaceholderInfo(
  node: XmlObject | undefined,
): PlaceholderInfo | null {
  if (!node) return null;
  const placeholderNode = node["p:ph"] as XmlObject | undefined;
  if (!placeholderNode) return null;

  const idx = placeholderNode["@_idx"];
  const type = placeholderNode["@_type"];
  const sz = placeholderNode["@_sz"];

  return {
    idx: idx !== undefined ? String(idx) : undefined,
    type: type !== undefined ? String(type).toLowerCase() : undefined,
    sz: sz !== undefined ? String(sz).toLowerCase() : undefined,
  };
}

/**
 * Extracted from placeholderMatches
 */
function placeholderMatches(
  source: PlaceholderInfo | null,
  target: PlaceholderInfo | null,
): boolean {
  if (!source && !target) return true;
  if (!target) return false;
  if (!source) return true;

  if (source.idx !== undefined && target.idx !== undefined) {
    if (source.idx !== target.idx) return false;
    if (source.type && target.type && source.type !== target.type)
      return false;
    return true;
  }

  if (source.idx !== undefined && target.idx === undefined) {
    const singletonTypes = new Set([
      "title",
      "ctrtitle",
      "subtitle",
      "dt",
      "ftr",
      "sldnum",
    ]);
    if (source.type && singletonTypes.has(source.type)) {
      return target.type === source.type;
    }
    return false;
  }

  if (source.type && target.type && source.type !== target.type) return false;
  if (source.type && !target.type) return false;

  return true;
}

/**
 * Extracted from mergeXmlObjects
 */
function mergeXmlObjects(
  base: XmlObject | undefined,
  override: XmlObject | undefined,
): XmlObject | undefined {
  if (!base && !override) return undefined;
  if (!base) return override ? { ...override } : undefined;
  if (!override) return { ...base };

  const merged: XmlObject = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = merged[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      merged[key] = mergeXmlObjects(
        existing as XmlObject,
        value as XmlObject,
      );
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

/**
 * Extracted from readFlipState
 */
function parseBooleanAttr(value: unknown): boolean {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true";
}

function readFlipState(xfrm: XmlObject | undefined): {
  flipHorizontal: boolean;
  flipVertical: boolean;
} {
  if (!xfrm) {
    return { flipHorizontal: false, flipVertical: false };
  }
  return {
    flipHorizontal: parseBooleanAttr(xfrm["@_flipH"]),
    flipVertical: parseBooleanAttr(xfrm["@_flipV"]),
  };
}

/**
 * Extracted from buildPlaceholderDefaultsKey
 */
function buildPlaceholderDefaultsKey(phInfo: PlaceholderInfo): string {
  if (phInfo.idx !== undefined) {
    return phInfo.type ? `${phInfo.type}_${phInfo.idx}` : `_${phInfo.idx}`;
  }
  return phInfo.type ?? "body";
}

// ---------------------------------------------------------------------------
// Tests: extractPlaceholderInfo
// ---------------------------------------------------------------------------
describe("extractPlaceholderInfo", () => {
  it("should return null for undefined node", () => {
    expect(extractPlaceholderInfo(undefined)).toBeNull();
  });

  it("should return null when no p:ph node exists", () => {
    expect(extractPlaceholderInfo({ "p:cNvPr": {} })).toBeNull();
  });

  it("should extract type from p:ph", () => {
    const result = extractPlaceholderInfo({
      "p:ph": { "@_type": "title" },
    });
    expect(result).toEqual({ idx: undefined, type: "title", sz: undefined });
  });

  it("should extract idx from p:ph", () => {
    const result = extractPlaceholderInfo({
      "p:ph": { "@_idx": "1" },
    });
    expect(result).toEqual({ idx: "1", type: undefined, sz: undefined });
  });

  it("should extract all fields from p:ph", () => {
    const result = extractPlaceholderInfo({
      "p:ph": { "@_type": "body", "@_idx": "2", "@_sz": "half" },
    });
    expect(result).toEqual({ idx: "2", type: "body", sz: "half" });
  });

  it("should lowercase type", () => {
    const result = extractPlaceholderInfo({
      "p:ph": { "@_type": "CtrTitle" },
    });
    expect(result!.type).toBe("ctrtitle");
  });

  it("should lowercase sz", () => {
    const result = extractPlaceholderInfo({
      "p:ph": { "@_sz": "Quarter" },
    });
    expect(result!.sz).toBe("quarter");
  });

  it("should convert numeric idx to string", () => {
    const result = extractPlaceholderInfo({
      "p:ph": { "@_idx": 5 },
    });
    expect(result!.idx).toBe("5");
  });
});

// ---------------------------------------------------------------------------
// Tests: placeholderMatches
// ---------------------------------------------------------------------------
describe("placeholderMatches", () => {
  it("should return true when both are null", () => {
    expect(placeholderMatches(null, null)).toBe(true);
  });

  it("should return false when target is null but source is not", () => {
    expect(placeholderMatches({ type: "title" }, null)).toBe(false);
  });

  it("should return true when source is null", () => {
    expect(placeholderMatches(null, { type: "title" })).toBe(true);
  });

  it("should match by idx when both have idx", () => {
    expect(
      placeholderMatches({ idx: "1", type: "body" }, { idx: "1", type: "body" }),
    ).toBe(true);
  });

  it("should not match when idx differs", () => {
    expect(
      placeholderMatches({ idx: "1", type: "body" }, { idx: "2", type: "body" }),
    ).toBe(false);
  });

  it("should not match when idx matches but type differs", () => {
    expect(
      placeholderMatches({ idx: "1", type: "body" }, { idx: "1", type: "title" }),
    ).toBe(false);
  });

  it("should match idx even when target has no type", () => {
    expect(
      placeholderMatches({ idx: "1", type: "body" }, { idx: "1" }),
    ).toBe(true);
  });

  it("should match singleton types when source has idx but target does not", () => {
    expect(
      placeholderMatches({ idx: "0", type: "title" }, { type: "title" }),
    ).toBe(true);
  });

  it("should not match non-singleton types when source has idx but target does not", () => {
    expect(
      placeholderMatches({ idx: "1", type: "body" }, { type: "body" }),
    ).toBe(false);
  });

  it("should match by type when neither has idx", () => {
    expect(
      placeholderMatches({ type: "title" }, { type: "title" }),
    ).toBe(true);
  });

  it("should not match when types differ without idx", () => {
    expect(
      placeholderMatches({ type: "title" }, { type: "body" }),
    ).toBe(false);
  });

  it("should not match when source has type but target does not", () => {
    expect(
      placeholderMatches({ type: "title" }, {}),
    ).toBe(false);
  });

  it("should match ctrtitle as singleton", () => {
    expect(
      placeholderMatches({ idx: "0", type: "ctrtitle" }, { type: "ctrtitle" }),
    ).toBe(true);
  });

  it("should match dt as singleton", () => {
    expect(
      placeholderMatches({ idx: "0", type: "dt" }, { type: "dt" }),
    ).toBe(true);
  });

  it("should match ftr as singleton", () => {
    expect(
      placeholderMatches({ idx: "0", type: "ftr" }, { type: "ftr" }),
    ).toBe(true);
  });

  it("should match sldnum as singleton", () => {
    expect(
      placeholderMatches({ idx: "0", type: "sldnum" }, { type: "sldnum" }),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: mergeXmlObjects
// ---------------------------------------------------------------------------
describe("mergeXmlObjects", () => {
  it("should return undefined when both are undefined", () => {
    expect(mergeXmlObjects(undefined, undefined)).toBeUndefined();
  });

  it("should return copy of override when base is undefined", () => {
    const override = { a: 1 };
    const result = mergeXmlObjects(undefined, override);
    expect(result).toEqual({ a: 1 });
    expect(result).not.toBe(override);
  });

  it("should return copy of base when override is undefined", () => {
    const base = { a: 1 };
    const result = mergeXmlObjects(base, undefined);
    expect(result).toEqual({ a: 1 });
    expect(result).not.toBe(base);
  });

  it("should merge flat objects", () => {
    const result = mergeXmlObjects({ a: 1, b: 2 }, { b: 3, c: 4 });
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it("should deep merge nested objects", () => {
    const base = { nested: { a: 1, b: 2 } };
    const override = { nested: { b: 3, c: 4 } };
    const result = mergeXmlObjects(base, override);
    expect(result).toEqual({ nested: { a: 1, b: 3, c: 4 } });
  });

  it("should not merge arrays (override wins)", () => {
    const base = { items: [1, 2, 3] };
    const override = { items: [4, 5] };
    const result = mergeXmlObjects(base, override);
    expect(result).toEqual({ items: [4, 5] });
  });

  it("should override scalar with object", () => {
    const result = mergeXmlObjects({ a: "string" }, { a: { nested: true } });
    expect(result).toEqual({ a: { nested: true } });
  });

  it("should override object with scalar", () => {
    const result = mergeXmlObjects({ a: { nested: true } }, { a: "string" });
    expect(result).toEqual({ a: "string" });
  });

  it("should handle deeply nested merges", () => {
    const base = { l1: { l2: { l3: { a: 1 } } } };
    const override = { l1: { l2: { l3: { b: 2 } } } };
    const result = mergeXmlObjects(base, override);
    expect(result).toEqual({ l1: { l2: { l3: { a: 1, b: 2 } } } });
  });
});

// ---------------------------------------------------------------------------
// Tests: readFlipState
// ---------------------------------------------------------------------------
describe("readFlipState", () => {
  it("should return both false for undefined xfrm", () => {
    expect(readFlipState(undefined)).toEqual({
      flipHorizontal: false,
      flipVertical: false,
    });
  });

  it("should return both false when no flip attrs", () => {
    expect(readFlipState({})).toEqual({
      flipHorizontal: false,
      flipVertical: false,
    });
  });

  it("should detect flipH = 1", () => {
    expect(readFlipState({ "@_flipH": "1" })).toEqual({
      flipHorizontal: true,
      flipVertical: false,
    });
  });

  it("should detect flipV = 1", () => {
    expect(readFlipState({ "@_flipV": "1" })).toEqual({
      flipHorizontal: false,
      flipVertical: true,
    });
  });

  it("should detect both flips", () => {
    expect(readFlipState({ "@_flipH": "1", "@_flipV": "1" })).toEqual({
      flipHorizontal: true,
      flipVertical: true,
    });
  });

  it("should handle 'true' string", () => {
    expect(readFlipState({ "@_flipH": "true" })).toEqual({
      flipHorizontal: true,
      flipVertical: false,
    });
  });

  it("should handle boolean true", () => {
    expect(readFlipState({ "@_flipH": true })).toEqual({
      flipHorizontal: true,
      flipVertical: false,
    });
  });

  it("should treat 0 as false", () => {
    expect(readFlipState({ "@_flipH": "0", "@_flipV": "0" })).toEqual({
      flipHorizontal: false,
      flipVertical: false,
    });
  });

  it("should treat 'false' as false", () => {
    expect(readFlipState({ "@_flipH": "false" })).toEqual({
      flipHorizontal: false,
      flipVertical: false,
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: buildPlaceholderDefaultsKey
// ---------------------------------------------------------------------------
describe("buildPlaceholderDefaultsKey", () => {
  it("should return type_idx when both are present", () => {
    expect(buildPlaceholderDefaultsKey({ type: "body", idx: "1" })).toBe("body_1");
  });

  it("should return _idx when only idx is present", () => {
    expect(buildPlaceholderDefaultsKey({ idx: "3" })).toBe("_3");
  });

  it("should return type when only type is present", () => {
    expect(buildPlaceholderDefaultsKey({ type: "title" })).toBe("title");
  });

  it("should return 'body' when neither type nor idx is present", () => {
    expect(buildPlaceholderDefaultsKey({})).toBe("body");
  });

  it("should handle ctrtitle type", () => {
    expect(buildPlaceholderDefaultsKey({ type: "ctrtitle" })).toBe("ctrtitle");
  });

  it("should use idx key format for type with idx 0", () => {
    expect(buildPlaceholderDefaultsKey({ type: "body", idx: "0" })).toBe("body_0");
  });
});

// ---------------------------------------------------------------------------
// Tests: parseBooleanAttr (used internally by readFlipState)
// ---------------------------------------------------------------------------
describe("parseBooleanAttr", () => {
  it("should return true for '1'", () => {
    expect(parseBooleanAttr("1")).toBe(true);
  });

  it("should return true for 'true'", () => {
    expect(parseBooleanAttr("true")).toBe(true);
  });

  it("should return true for 'TRUE'", () => {
    expect(parseBooleanAttr("TRUE")).toBe(true);
  });

  it("should return true for 'True'", () => {
    expect(parseBooleanAttr("True")).toBe(true);
  });

  it("should return false for '0'", () => {
    expect(parseBooleanAttr("0")).toBe(false);
  });

  it("should return false for 'false'", () => {
    expect(parseBooleanAttr("false")).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(parseBooleanAttr(undefined)).toBe(false);
  });

  it("should return false for null", () => {
    expect(parseBooleanAttr(null)).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(parseBooleanAttr("")).toBe(false);
  });

  it("should handle boolean true", () => {
    expect(parseBooleanAttr(true)).toBe(true);
  });

  it("should handle boolean false", () => {
    expect(parseBooleanAttr(false)).toBe(false);
  });
});
