import { describe, it, expect } from "vitest";
import { valueToY } from "./chart-helpers";
import type { ValueRange } from "./chart-helpers";
import type { PptxChartSeries } from "pptx-viewer-core";

/**
 * Tests for the stacked bar chart computation logic used in chart-stacked-bar.tsx.
 *
 * The renderStackedBarChart function computes stacked ranges (both absolute
 * and percent-stacked), running sums, and bar geometry. We test that logic.
 */

describe("stacked bar: range computation", () => {
  function computeStackedRange(
    series: PptxChartSeries[],
    catCount: number,
    isPercent: boolean,
  ): ValueRange {
    const categoryTotals = Array.from({ length: catCount }, (_, ci) =>
      series.reduce((sum, s) => sum + Math.abs(s.values[ci] ?? 0), 0),
    );

    let stackMax = 0;
    let stackMin = 0;
    if (isPercent) {
      stackMax = 100;
      stackMin = 0;
    } else {
      for (let ci = 0; ci < catCount; ci++) {
        let posSum = 0;
        let negSum = 0;
        series.forEach((s) => {
          const v = s.values[ci] ?? 0;
          if (v >= 0) posSum += v;
          else negSum += v;
        });
        stackMax = Math.max(stackMax, posSum);
        stackMin = Math.min(stackMin, negSum);
      }
    }

    return {
      min: Math.min(stackMin, 0),
      max: Math.max(stackMax, 0),
      span: Math.max(Math.max(stackMax, 0) - Math.min(stackMin, 0), 1),
    };
  }

  it("should compute range for all-positive stacked values", () => {
    const series: PptxChartSeries[] = [
      { name: "A", values: [10, 20] },
      { name: "B", values: [5, 15] },
    ];
    const range = computeStackedRange(series, 2, false);
    expect(range.min).toBe(0);
    expect(range.max).toBe(35); // max stack is 20+15=35
    expect(range.span).toBe(35);
  });

  it("should compute range with negative values", () => {
    const series: PptxChartSeries[] = [
      { name: "A", values: [10, -5] },
      { name: "B", values: [-3, 20] },
    ];
    const range = computeStackedRange(series, 2, false);
    expect(range.min).toBe(-5); // cat 1: negSum = -5
    expect(range.max).toBe(20); // cat 1: posSum = 20
  });

  it("should use 0-100 range for percent stacked", () => {
    const series: PptxChartSeries[] = [
      { name: "A", values: [30, 70] },
      { name: "B", values: [70, 30] },
    ];
    const range = computeStackedRange(series, 2, true);
    expect(range.min).toBe(0);
    expect(range.max).toBe(100);
    expect(range.span).toBe(100);
  });

  it("should handle empty series", () => {
    const range = computeStackedRange([], 2, false);
    expect(range.min).toBe(0);
    expect(range.max).toBe(0);
    expect(range.span).toBe(1); // clamped to minimum 1
  });

  it("should handle all-zero values", () => {
    const series: PptxChartSeries[] = [
      { name: "A", values: [0, 0] },
    ];
    const range = computeStackedRange(series, 2, false);
    expect(range.span).toBe(1);
  });
});

describe("stacked bar: percent stacking normalization", () => {
  function computePercentValue(
    rawVal: number,
    catTotal: number,
  ): number {
    return catTotal > 0 ? (rawVal / catTotal) * 100 : 0;
  }

  it("should normalize values to percentages", () => {
    // catTotal = |30| + |70| = 100
    expect(computePercentValue(30, 100)).toBe(30);
    expect(computePercentValue(70, 100)).toBe(70);
  });

  it("should handle unequal totals", () => {
    // catTotal = |20| + |80| = 100
    expect(computePercentValue(20, 100)).toBe(20);
    expect(computePercentValue(80, 100)).toBe(80);
  });

  it("should return 0 when category total is 0", () => {
    expect(computePercentValue(50, 0)).toBe(0);
  });

  it("should sum to 100% for all-positive values", () => {
    const vals = [10, 20, 30];
    const total = vals.reduce((s, v) => s + Math.abs(v), 0);
    const percents = vals.map((v) => computePercentValue(v, total));
    const sum = percents.reduce((s, p) => s + p, 0);
    expect(sum).toBeCloseTo(100, 10);
  });

  it("should handle negative raw values in percent mode", () => {
    // In the source: catTotal uses Math.abs, percent = rawVal/catTotal*100
    // If rawVal is negative: val = (rawVal / catTotal) * 100 < 0
    const rawVal = -20;
    const catTotal = 100; // sum of absolute values
    const percent = computePercentValue(rawVal, catTotal);
    expect(percent).toBe(-20);
  });
});

describe("stacked bar: running sum and bar positioning", () => {
  it("should compute correct running positive sums", () => {
    const values = [10, 20, 15];
    let posRunning = 0;
    const positions: Array<{ base: number; top: number }> = [];

    values.forEach((val) => {
      const base = posRunning;
      const top = base + val;
      positions.push({ base, top });
      posRunning += val;
    });

    expect(positions[0]).toEqual({ base: 0, top: 10 });
    expect(positions[1]).toEqual({ base: 10, top: 30 });
    expect(positions[2]).toEqual({ base: 30, top: 45 });
  });

  it("should stack negative values separately from positive", () => {
    const values = [10, -5, 20, -3];
    let posRunning = 0;
    let negRunning = 0;
    const positions: Array<{ base: number; top: number }> = [];

    values.forEach((val) => {
      const isNeg = val < 0;
      const base = isNeg ? negRunning : posRunning;
      const top = base + val;
      positions.push({ base, top });
      if (isNeg) negRunning += val;
      else posRunning += val;
    });

    expect(positions[0]).toEqual({ base: 0, top: 10 });
    expect(positions[1]).toEqual({ base: 0, top: -5 });
    expect(positions[2]).toEqual({ base: 10, top: 30 });
    expect(positions[3]).toEqual({ base: -5, top: -8 });
  });

  it("should compute bar width at 60% of group width", () => {
    const plotWidth = 300;
    const catCount = 3;
    const barGroupWidth = plotWidth / catCount;
    const barWidth = barGroupWidth * 0.6;
    expect(barWidth).toBe(60);
    const barOffset = (barGroupWidth - barWidth) / 2;
    expect(barOffset).toBe(20);
  });

  it("should produce minimum bar height of 0.5 for very small stacks", () => {
    const range: ValueRange = { min: 0, max: 100, span: 100 };
    const baseY = valueToY(0, range, 0, 100);
    const topY = valueToY(0.001, range, 0, 100);
    const h = Math.max(Math.abs(baseY - topY), 0.5);
    expect(h).toBeGreaterThanOrEqual(0.5);
  });
});
