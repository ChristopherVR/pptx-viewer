import { describe, it, expect } from "vitest";
import {
  parseHexToRgb,
  colorDistance,
  toleranceToThreshold,
  replacePixels,
  buildCacheKey,
  MAX_COLOR_DISTANCE,
} from "./image-effects";

describe("parseHexToRgb", () => {
  it("parses 6-digit hex with hash", () => {
    expect(parseHexToRgb("#FF0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("parses 6-digit hex without hash", () => {
    expect(parseHexToRgb("00FF00")).toEqual({ r: 0, g: 255, b: 0 });
  });

  it("parses blue correctly", () => {
    expect(parseHexToRgb("#0000FF")).toEqual({ r: 0, g: 0, b: 255 });
  });

  it("parses black", () => {
    expect(parseHexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("parses white", () => {
    expect(parseHexToRgb("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("parses lowercase hex", () => {
    expect(parseHexToRgb("#abcdef")).toEqual({ r: 171, g: 205, b: 239 });
  });

  it("returns null for invalid hex (too short)", () => {
    expect(parseHexToRgb("#FFF")).toBeNull();
  });

  it("returns null for invalid hex (too long)", () => {
    expect(parseHexToRgb("#FFFFFFF")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseHexToRgb("")).toBeNull();
  });

  it("parses mid-range values correctly", () => {
    expect(parseHexToRgb("#808080")).toEqual({ r: 128, g: 128, b: 128 });
  });
});

describe("colorDistance", () => {
  it("returns 0 for identical colours", () => {
    const c = { r: 128, g: 64, b: 200 };
    expect(colorDistance(c, c)).toBe(0);
  });

  it("returns correct distance for black vs white", () => {
    const black = { r: 0, g: 0, b: 0 };
    const white = { r: 255, g: 255, b: 255 };
    expect(colorDistance(black, white)).toBeCloseTo(MAX_COLOR_DISTANCE, 1);
  });

  it("computes distance for single channel difference", () => {
    const a = { r: 255, g: 0, b: 0 };
    const b = { r: 0, g: 0, b: 0 };
    expect(colorDistance(a, b)).toBe(255);
  });

  it("is symmetric", () => {
    const a = { r: 100, g: 50, b: 200 };
    const b = { r: 200, g: 100, b: 50 };
    expect(colorDistance(a, b)).toBe(colorDistance(b, a));
  });

  it("computes known two-channel distance", () => {
    const a = { r: 0, g: 0, b: 0 };
    const b = { r: 3, g: 4, b: 0 };
    expect(colorDistance(a, b)).toBe(5); // 3-4-5 triangle
  });

  it("returns positive for slightly different colours", () => {
    const a = { r: 100, g: 100, b: 100 };
    const b = { r: 101, g: 100, b: 100 };
    expect(colorDistance(a, b)).toBeCloseTo(1, 5);
  });
});

describe("toleranceToThreshold", () => {
  it("returns 0 for 0% tolerance", () => {
    expect(toleranceToThreshold(0)).toBe(0);
  });

  it("returns MAX_COLOR_DISTANCE for 100% tolerance", () => {
    expect(toleranceToThreshold(100)).toBeCloseTo(MAX_COLOR_DISTANCE, 1);
  });

  it("clamps negative tolerance to 0", () => {
    expect(toleranceToThreshold(-10)).toBe(0);
  });

  it("clamps tolerance above 100 to max", () => {
    expect(toleranceToThreshold(150)).toBeCloseTo(MAX_COLOR_DISTANCE, 1);
  });

  it("returns half of max for 50% tolerance", () => {
    expect(toleranceToThreshold(50)).toBeCloseTo(MAX_COLOR_DISTANCE / 2, 1);
  });

  it("returns proportional value for 25%", () => {
    expect(toleranceToThreshold(25)).toBeCloseTo(MAX_COLOR_DISTANCE * 0.25, 1);
  });
});

describe("replacePixels", () => {
  it("replaces matching pixels with target colour", () => {
    // 1 pixel: RGBA
    const data = new Uint8ClampedArray([255, 0, 0, 255]);
    const from = { r: 255, g: 0, b: 0 };
    const to = { r: 0, g: 255, b: 0 };
    replacePixels(data, from, to, 0, false);
    expect(data[0]).toBe(0);
    expect(data[1]).toBe(255);
    expect(data[2]).toBe(0);
    expect(data[3]).toBe(255); // alpha preserved
  });

  it("makes matching pixels transparent when toTransparent is true", () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255]);
    const from = { r: 255, g: 0, b: 0 };
    const to = { r: 0, g: 0, b: 0 };
    replacePixels(data, from, to, 0, true);
    expect(data[0]).toBe(0);
    expect(data[1]).toBe(0);
    expect(data[2]).toBe(0);
    expect(data[3]).toBe(0); // alpha zeroed
  });

  it("does not modify non-matching pixels", () => {
    const data = new Uint8ClampedArray([0, 0, 255, 255]);
    const from = { r: 255, g: 0, b: 0 };
    const to = { r: 0, g: 255, b: 0 };
    replacePixels(data, from, to, 0, false);
    expect(data[0]).toBe(0);
    expect(data[1]).toBe(0);
    expect(data[2]).toBe(255);
    expect(data[3]).toBe(255);
  });

  it("uses threshold for fuzzy matching", () => {
    // Near-red pixel (254, 1, 1)
    const data = new Uint8ClampedArray([254, 1, 1, 255]);
    const from = { r: 255, g: 0, b: 0 };
    const to = { r: 0, g: 255, b: 0 };
    replacePixels(data, from, to, 2, false);
    // Distance is sqrt(1+1+1) ≈ 1.73, within threshold of 2
    expect(data[0]).toBe(0);
    expect(data[1]).toBe(255);
  });

  it("handles multiple pixels", () => {
    const data = new Uint8ClampedArray([
      255, 0, 0, 255, // red pixel
      0, 0, 255, 255, // blue pixel
      255, 0, 0, 128, // red pixel, half alpha
    ]);
    const from = { r: 255, g: 0, b: 0 };
    const to = { r: 0, g: 128, b: 0 };
    replacePixels(data, from, to, 0, false);
    // First pixel: replaced
    expect(data[0]).toBe(0);
    expect(data[1]).toBe(128);
    // Second pixel: unchanged
    expect(data[4]).toBe(0);
    expect(data[5]).toBe(0);
    expect(data[6]).toBe(255);
    // Third pixel: replaced, alpha preserved
    expect(data[8]).toBe(0);
    expect(data[9]).toBe(128);
    expect(data[11]).toBe(128);
  });

  it("handles empty data array", () => {
    const data = new Uint8ClampedArray([]);
    const from = { r: 255, g: 0, b: 0 };
    const to = { r: 0, g: 255, b: 0 };
    replacePixels(data, from, to, 0, false);
    expect(data.length).toBe(0);
  });
});

describe("buildCacheKey", () => {
  it("builds deterministic cache key", () => {
    const key = buildCacheKey("img.png", "#FF0000", "#00FF00", 12, false);
    expect(key).toBe("img.png|#FF0000|#00FF00|12|false");
  });

  it("truncates long source strings to 64 chars", () => {
    const longSrc = "a".repeat(200);
    const key = buildCacheKey(longSrc, "#000", "#FFF", 10, true);
    expect(key.startsWith("a".repeat(64))).toBe(true);
    expect(key).not.toContain("a".repeat(65));
  });

  it("includes toTransparent flag", () => {
    const keyFalse = buildCacheKey("x", "#000", "#FFF", 10, false);
    const keyTrue = buildCacheKey("x", "#000", "#FFF", 10, true);
    expect(keyFalse).not.toBe(keyTrue);
    expect(keyFalse).toContain("false");
    expect(keyTrue).toContain("true");
  });

  it("produces different keys for different tolerances", () => {
    const k1 = buildCacheKey("x", "#000", "#FFF", 10, false);
    const k2 = buildCacheKey("x", "#000", "#FFF", 20, false);
    expect(k1).not.toBe(k2);
  });

  it("produces different keys for different colours", () => {
    const k1 = buildCacheKey("x", "#FF0000", "#00FF00", 10, false);
    const k2 = buildCacheKey("x", "#FF0000", "#0000FF", 10, false);
    expect(k1).not.toBe(k2);
  });

  it("handles empty source string", () => {
    const key = buildCacheKey("", "#000", "#FFF", 0, false);
    expect(key).toBe("|#000|#FFF|0|false");
  });
});
