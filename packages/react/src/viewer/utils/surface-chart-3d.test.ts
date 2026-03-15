/**
 * Tests for the 3D surface chart data preparation and integration.
 *
 * These tests verify the data transformation logic without requiring
 * Three.js to be loaded. The actual Three.js scene rendering is
 * covered by visual/integration tests.
 */

import { describe, it, expect } from "vitest";
import { surfaceColor } from "./chart-surface-treemap";

// ---------------------------------------------------------------------------
// surfaceColor colour ramp (shared with the 3D renderer)
// ---------------------------------------------------------------------------

describe("SurfaceChart3D: colour ramp normalisation", () => {
  it("should produce [0,1] normalised values from surfaceColor output", () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const { r, g, b } = surfaceColor(t);
      expect(r / 255).toBeGreaterThanOrEqual(0);
      expect(r / 255).toBeLessThanOrEqual(1);
      expect(g / 255).toBeGreaterThanOrEqual(0);
      expect(g / 255).toBeLessThanOrEqual(1);
      expect(b / 255).toBeGreaterThanOrEqual(0);
      expect(b / 255).toBeLessThanOrEqual(1);
    }
  });

  it("should produce a gradient from blue to red", () => {
    const cold = surfaceColor(0);
    const hot = surfaceColor(1);
    // Cold end: more blue than red
    expect(cold.b).toBeGreaterThan(cold.r);
    // Hot end: more red than blue
    expect(hot.r).toBeGreaterThan(hot.b);
  });

  it("should produce monotonically increasing red channel", () => {
    const steps = 10;
    let prevR = -1;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const { r } = surfaceColor(t);
      expect(r).toBeGreaterThanOrEqual(prevR);
      prevR = r;
    }
  });

  it("should produce monotonically decreasing blue channel", () => {
    const steps = 10;
    let prevB = 300;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const { b } = surfaceColor(t);
      expect(b).toBeLessThanOrEqual(prevB);
      prevB = b;
    }
  });
});

// ---------------------------------------------------------------------------
// Height map construction logic (inline to avoid importing React component)
// ---------------------------------------------------------------------------

describe("SurfaceChart3D: height map construction", () => {
  function buildHeightMap(
    series: Array<{ values: number[] }>,
    cols: number,
    rangeMin: number,
    rangeSpan: number,
  ): Float32Array {
    const rows = series.length;
    const heightMap = new Float32Array(rows * cols);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = series[r]?.values[c] ?? 0;
        heightMap[r * cols + c] =
          rangeSpan > 0 ? (val - rangeMin) / rangeSpan : 0;
      }
    }
    return heightMap;
  }

  it("should normalise values to [0,1] range", () => {
    const series = [
      { values: [10, 20, 30] },
      { values: [40, 50, 60] },
    ];
    const hm = buildHeightMap(series, 3, 10, 50);
    // 10 -> 0, 60 -> 1
    expect(hm[0]).toBeCloseTo(0, 5);
    expect(hm[5]).toBeCloseTo(1, 5);
  });

  it("should handle zero span gracefully", () => {
    const series = [
      { values: [5, 5, 5] },
      { values: [5, 5, 5] },
    ];
    const hm = buildHeightMap(series, 3, 5, 0);
    for (let i = 0; i < hm.length; i++) {
      expect(hm[i]).toBe(0);
    }
  });

  it("should handle missing values as zero", () => {
    const series = [
      { values: [10] }, // only 1 value, cols = 3
      { values: [20, 30] },
    ];
    const hm = buildHeightMap(series, 3, 0, 30);
    // series[0].values[1] is undefined -> 0
    expect(hm[1]).toBeCloseTo(0 / 30, 5);
    // series[0].values[2] is undefined -> 0
    expect(hm[2]).toBeCloseTo(0 / 30, 5);
  });

  it("should produce the correct array length", () => {
    const series = [
      { values: [1, 2, 3, 4] },
      { values: [5, 6, 7, 8] },
      { values: [9, 10, 11, 12] },
    ];
    const hm = buildHeightMap(series, 4, 1, 11);
    expect(hm.length).toBe(3 * 4);
  });

  it("should map values row-major", () => {
    const series = [
      { values: [0, 100] },
      { values: [50, 75] },
    ];
    const hm = buildHeightMap(series, 2, 0, 100);
    // Row 0: [0, 100] -> [0, 1]
    expect(hm[0]).toBeCloseTo(0, 5);
    expect(hm[1]).toBeCloseTo(1, 5);
    // Row 1: [50, 75] -> [0.5, 0.75]
    expect(hm[2]).toBeCloseTo(0.5, 5);
    expect(hm[3]).toBeCloseTo(0.75, 5);
  });
});

// ---------------------------------------------------------------------------
// Colour map construction logic
// ---------------------------------------------------------------------------

describe("SurfaceChart3D: colour map construction", () => {
  function buildColorMap(
    heightMap: Float32Array,
    size: number,
  ): Float32Array {
    const colorMap = new Float32Array(size * 3);
    for (let i = 0; i < size; i++) {
      const t = heightMap[i] ?? 0;
      const { r, g, b } = surfaceColor(t);
      colorMap[i * 3] = r / 255;
      colorMap[i * 3 + 1] = g / 255;
      colorMap[i * 3 + 2] = b / 255;
    }
    return colorMap;
  }

  it("should produce RGB triplets in [0,1]", () => {
    const hm = new Float32Array([0, 0.25, 0.5, 0.75, 1]);
    const cm = buildColorMap(hm, 5);
    for (let i = 0; i < cm.length; i++) {
      expect(cm[i]).toBeGreaterThanOrEqual(0);
      expect(cm[i]).toBeLessThanOrEqual(1);
    }
  });

  it("should have length 3x the number of data points", () => {
    const hm = new Float32Array(12);
    const cm = buildColorMap(hm, 12);
    expect(cm.length).toBe(36);
  });

  it("should map low height to blue-ish colours", () => {
    const hm = new Float32Array([0]);
    const cm = buildColorMap(hm, 1);
    // Blue channel should be higher than red
    expect(cm[2]).toBeGreaterThan(cm[0]);
  });

  it("should map high height to red-ish colours", () => {
    const hm = new Float32Array([1]);
    const cm = buildColorMap(hm, 1);
    // Red channel should be higher than blue
    expect(cm[0]).toBeGreaterThan(cm[2]);
  });
});
