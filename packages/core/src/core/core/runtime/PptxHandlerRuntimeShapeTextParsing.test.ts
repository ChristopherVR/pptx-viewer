import { describe, it, expect } from "vitest";
import type { TextStyle } from "../../types";

// Since resolveShapeParagraphStyle is a protected method on a deeply chained
// mixin with many dependencies, we extract and test the self-contained
// paragraph property parsing logic that it uses.

const EMU_PER_PX = 9525;

// --- Extracted: alignment map lookup ---
function resolveAlignmentFromAttr(
  algn: string | undefined,
): TextStyle["align"] | undefined {
  if (!algn) return undefined;
  const alignMap: Record<string, TextStyle["align"]> = {
    l: "left",
    ctr: "center",
    r: "right",
    just: "justify",
    justify: "justify",
    justLow: "justLow",
    dist: "dist",
    thaiDist: "thaiDist",
  };
  return alignMap[algn] || "left";
}

// --- Extracted: paragraph margin parsing ---
function parseParagraphMarginLeft(
  marL: string | undefined,
): number | undefined {
  if (marL === undefined) return undefined;
  const val = Number.parseInt(String(marL), 10);
  if (Number.isFinite(val)) {
    return val / EMU_PER_PX;
  }
  return undefined;
}

function parseParagraphIndent(
  indent: string | undefined,
): number | undefined {
  if (indent === undefined) return undefined;
  const val = Number.parseInt(String(indent), 10);
  if (Number.isFinite(val)) {
    return val / EMU_PER_PX;
  }
  return undefined;
}

// --- Extracted: tab stop parsing ---
function parseTabStops(
  tabLst: Record<string, unknown> | undefined,
): Array<{ position: number; align: string; leader?: string }> | undefined {
  if (!tabLst) return undefined;
  const tabNodes = ensureArray(tabLst["a:tab"]) as Record<string, unknown>[];
  if (tabNodes.length === 0) return undefined;

  return tabNodes
    .filter((t) => t?.["@_pos"] !== undefined)
    .map((t) => {
      const posRaw = Number.parseInt(String(t["@_pos"]), 10);
      const position = Number.isFinite(posRaw) ? posRaw / EMU_PER_PX : 0;
      const algn = String(t["@_algn"] || "l").trim();
      const align =
        algn === "ctr" || algn === "r" || algn === "dec"
          ? algn
          : ("l" as const);
      const leaderVal = String(t["@_leader"] || "").trim();
      const leader =
        leaderVal === "dot" || leaderVal === "hyphen" || leaderVal === "underscore"
          ? leaderVal
          : undefined;
      return { position, align, ...(leader ? { leader } : {}) };
    });
}

function ensureArray(val: unknown): unknown[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

// --- Extracted: additional paragraph properties parsing ---
function parseDefaultTabSize(
  defTabSz: string | undefined,
): number | undefined {
  if (defTabSz === undefined) return undefined;
  const val = Number.parseInt(String(defTabSz), 10);
  if (Number.isFinite(val)) {
    return val / EMU_PER_PX;
  }
  return undefined;
}

// --- Extracted: paragraph level key computation ---
function computeLevelKey(lvl: string | undefined): string {
  const level = Number.parseInt(String(lvl || "0"), 10);
  const clampedLevel = Number.isFinite(level) ? Math.min(Math.max(level + 1, 1), 9) : 1;
  return `a:lvl${clampedLevel}pPr`;
}

// ---------------------------------------------------------------------------
// resolveAlignmentFromAttr
// ---------------------------------------------------------------------------
describe("resolveAlignmentFromAttr", () => {
  it("should return undefined for undefined input", () => {
    expect(resolveAlignmentFromAttr(undefined)).toBeUndefined();
  });

  it('should resolve "l" to "left"', () => {
    expect(resolveAlignmentFromAttr("l")).toBe("left");
  });

  it('should resolve "ctr" to "center"', () => {
    expect(resolveAlignmentFromAttr("ctr")).toBe("center");
  });

  it('should resolve "r" to "right"', () => {
    expect(resolveAlignmentFromAttr("r")).toBe("right");
  });

  it('should resolve "just" to "justify"', () => {
    expect(resolveAlignmentFromAttr("just")).toBe("justify");
  });

  it('should resolve "justify" to "justify"', () => {
    expect(resolveAlignmentFromAttr("justify")).toBe("justify");
  });

  it('should resolve "justLow" to "justLow"', () => {
    expect(resolveAlignmentFromAttr("justLow")).toBe("justLow");
  });

  it('should resolve "dist" to "dist"', () => {
    expect(resolveAlignmentFromAttr("dist")).toBe("dist");
  });

  it('should resolve "thaiDist" to "thaiDist"', () => {
    expect(resolveAlignmentFromAttr("thaiDist")).toBe("thaiDist");
  });

  it('should default to "left" for unknown values', () => {
    expect(resolveAlignmentFromAttr("unknown")).toBe("left");
  });
});

// ---------------------------------------------------------------------------
// parseParagraphMarginLeft
// ---------------------------------------------------------------------------
describe("parseParagraphMarginLeft", () => {
  it("should return undefined for undefined input", () => {
    expect(parseParagraphMarginLeft(undefined)).toBeUndefined();
  });

  it("should parse EMU value to pixels", () => {
    const result = parseParagraphMarginLeft("457200");
    expect(result).toBeCloseTo(457200 / EMU_PER_PX, 2);
  });

  it("should parse zero margin", () => {
    expect(parseParagraphMarginLeft("0")).toBe(0);
  });

  it("should return undefined for non-numeric value", () => {
    expect(parseParagraphMarginLeft("abc")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseParagraphIndent
// ---------------------------------------------------------------------------
describe("parseParagraphIndent", () => {
  it("should return undefined for undefined input", () => {
    expect(parseParagraphIndent(undefined)).toBeUndefined();
  });

  it("should parse positive indent (EMU to pixels)", () => {
    const result = parseParagraphIndent("228600");
    expect(result).toBeCloseTo(228600 / EMU_PER_PX, 2);
  });

  it("should parse negative indent (hanging indent)", () => {
    const result = parseParagraphIndent("-228600");
    expect(result).toBeCloseTo(-228600 / EMU_PER_PX, 2);
  });

  it("should parse zero indent", () => {
    expect(parseParagraphIndent("0")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// parseTabStops
// ---------------------------------------------------------------------------
describe("parseTabStops", () => {
  it("should return undefined for undefined input", () => {
    expect(parseTabStops(undefined)).toBeUndefined();
  });

  it("should return undefined when a:tab is missing", () => {
    expect(parseTabStops({})).toBeUndefined();
  });

  it("should parse a single tab stop", () => {
    const result = parseTabStops({
      "a:tab": { "@_pos": "914400", "@_algn": "l" },
    });
    expect(result).toHaveLength(1);
    expect(result![0].position).toBeCloseTo(914400 / EMU_PER_PX, 2);
    expect(result![0].align).toBe("l");
  });

  it("should parse multiple tab stops", () => {
    const result = parseTabStops({
      "a:tab": [
        { "@_pos": "914400", "@_algn": "l" },
        { "@_pos": "1828800", "@_algn": "ctr" },
        { "@_pos": "2743200", "@_algn": "r" },
      ],
    });
    expect(result).toHaveLength(3);
    expect(result![1].align).toBe("ctr");
    expect(result![2].align).toBe("r");
  });

  it("should default align to 'l' for unknown alignment", () => {
    const result = parseTabStops({
      "a:tab": { "@_pos": "914400", "@_algn": "unknown" },
    });
    expect(result![0].align).toBe("l");
  });

  it("should default align to 'l' when missing", () => {
    const result = parseTabStops({
      "a:tab": { "@_pos": "914400" },
    });
    expect(result![0].align).toBe("l");
  });

  it("should parse dot leader", () => {
    const result = parseTabStops({
      "a:tab": { "@_pos": "914400", "@_algn": "r", "@_leader": "dot" },
    });
    expect(result![0].leader).toBe("dot");
  });

  it("should parse hyphen leader", () => {
    const result = parseTabStops({
      "a:tab": { "@_pos": "914400", "@_algn": "l", "@_leader": "hyphen" },
    });
    expect(result![0].leader).toBe("hyphen");
  });

  it("should parse underscore leader", () => {
    const result = parseTabStops({
      "a:tab": { "@_pos": "914400", "@_algn": "l", "@_leader": "underscore" },
    });
    expect(result![0].leader).toBe("underscore");
  });

  it("should ignore unknown leader values", () => {
    const result = parseTabStops({
      "a:tab": { "@_pos": "914400", "@_algn": "l", "@_leader": "none" },
    });
    expect(result![0]).not.toHaveProperty("leader");
  });

  it("should filter out tab stops without position", () => {
    const result = parseTabStops({
      "a:tab": [
        { "@_algn": "l" },
        { "@_pos": "914400", "@_algn": "l" },
      ],
    });
    expect(result).toHaveLength(1);
  });

  it("should handle decimal alignment", () => {
    const result = parseTabStops({
      "a:tab": { "@_pos": "914400", "@_algn": "dec" },
    });
    expect(result![0].align).toBe("dec");
  });
});

// ---------------------------------------------------------------------------
// parseDefaultTabSize
// ---------------------------------------------------------------------------
describe("parseDefaultTabSize", () => {
  it("should return undefined for undefined input", () => {
    expect(parseDefaultTabSize(undefined)).toBeUndefined();
  });

  it("should parse EMU value to pixels", () => {
    const result = parseDefaultTabSize("914400");
    expect(result).toBeCloseTo(914400 / EMU_PER_PX, 2);
  });

  it("should return undefined for non-numeric value", () => {
    expect(parseDefaultTabSize("abc")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// computeLevelKey
// ---------------------------------------------------------------------------
describe("computeLevelKey", () => {
  it("should default to level 1 for undefined input", () => {
    expect(computeLevelKey(undefined)).toBe("a:lvl1pPr");
  });

  it("should default to level 1 for '0'", () => {
    expect(computeLevelKey("0")).toBe("a:lvl1pPr");
  });

  it("should compute level 2 for '1'", () => {
    expect(computeLevelKey("1")).toBe("a:lvl2pPr");
  });

  it("should compute level 9 for '8'", () => {
    expect(computeLevelKey("8")).toBe("a:lvl9pPr");
  });

  it("should clamp to level 9 for values above 8", () => {
    expect(computeLevelKey("20")).toBe("a:lvl9pPr");
  });

  it("should clamp to level 1 for negative values", () => {
    expect(computeLevelKey("-5")).toBe("a:lvl1pPr");
  });

  it("should default to level 1 for non-numeric input", () => {
    expect(computeLevelKey("abc")).toBe("a:lvl1pPr");
  });
});
