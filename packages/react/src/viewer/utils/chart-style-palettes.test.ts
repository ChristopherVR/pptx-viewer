import { describe, it, expect } from "vitest";
import {
  getChartStylePalette,
  DEFAULT_CHART_PALETTE,
  tint,
  shade,
} from "./chart-style-palettes";

describe("getChartStylePalette", () => {
  it("should return the default palette when styleId is undefined", () => {
    expect(getChartStylePalette(undefined)).toBe(DEFAULT_CHART_PALETTE);
  });

  it("should return the default palette when styleId is 0", () => {
    expect(getChartStylePalette(0)).toBe(DEFAULT_CHART_PALETTE);
  });

  it("should return the default palette when styleId is negative", () => {
    expect(getChartStylePalette(-1)).toBe(DEFAULT_CHART_PALETTE);
  });

  it("should return the default palette when styleId is > 48", () => {
    expect(getChartStylePalette(49)).toBe(DEFAULT_CHART_PALETTE);
  });

  it("should return an 8-colour array for style 1", () => {
    const palette = getChartStylePalette(1);
    expect(palette).toHaveLength(8);
    palette.forEach((c) => {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  it("should return different palettes for different style IDs", () => {
    const p1 = getChartStylePalette(1);
    const p2 = getChartStylePalette(2);
    const p10 = getChartStylePalette(10);
    // Style 1 and 2 are colorful sequential with different offsets
    expect(p1).not.toEqual(p2);
    // Style 10 is monochromatic (very different)
    expect(p1).not.toEqual(p10);
  });

  it("should return the same palette for the same style ID (cached)", () => {
    const a = getChartStylePalette(5);
    const b = getChartStylePalette(5);
    expect(a).toBe(b); // exact same reference (cached)
  });

  it("should return valid hex colours for all style IDs 1-48", () => {
    for (let id = 1; id <= 48; id++) {
      const palette = getChartStylePalette(id);
      expect(palette).toHaveLength(8);
      palette.forEach((c) => {
        expect(c).toMatch(/^#[0-9a-f]{6}$/i);
      });
    }
  });

  // Group 1-8: Colorful sequential
  it("style 1 should start with accent1 (Office blue)", () => {
    const palette = getChartStylePalette(1);
    // Style 1 starts with accent1 = #4472C4
    expect(palette[0]).toBe("#4472C4");
  });

  it("style 2 should start with accent2 (Office orange)", () => {
    const palette = getChartStylePalette(2);
    expect(palette[0]).toBe("#ED7D31");
  });

  // Group 9-16: Monochromatic
  it("style 9 should be a monochromatic ramp from accent1", () => {
    const palette = getChartStylePalette(9);
    // Monochromatic ramp: darkest to lightest
    // The base (accent1) should be in the middle of the ramp
    expect(palette[3]).toBe("#4472C4");
    // Earlier entries should be darker
    expect(palette).toHaveLength(8);
  });

  // Group 25-32: Dark palettes
  it("style 25 should be darker than style 1", () => {
    const p1 = getChartStylePalette(1);
    const p25 = getChartStylePalette(25);
    // All dark palette colours should be distinct from the base
    expect(p25[0]).not.toBe(p1[0]);
  });

  // Group 41-48: Light palettes
  it("style 41 should be lighter than style 1", () => {
    const p1 = getChartStylePalette(1);
    const p41 = getChartStylePalette(41);
    expect(p41[0]).not.toBe(p1[0]);
  });
});

describe("tint", () => {
  it("should return white when amount is 1", () => {
    expect(tint("#000000", 1)).toBe("#ffffff");
  });

  it("should return the original colour when amount is 0", () => {
    expect(tint("#4472C4", 0)).toBe("#4472c4");
  });

  it("should lighten a colour", () => {
    const result = tint("#4472C4", 0.5);
    // Should be lighter than original — check the R channel
    const r = parseInt(result.slice(1, 3), 16);
    expect(r).toBeGreaterThan(0x44);
  });
});

describe("shade", () => {
  it("should return black when amount is 1", () => {
    expect(shade("#ffffff", 1)).toBe("#000000");
  });

  it("should return the original colour when amount is 0", () => {
    expect(shade("#4472C4", 0)).toBe("#4472c4");
  });

  it("should darken a colour", () => {
    const result = shade("#4472C4", 0.5);
    // Should be darker — check the R channel
    const r = parseInt(result.slice(1, 3), 16);
    expect(r).toBeLessThan(0x44);
  });
});
