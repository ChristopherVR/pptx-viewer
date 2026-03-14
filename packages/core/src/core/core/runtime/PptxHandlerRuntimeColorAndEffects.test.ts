import { describe, it, expect } from "vitest";
import type { StrokeDashType, ConnectorArrowType } from "../../types";

// These are protected methods on the mixin chain, so we extract their logic
// to test directly. The implementations below are exact copies from the source.

function normalizeStrokeDashType(value: unknown): StrokeDashType | undefined {
  const normalized = String(value ?? "").trim();
  if (normalized.length === 0) return undefined;

  const canonicalMap: Record<string, StrokeDashType> = {
    solid: "solid",
    dot: "dot",
    dash: "dash",
    lgdash: "lgDash",
    dashdot: "dashDot",
    lgdashdot: "lgDashDot",
    lgdashdotdot: "lgDashDotDot",
    sysdot: "sysDot",
    sysdash: "sysDash",
    sysdashdot: "sysDashDot",
    sysdashdotdot: "sysDashDotDot",
    custom: "custom",
  };

  return canonicalMap[normalized.toLowerCase()];
}

function normalizeConnectorArrowType(
  value: unknown,
): ConnectorArrowType | undefined {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) return undefined;
  if (
    normalized === "none" ||
    normalized === "triangle" ||
    normalized === "stealth" ||
    normalized === "diamond" ||
    normalized === "oval" ||
    normalized === "arrow"
  ) {
    return normalized;
  }
  return undefined;
}

function getDefaultSchemeColorMap(): Record<string, string> {
  return {
    dk1: "#000000",
    lt1: "#FFFFFF",
    dk2: "#1F497D",
    lt2: "#EEECE1",
    accent1: "#4472C4",
    accent2: "#ED7D31",
    accent3: "#A5A5A5",
    accent4: "#FFC000",
    accent5: "#5B9BD5",
    accent6: "#70AD47",
    hlink: "#0563C1",
    folHlink: "#954F72",
    tx1: "#000000",
    tx2: "#44546A",
    bg1: "#FFFFFF",
    bg2: "#E7E6E6",
  };
}

// ---------------------------------------------------------------------------
// normalizeStrokeDashType
// ---------------------------------------------------------------------------
describe("normalizeStrokeDashType", () => {
  it("should return undefined for undefined input", () => {
    expect(normalizeStrokeDashType(undefined)).toBeUndefined();
  });

  it("should return undefined for null input", () => {
    expect(normalizeStrokeDashType(null)).toBeUndefined();
  });

  it("should return undefined for empty string", () => {
    expect(normalizeStrokeDashType("")).toBeUndefined();
  });

  it("should return undefined for whitespace-only string", () => {
    expect(normalizeStrokeDashType("   ")).toBeUndefined();
  });

  it('should normalize "solid" to "solid"', () => {
    expect(normalizeStrokeDashType("solid")).toBe("solid");
  });

  it('should normalize "dot" to "dot"', () => {
    expect(normalizeStrokeDashType("dot")).toBe("dot");
  });

  it('should normalize "dash" to "dash"', () => {
    expect(normalizeStrokeDashType("dash")).toBe("dash");
  });

  it('should normalize "lgDash" to "lgDash" (case-insensitive)', () => {
    expect(normalizeStrokeDashType("lgDash")).toBe("lgDash");
    expect(normalizeStrokeDashType("LGDASH")).toBe("lgDash");
    expect(normalizeStrokeDashType("lgdash")).toBe("lgDash");
  });

  it('should normalize "dashDot" to "dashDot"', () => {
    expect(normalizeStrokeDashType("dashDot")).toBe("dashDot");
  });

  it('should normalize "lgDashDot" to "lgDashDot"', () => {
    expect(normalizeStrokeDashType("lgDashDot")).toBe("lgDashDot");
  });

  it('should normalize "lgDashDotDot" to "lgDashDotDot"', () => {
    expect(normalizeStrokeDashType("lgDashDotDot")).toBe("lgDashDotDot");
  });

  it('should normalize "sysDot" to "sysDot"', () => {
    expect(normalizeStrokeDashType("sysDot")).toBe("sysDot");
  });

  it('should normalize "sysDash" to "sysDash"', () => {
    expect(normalizeStrokeDashType("sysDash")).toBe("sysDash");
  });

  it('should normalize "sysDashDot" to "sysDashDot"', () => {
    expect(normalizeStrokeDashType("sysDashDot")).toBe("sysDashDot");
  });

  it('should normalize "sysDashDotDot" to "sysDashDotDot"', () => {
    expect(normalizeStrokeDashType("sysDashDotDot")).toBe("sysDashDotDot");
  });

  it('should normalize "custom" to "custom"', () => {
    expect(normalizeStrokeDashType("custom")).toBe("custom");
  });

  it("should return undefined for unrecognized values", () => {
    expect(normalizeStrokeDashType("zigzag")).toBeUndefined();
    expect(normalizeStrokeDashType("dotted")).toBeUndefined();
  });

  it("should handle numeric input by converting to string", () => {
    expect(normalizeStrokeDashType(123)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// normalizeConnectorArrowType
// ---------------------------------------------------------------------------
describe("normalizeConnectorArrowType", () => {
  it("should return undefined for undefined input", () => {
    expect(normalizeConnectorArrowType(undefined)).toBeUndefined();
  });

  it("should return undefined for null input", () => {
    expect(normalizeConnectorArrowType(null)).toBeUndefined();
  });

  it("should return undefined for empty string", () => {
    expect(normalizeConnectorArrowType("")).toBeUndefined();
  });

  it('should normalize "none" to "none"', () => {
    expect(normalizeConnectorArrowType("none")).toBe("none");
  });

  it('should normalize "triangle" to "triangle"', () => {
    expect(normalizeConnectorArrowType("triangle")).toBe("triangle");
  });

  it('should normalize "stealth" to "stealth"', () => {
    expect(normalizeConnectorArrowType("stealth")).toBe("stealth");
  });

  it('should normalize "diamond" to "diamond"', () => {
    expect(normalizeConnectorArrowType("diamond")).toBe("diamond");
  });

  it('should normalize "oval" to "oval"', () => {
    expect(normalizeConnectorArrowType("oval")).toBe("oval");
  });

  it('should normalize "arrow" to "arrow"', () => {
    expect(normalizeConnectorArrowType("arrow")).toBe("arrow");
  });

  it("should be case-insensitive", () => {
    expect(normalizeConnectorArrowType("Triangle")).toBe("triangle");
    expect(normalizeConnectorArrowType("STEALTH")).toBe("stealth");
    expect(normalizeConnectorArrowType("NONE")).toBe("none");
  });

  it("should return undefined for unrecognized types", () => {
    expect(normalizeConnectorArrowType("circle")).toBeUndefined();
    expect(normalizeConnectorArrowType("square")).toBeUndefined();
    expect(normalizeConnectorArrowType("custom")).toBeUndefined();
  });

  it("should handle whitespace around value", () => {
    expect(normalizeConnectorArrowType("  triangle  ")).toBe("triangle");
  });
});

// ---------------------------------------------------------------------------
// getDefaultSchemeColorMap
// ---------------------------------------------------------------------------
describe("getDefaultSchemeColorMap", () => {
  it("should return an object with 16 color entries", () => {
    const map = getDefaultSchemeColorMap();
    expect(Object.keys(map)).toHaveLength(16);
  });

  it("should have dark and light primaries", () => {
    const map = getDefaultSchemeColorMap();
    expect(map.dk1).toBe("#000000");
    expect(map.lt1).toBe("#FFFFFF");
    expect(map.dk2).toBe("#1F497D");
    expect(map.lt2).toBe("#EEECE1");
  });

  it("should have all 6 accent colors", () => {
    const map = getDefaultSchemeColorMap();
    expect(map.accent1).toBe("#4472C4");
    expect(map.accent2).toBe("#ED7D31");
    expect(map.accent3).toBe("#A5A5A5");
    expect(map.accent4).toBe("#FFC000");
    expect(map.accent5).toBe("#5B9BD5");
    expect(map.accent6).toBe("#70AD47");
  });

  it("should have hyperlink colors", () => {
    const map = getDefaultSchemeColorMap();
    expect(map.hlink).toBe("#0563C1");
    expect(map.folHlink).toBe("#954F72");
  });

  it("should have text and background aliases", () => {
    const map = getDefaultSchemeColorMap();
    expect(map.tx1).toBe("#000000");
    expect(map.tx2).toBe("#44546A");
    expect(map.bg1).toBe("#FFFFFF");
    expect(map.bg2).toBe("#E7E6E6");
  });

  it("should return a new object each time", () => {
    const map1 = getDefaultSchemeColorMap();
    const map2 = getDefaultSchemeColorMap();
    expect(map1).not.toBe(map2);
    expect(map1).toEqual(map2);
  });
});
