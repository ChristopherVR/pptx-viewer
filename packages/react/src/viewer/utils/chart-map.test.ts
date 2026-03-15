import { describe, it, expect } from "vitest";
import {
  resolveRegionCode,
  sequentialColorScale,
  normalizeValue,
  WORLD_REGIONS,
} from "./chart-map";

// ── Region code resolution ───────────────────────────────────────

describe("resolveRegionCode", () => {
  it("should resolve full country names (case-insensitive)", () => {
    expect(resolveRegionCode("United States")).toBe("US");
    expect(resolveRegionCode("united states")).toBe("US");
    expect(resolveRegionCode("UNITED STATES")).toBe("US");
    expect(resolveRegionCode("China")).toBe("CN");
    expect(resolveRegionCode("India")).toBe("IN");
    expect(resolveRegionCode("Brazil")).toBe("BR");
    expect(resolveRegionCode("Australia")).toBe("AU");
  });

  it("should resolve ISO 2-letter codes", () => {
    expect(resolveRegionCode("US")).toBe("US");
    expect(resolveRegionCode("GB")).toBe("GB");
    expect(resolveRegionCode("DE")).toBe("DE");
    expect(resolveRegionCode("FR")).toBe("FR");
    expect(resolveRegionCode("JP")).toBe("JP");
    expect(resolveRegionCode("CN")).toBe("CN");
    expect(resolveRegionCode("IN")).toBe("IN");
    expect(resolveRegionCode("AU")).toBe("AU");
  });

  it("should resolve ISO 3-letter codes", () => {
    expect(resolveRegionCode("USA")).toBe("US");
    expect(resolveRegionCode("GBR")).toBe("GB");
    expect(resolveRegionCode("DEU")).toBe("DE");
    expect(resolveRegionCode("FRA")).toBe("FR");
    expect(resolveRegionCode("JPN")).toBe("JP");
    expect(resolveRegionCode("CHN")).toBe("CN");
    expect(resolveRegionCode("IND")).toBe("IN");
    expect(resolveRegionCode("AUS")).toBe("AU");
    expect(resolveRegionCode("BRA")).toBe("BR");
    expect(resolveRegionCode("RUS")).toBe("RU");
  });

  it("should resolve common aliases", () => {
    expect(resolveRegionCode("UK")).toBe("GB");
    expect(resolveRegionCode("United Kingdom")).toBe("GB");
    expect(resolveRegionCode("Korea")).toBe("KR");
    expect(resolveRegionCode("South Korea")).toBe("KR");
    expect(resolveRegionCode("United States of America")).toBe("US");
  });

  it("should return undefined for unrecognised labels", () => {
    expect(resolveRegionCode("Narnia")).toBeUndefined();
    expect(resolveRegionCode("")).toBeUndefined();
    expect(resolveRegionCode("XYZ")).toBeUndefined();
    expect(resolveRegionCode("Atlantis")).toBeUndefined();
  });

  it("should trim whitespace from input", () => {
    expect(resolveRegionCode("  US  ")).toBe("US");
    expect(resolveRegionCode("  France  ")).toBe("FR");
  });
});

// ── Color scale ──────────────────────────────────────────────────

describe("sequentialColorScale", () => {
  it("should return the lightest color at t=0", () => {
    const color = sequentialColorScale(0);
    expect(color).toBe("#dbeafe");
  });

  it("should return the mid color at t=0.5", () => {
    const color = sequentialColorScale(0.5);
    expect(color).toBe("#3b82f6");
  });

  it("should return the darkest color at t=1", () => {
    const color = sequentialColorScale(1);
    expect(color).toBe("#1e3a5f");
  });

  it("should clamp values below 0 to the lightest color", () => {
    expect(sequentialColorScale(-0.5)).toBe("#dbeafe");
    expect(sequentialColorScale(-100)).toBe("#dbeafe");
  });

  it("should clamp values above 1 to the darkest color", () => {
    expect(sequentialColorScale(1.5)).toBe("#1e3a5f");
    expect(sequentialColorScale(100)).toBe("#1e3a5f");
  });

  it("should return a valid hex color for intermediate values", () => {
    const color = sequentialColorScale(0.25);
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("should interpolate between first and second stop for t in [0, 0.5)", () => {
    const color = sequentialColorScale(0.25);
    // Should be between #dbeafe and #3b82f6
    expect(color).not.toBe("#dbeafe");
    expect(color).not.toBe("#3b82f6");
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("should interpolate between second and third stop for t in (0.5, 1]", () => {
    const color = sequentialColorScale(0.75);
    // Should be between #3b82f6 and #1e3a5f
    expect(color).not.toBe("#3b82f6");
    expect(color).not.toBe("#1e3a5f");
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });
});

// ── Normalise value ──────────────────────────────────────────────

describe("normalizeValue", () => {
  it("should return 0 for the minimum value", () => {
    expect(normalizeValue(10, 10, 100)).toBe(0);
  });

  it("should return 1 for the maximum value", () => {
    expect(normalizeValue(100, 10, 100)).toBe(1);
  });

  it("should return 0.5 for the midpoint", () => {
    expect(normalizeValue(55, 10, 100)).toBe(0.5);
  });

  it("should return 0.5 when min equals max (uniform distribution)", () => {
    expect(normalizeValue(42, 42, 42)).toBe(0.5);
  });

  it("should handle negative ranges", () => {
    expect(normalizeValue(-50, -100, 0)).toBe(0.5);
    expect(normalizeValue(-100, -100, 0)).toBe(0);
    expect(normalizeValue(0, -100, 0)).toBe(1);
  });

  it("should handle values outside the range", () => {
    // Values beyond range are still linearly mapped (no clamping here)
    expect(normalizeValue(200, 0, 100)).toBe(2);
    expect(normalizeValue(-50, 0, 100)).toBe(-0.5);
  });
});

// ── World regions data integrity ─────────────────────────────────

describe("WORLD_REGIONS", () => {
  it("should have at least 20 regions defined", () => {
    expect(WORLD_REGIONS.length).toBeGreaterThanOrEqual(20);
  });

  it("should have unique region codes", () => {
    const codes = WORLD_REGIONS.map((r) => r.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it("should have non-empty paths for all regions", () => {
    for (const region of WORLD_REGIONS) {
      expect(region.path.length).toBeGreaterThan(10);
    }
  });

  it("should have label coordinates within the 1000x500 viewBox", () => {
    for (const region of WORLD_REGIONS) {
      const [lx, ly] = region.labelXY;
      expect(lx).toBeGreaterThanOrEqual(0);
      expect(lx).toBeLessThanOrEqual(1000);
      expect(ly).toBeGreaterThanOrEqual(0);
      expect(ly).toBeLessThanOrEqual(500);
    }
  });

  it("should have names for all regions", () => {
    for (const region of WORLD_REGIONS) {
      expect(region.name.length).toBeGreaterThan(0);
    }
  });

  it("should include major countries", () => {
    const codes = new Set(WORLD_REGIONS.map((r) => r.code));
    const majors = ["US", "CN", "IN", "GB", "DE", "FR", "JP", "BR", "RU", "AU", "CA"];
    for (const c of majors) {
      expect(codes.has(c)).toBe(true);
    }
  });
});

// ── Integration: region code -> color mapping pipeline ───────────

describe("region code to color pipeline", () => {
  it("should produce distinct colors for distinct values", () => {
    const vals = [10, 50, 100];
    const min = 10;
    const max = 100;
    const colors = vals.map((v) =>
      sequentialColorScale(normalizeValue(v, min, max)),
    );
    // All three colors should be different
    const unique = new Set(colors);
    expect(unique.size).toBe(3);
  });

  it("should produce same color for same normalised value", () => {
    const c1 = sequentialColorScale(normalizeValue(50, 0, 100));
    const c2 = sequentialColorScale(normalizeValue(50, 0, 100));
    expect(c1).toBe(c2);
  });

  it("should map resolved region codes to data values correctly", () => {
    const categories = ["United States", "China", "France", "Narnia"];
    const values = [100, 200, 150, 50];
    const regionMap = new Map<string, number>();
    const unmatched: string[] = [];

    categories.forEach((cat, i) => {
      const code = resolveRegionCode(cat);
      if (code) {
        regionMap.set(code, values[i]);
      } else {
        unmatched.push(cat);
      }
    });

    expect(regionMap.get("US")).toBe(100);
    expect(regionMap.get("CN")).toBe(200);
    expect(regionMap.get("FR")).toBe(150);
    expect(regionMap.has("Narnia")).toBe(false);
    expect(unmatched).toEqual(["Narnia"]);
  });
});
