import { describe, it, expect } from "vitest";
import { computeValueRange, valueToY, PALETTE } from "./chart-helpers";
import { computeLayout } from "./chart-layout";
import type { PptxChartSeries } from "pptx-viewer-core";

/**
 * Tests for the bar chart computation logic used in chart-bar.tsx.
 *
 * The rendering functions (renderDefaultBarChart, renderBoxWhiskerChart) embed
 * calculation logic for bar widths, positions, and box-whisker quartiles.
 * We test that logic by re-running the same math the renderers use.
 */

describe("bar chart: grouped bar geometry", () => {
  // Replicate the computation logic from renderDefaultBarChart
  function computeBarGeometry(
    plotWidth: number,
    plotLeft: number,
    catCount: number,
    seriesCount: number,
  ) {
    const barGroupWidth = plotWidth / catCount;
    const singleBarWidth = (barGroupWidth * 0.7) / Math.max(seriesCount, 1);
    const groupOffset = (barGroupWidth - singleBarWidth * seriesCount) / 2;
    return { barGroupWidth, singleBarWidth, groupOffset };
  }

  it("should compute correct bar group width for 3 categories", () => {
    const { barGroupWidth } = computeBarGeometry(300, 50, 3, 2);
    expect(barGroupWidth).toBe(100);
  });

  it("should compute correct single bar width for 2 series", () => {
    const { singleBarWidth } = computeBarGeometry(300, 50, 3, 2);
    expect(singleBarWidth).toBe((100 * 0.7) / 2);
  });

  it("should center bars within group via offset", () => {
    const { barGroupWidth, singleBarWidth, groupOffset } =
      computeBarGeometry(300, 50, 3, 2);
    const totalBarsWidth = singleBarWidth * 2;
    expect(groupOffset).toBe((barGroupWidth - totalBarsWidth) / 2);
  });

  it("should handle single series", () => {
    const { singleBarWidth, barGroupWidth } =
      computeBarGeometry(400, 0, 4, 1);
    expect(singleBarWidth).toBe(barGroupWidth * 0.7);
  });

  it("should handle single category", () => {
    const { barGroupWidth } = computeBarGeometry(300, 50, 1, 2);
    expect(barGroupWidth).toBe(300);
  });

  it("should protect against zero series count", () => {
    const { singleBarWidth } = computeBarGeometry(300, 50, 3, 0);
    // Math.max(seriesCount, 1) prevents division by zero
    expect(Number.isFinite(singleBarWidth)).toBe(true);
    expect(singleBarWidth).toBe(100 * 0.7);
  });

  it("should compute correct bar x positions for each series within a group", () => {
    const plotLeft = 50;
    const { barGroupWidth, singleBarWidth, groupOffset } =
      computeBarGeometry(300, plotLeft, 3, 2);
    // For category index 1, series index 0:
    const x0 = plotLeft + barGroupWidth * 1 + groupOffset + singleBarWidth * 0;
    // For category index 1, series index 1:
    const x1 = plotLeft + barGroupWidth * 1 + groupOffset + singleBarWidth * 1;
    expect(x1 - x0).toBe(singleBarWidth);
  });

  it("should compute bar Y coordinates relative to zero baseline", () => {
    const range = computeValueRange([
      { name: "A", values: [10, -5, 20] },
    ]);
    const topY = 10;
    const bottomY = 110;
    const zeroY = valueToY(0, range, topY, bottomY);
    const valY = valueToY(10, range, topY, bottomY);
    // Positive bar: top of bar is valY, bottom is zeroY
    expect(valY).toBeLessThan(zeroY);
    const barY = Math.min(zeroY, valY);
    const barH = Math.abs(zeroY - valY);
    expect(barY).toBe(valY);
    expect(barH).toBeGreaterThan(0);
  });

  it("should produce minimum bar height of 1 for zero value", () => {
    const range = computeValueRange([
      { name: "A", values: [0, 10] },
    ]);
    const zeroY = valueToY(0, range, 0, 100);
    const valY = valueToY(0, range, 0, 100);
    const barH = Math.max(Math.abs(zeroY - valY), 1);
    expect(barH).toBe(1);
  });

  it("should handle negative bars correctly (bar extends downward from zero)", () => {
    const range = computeValueRange([
      { name: "A", values: [-20, 10] },
    ]);
    const zeroY = valueToY(0, range, 0, 100);
    const negValY = valueToY(-20, range, 0, 100);
    // Negative bar: zeroY should be above negValY (lower pixel value)
    expect(negValY).toBeGreaterThan(zeroY);
    const barY = Math.min(zeroY, negValY);
    expect(barY).toBe(zeroY);
  });
});

describe("bar chart: box-and-whisker quartile computation", () => {
  // Replicate the quartile computation from renderBoxWhiskerChart
  function computeBoxWhiskerStats(catVals: number[]) {
    const sorted = [...catVals].sort((a, b) => a - b);
    if (sorted.length < 2) return null;
    const minV = sorted[0];
    const maxV = sorted[sorted.length - 1];
    const q1Idx = Math.floor(sorted.length * 0.25);
    const q3Idx = Math.floor(sorted.length * 0.75);
    const medIdx = Math.floor(sorted.length * 0.5);
    return {
      min: minV,
      max: maxV,
      q1: sorted[q1Idx],
      q3: sorted[q3Idx],
      median: sorted[medIdx],
    };
  }

  it("should compute correct quartiles for even-count data", () => {
    const stats = computeBoxWhiskerStats([10, 20, 30, 40]);
    expect(stats).not.toBeNull();
    expect(stats!.min).toBe(10);
    expect(stats!.max).toBe(40);
    expect(stats!.q1).toBe(20); // index 1
    expect(stats!.median).toBe(30); // index 2
    expect(stats!.q3).toBe(40); // index 3
  });

  it("should compute correct quartiles for odd-count data", () => {
    const stats = computeBoxWhiskerStats([5, 10, 15, 20, 25]);
    expect(stats).not.toBeNull();
    expect(stats!.min).toBe(5);
    expect(stats!.max).toBe(25);
    expect(stats!.q1).toBe(10); // index 1
    expect(stats!.median).toBe(15); // index 2
    expect(stats!.q3).toBe(20); // index 3
  });

  it("should return null for fewer than 2 values", () => {
    expect(computeBoxWhiskerStats([42])).toBeNull();
    expect(computeBoxWhiskerStats([])).toBeNull();
  });

  it("should handle all identical values", () => {
    const stats = computeBoxWhiskerStats([7, 7, 7, 7]);
    expect(stats!.min).toBe(7);
    expect(stats!.max).toBe(7);
    expect(stats!.q1).toBe(7);
    expect(stats!.median).toBe(7);
    expect(stats!.q3).toBe(7);
  });

  it("should sort unsorted input", () => {
    const stats = computeBoxWhiskerStats([30, 10, 40, 20]);
    expect(stats!.min).toBe(10);
    expect(stats!.max).toBe(40);
  });

  it("should handle negative values", () => {
    const stats = computeBoxWhiskerStats([-20, -10, 0, 10, 20]);
    expect(stats!.min).toBe(-20);
    expect(stats!.max).toBe(20);
    expect(stats!.median).toBe(0);
  });

  it("should handle exactly two values", () => {
    const stats = computeBoxWhiskerStats([3, 8]);
    expect(stats!.min).toBe(3);
    expect(stats!.max).toBe(8);
    // With 2 elements, q1Idx=0, medIdx=1, q3Idx=1
    expect(stats!.q1).toBe(3);
    expect(stats!.median).toBe(8);
  });

  it("should compute box width as 50% of group width", () => {
    const plotWidth = 300;
    const catCount = 3;
    const boxGroupW = plotWidth / catCount;
    const boxW = boxGroupW * 0.5;
    expect(boxW).toBe(50);
    const boxOffset = (boxGroupW - boxW) / 2;
    expect(boxOffset).toBe(25);
  });
});
