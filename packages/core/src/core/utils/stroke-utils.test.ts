import { describe, it, expect } from "vitest";
import {
  normalizeStrokeDashType,
  getCssBorderDashStyle,
  getSvgStrokeDasharray,
} from "./stroke-utils";

// ---------------------------------------------------------------------------
// normalizeStrokeDashType
// ---------------------------------------------------------------------------

describe("normalizeStrokeDashType", () => {
  it("returns undefined for undefined input", () => {
    expect(normalizeStrokeDashType(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(normalizeStrokeDashType("")).toBeUndefined();
  });

  it("returns undefined for whitespace-only", () => {
    expect(normalizeStrokeDashType("   ")).toBeUndefined();
  });

  it('normalizes "solid" to "solid"', () => {
    expect(normalizeStrokeDashType("solid")).toBe("solid");
  });

  it('normalizes "dot" to "dot"', () => {
    expect(normalizeStrokeDashType("dot")).toBe("dot");
  });

  it('normalizes "dash" to "dash"', () => {
    expect(normalizeStrokeDashType("dash")).toBe("dash");
  });

  it('normalizes "lgDash" (case-insensitive) to "lgDash"', () => {
    expect(normalizeStrokeDashType("lgDash")).toBe("lgDash");
    expect(normalizeStrokeDashType("LGDASH")).toBe("lgDash");
  });

  it('normalizes "dashDot" to "dashDot"', () => {
    expect(normalizeStrokeDashType("dashDot")).toBe("dashDot");
    expect(normalizeStrokeDashType("DASHDOT")).toBe("dashDot");
  });

  it('normalizes "lgDashDot" to "lgDashDot"', () => {
    expect(normalizeStrokeDashType("lgDashDot")).toBe("lgDashDot");
  });

  it('normalizes "lgDashDotDot" to "lgDashDotDot"', () => {
    expect(normalizeStrokeDashType("lgDashDotDot")).toBe("lgDashDotDot");
  });

  it('normalizes system dash types (sysDot, sysDash, etc.)', () => {
    expect(normalizeStrokeDashType("sysDot")).toBe("sysDot");
    expect(normalizeStrokeDashType("sysDash")).toBe("sysDash");
    expect(normalizeStrokeDashType("sysDashDot")).toBe("sysDashDot");
    expect(normalizeStrokeDashType("sysDashDotDot")).toBe("sysDashDotDot");
  });

  it('normalizes "custom" to "custom"', () => {
    expect(normalizeStrokeDashType("custom")).toBe("custom");
  });

  it("returns undefined for unknown dash types", () => {
    expect(normalizeStrokeDashType("zigzag")).toBeUndefined();
    expect(normalizeStrokeDashType("unknown")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getCssBorderDashStyle
// ---------------------------------------------------------------------------

describe("getCssBorderDashStyle", () => {
  it('returns "solid" for undefined', () => {
    expect(getCssBorderDashStyle(undefined)).toBe("solid");
  });

  it('returns "solid" for solid', () => {
    expect(getCssBorderDashStyle("solid")).toBe("solid");
  });

  it('returns "dotted" for dot', () => {
    expect(getCssBorderDashStyle("dot")).toBe("dotted");
  });

  it('returns "dotted" for sysDot', () => {
    expect(getCssBorderDashStyle("sysDot")).toBe("dotted");
  });

  it('returns "dashed" for dash', () => {
    expect(getCssBorderDashStyle("dash")).toBe("dashed");
  });

  it('returns "dashed" for lgDash', () => {
    expect(getCssBorderDashStyle("lgDash")).toBe("dashed");
  });

  it('returns "dashed" for dashDot', () => {
    expect(getCssBorderDashStyle("dashDot")).toBe("dashed");
  });

  it('returns "dashed" for lgDashDotDot', () => {
    expect(getCssBorderDashStyle("lgDashDotDot")).toBe("dashed");
  });
});

// ---------------------------------------------------------------------------
// getSvgStrokeDasharray
// ---------------------------------------------------------------------------

describe("getSvgStrokeDasharray", () => {
  it("returns undefined for undefined dashType", () => {
    expect(getSvgStrokeDasharray(undefined, 2)).toBeUndefined();
  });

  it("returns undefined for solid dashType", () => {
    expect(getSvgStrokeDasharray("solid", 2)).toBeUndefined();
  });

  it("returns correct dasharray for dot with stroke width 1", () => {
    const result = getSvgStrokeDasharray("dot", 1);
    expect(result).toBe("1 2");
  });

  it("returns correct dasharray for dash with stroke width 2", () => {
    const result = getSvgStrokeDasharray("dash", 2);
    expect(result).toBe("8 4");
  });

  it("returns correct dasharray for lgDash", () => {
    const result = getSvgStrokeDasharray("lgDash", 1);
    expect(result).toBe("7 2.5");
  });

  it("returns correct dasharray for dashDot", () => {
    const result = getSvgStrokeDasharray("dashDot", 1);
    expect(result).toBe("4 2 1 2");
  });

  it("returns correct dasharray for lgDashDot", () => {
    const result = getSvgStrokeDasharray("lgDashDot", 1);
    expect(result).toBe("7 2.5 1 2.5");
  });

  it("returns correct dasharray for lgDashDotDot", () => {
    const result = getSvgStrokeDasharray("lgDashDotDot", 1);
    expect(result).toBe("7 2.5 1 2 1 2");
  });

  it("clamps strokeWidth to at least 1", () => {
    const result = getSvgStrokeDasharray("dot", 0);
    expect(result).toBe("1 2"); // stroke=max(0,1)=1
  });

  it("returns correct dasharray for custom without segments", () => {
    const result = getSvgStrokeDasharray("custom", 2);
    expect(result).toBe("6 4"); // stroke*3 stroke*2
  });

  it("builds dasharray from custom segments when provided", () => {
    const segments = [
      { dash: 4000, space: 2000 },
      { dash: 1000, space: 1000 },
    ];
    const result = getSvgStrokeDasharray("custom", 2, segments);
    // (4000/1000)*2=8, (2000/1000)*2=4, (1000/1000)*2=2, (1000/1000)*2=2
    expect(result).toBe("8 4 2 2");
  });

  it("scales dasharray values with stroke width", () => {
    const result = getSvgStrokeDasharray("dot", 3);
    expect(result).toBe("3 6"); // stroke=3: 3, 3*2=6
  });
});
