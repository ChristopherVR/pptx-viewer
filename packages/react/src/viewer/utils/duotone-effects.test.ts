import { describe, it, expect } from "vitest";
import {
  mapDuotonePixels,
  buildDuotoneCacheKey,
  getDuotoneCachedResult,
  setDuotoneCachedResult,
} from "./duotone-effects";

describe("mapDuotonePixels", () => {
  it("maps black pixels to shadow colour", () => {
    // Black pixel (luminance=0) → full shadow colour
    const data = new Uint8ClampedArray([0, 0, 0, 255]);
    const shadow = { r: 0, g: 0, b: 128 }; // navy
    const highlight = { r: 255, g: 215, b: 0 }; // gold
    mapDuotonePixels(data, shadow, highlight);
    expect(data[0]).toBe(0);
    expect(data[1]).toBe(0);
    expect(data[2]).toBe(128);
    expect(data[3]).toBe(255); // alpha preserved
  });

  it("maps white pixels to highlight colour", () => {
    // White pixel (luminance=255) → full highlight colour
    const data = new Uint8ClampedArray([255, 255, 255, 255]);
    const shadow = { r: 0, g: 0, b: 128 };
    const highlight = { r: 255, g: 215, b: 0 };
    mapDuotonePixels(data, shadow, highlight);
    expect(data[0]).toBe(255);
    expect(data[1]).toBe(215);
    expect(data[2]).toBe(0);
    expect(data[3]).toBe(255);
  });

  it("interpolates mid-grey pixels", () => {
    // Mid-grey (128, 128, 128) → luminance ≈ 128 → t ≈ 0.502
    const data = new Uint8ClampedArray([128, 128, 128, 200]);
    const shadow = { r: 0, g: 0, b: 0 };
    const highlight = { r: 255, g: 255, b: 255 };
    mapDuotonePixels(data, shadow, highlight);
    // Result should be approximately 128 for all channels
    expect(data[0]).toBeCloseTo(128, -1);
    expect(data[1]).toBeCloseTo(128, -1);
    expect(data[2]).toBeCloseTo(128, -1);
    expect(data[3]).toBe(200); // alpha preserved
  });

  it("preserves alpha channel", () => {
    const data = new Uint8ClampedArray([100, 100, 100, 42]);
    const shadow = { r: 0, g: 0, b: 0 };
    const highlight = { r: 255, g: 255, b: 255 };
    mapDuotonePixels(data, shadow, highlight);
    expect(data[3]).toBe(42);
  });

  it("processes multiple pixels", () => {
    const data = new Uint8ClampedArray([
      0, 0, 0, 255, // black
      255, 255, 255, 255, // white
    ]);
    const shadow = { r: 10, g: 20, b: 30 };
    const highlight = { r: 200, g: 210, b: 220 };
    mapDuotonePixels(data, shadow, highlight);
    // First pixel → shadow
    expect(data[0]).toBe(10);
    expect(data[1]).toBe(20);
    expect(data[2]).toBe(30);
    // Second pixel → highlight
    expect(data[4]).toBe(200);
    expect(data[5]).toBe(210);
    expect(data[6]).toBe(220);
  });

  it("handles empty data array", () => {
    const data = new Uint8ClampedArray([]);
    const shadow = { r: 0, g: 0, b: 0 };
    const highlight = { r: 255, g: 255, b: 255 };
    mapDuotonePixels(data, shadow, highlight);
    expect(data.length).toBe(0);
  });

  it("uses BT.601 luminance weights (red is brighter than blue)", () => {
    const red = new Uint8ClampedArray([255, 0, 0, 255]);
    const blue = new Uint8ClampedArray([0, 0, 255, 255]);
    const shadow = { r: 0, g: 0, b: 0 };
    const highlight = { r: 255, g: 255, b: 255 };
    mapDuotonePixels(red, shadow, highlight);
    mapDuotonePixels(blue, shadow, highlight);
    // Red luminance (0.2126 * 255) > Blue luminance (0.0722 * 255)
    // So red's output should be brighter
    expect(red[0]).toBeGreaterThan(blue[0]);
  });
});

describe("buildDuotoneCacheKey", () => {
  it("builds deterministic key", () => {
    const key = buildDuotoneCacheKey("img.png", "#000080", "#FFD700");
    expect(key).toBe("dt|img.png|#000080|#FFD700");
  });

  it("truncates long source strings to 64 chars", () => {
    const longSrc = "x".repeat(200);
    const key = buildDuotoneCacheKey(longSrc, "#000", "#FFF");
    expect(key).toBe(`dt|${"x".repeat(64)}|#000|#FFF`);
  });

  it("keeps short source intact", () => {
    const key = buildDuotoneCacheKey("short.png", "#AAA", "#BBB");
    expect(key).toContain("short.png");
  });

  it("produces different keys for different shadow colours", () => {
    const k1 = buildDuotoneCacheKey("x", "#000", "#FFF");
    const k2 = buildDuotoneCacheKey("x", "#111", "#FFF");
    expect(k1).not.toBe(k2);
  });

  it("produces different keys for different highlight colours", () => {
    const k1 = buildDuotoneCacheKey("x", "#000", "#FFF");
    const k2 = buildDuotoneCacheKey("x", "#000", "#EEE");
    expect(k1).not.toBe(k2);
  });

  it("handles empty source", () => {
    const key = buildDuotoneCacheKey("", "#000", "#FFF");
    expect(key).toBe("dt||#000|#FFF");
  });
});

describe("duotone cache (get/set)", () => {
  it("returns undefined for uncached key", () => {
    expect(
      getDuotoneCachedResult("non-existent-key-" + Math.random()),
    ).toBeUndefined();
  });

  it("stores and retrieves a cached value", () => {
    const key = "test-cache-key-" + Math.random();
    setDuotoneCachedResult(key, "data:image/png;base64,abc");
    expect(getDuotoneCachedResult(key)).toBe("data:image/png;base64,abc");
  });

  it("overwrites existing cache entry", () => {
    const key = "test-overwrite-" + Math.random();
    setDuotoneCachedResult(key, "old");
    setDuotoneCachedResult(key, "new");
    expect(getDuotoneCachedResult(key)).toBe("new");
  });
});
