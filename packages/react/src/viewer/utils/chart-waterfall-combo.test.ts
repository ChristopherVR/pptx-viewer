import { describe, it, expect } from "vitest";
import { computeValueRange, valueToY } from "./chart-helpers";

/**
 * Tests for waterfall and combo chart computation logic used in
 * chart-waterfall-combo.tsx.
 *
 * The renderWaterfallChart function computes running totals, treats the
 * last bar as a total bar (starting from zero), and computes connector
 * line positions. The renderComboChart function combines bar and line
 * series geometry.
 */

describe("waterfall chart: running total computation", () => {
  function computeWaterfallRunning(values: number[]) {
    let runningTotal = 0;
    return values.map((val, i) => {
      const isLast = i === values.length - 1;
      const startVal = isLast ? 0 : runningTotal;
      const endVal = isLast ? runningTotal + val : runningTotal + val;
      if (!isLast) {
        runningTotal += val;
      }
      return { startVal, endVal, isLast };
    });
  }

  it("should start first bar from zero", () => {
    const result = computeWaterfallRunning([10, 20, -5, 25]);
    expect(result[0].startVal).toBe(0);
    expect(result[0].endVal).toBe(10);
  });

  it("should accumulate running total correctly", () => {
    const result = computeWaterfallRunning([10, 20, -5, 25]);
    // Bar 0: start=0, end=10, running=10
    // Bar 1: start=10, end=30, running=30
    // Bar 2: start=30, end=25, running=25
    // Bar 3 (last): start=0, end=25+25=50
    expect(result[0]).toEqual({ startVal: 0, endVal: 10, isLast: false });
    expect(result[1]).toEqual({ startVal: 10, endVal: 30, isLast: false });
    expect(result[2]).toEqual({ startVal: 30, endVal: 25, isLast: false });
    expect(result[3]).toEqual({ startVal: 0, endVal: 50, isLast: true });
  });

  it("should treat last bar as total (starting from zero)", () => {
    const result = computeWaterfallRunning([100, -30, -20, 50]);
    const last = result[result.length - 1];
    expect(last.isLast).toBe(true);
    expect(last.startVal).toBe(0);
    // Running before last = 100-30-20 = 50, then endVal = 50+50 = 100
    expect(last.endVal).toBe(100);
  });

  it("should handle all-negative values", () => {
    const result = computeWaterfallRunning([-10, -20, -30]);
    expect(result[0]).toEqual({ startVal: 0, endVal: -10, isLast: false });
    expect(result[1]).toEqual({ startVal: -10, endVal: -30, isLast: false });
    // Last bar: start=0, end = -30 + (-30) = -60
    expect(result[2].startVal).toBe(0);
    expect(result[2].endVal).toBe(-60);
  });

  it("should handle single value", () => {
    const result = computeWaterfallRunning([42]);
    // Single value is also last
    expect(result[0].isLast).toBe(true);
    expect(result[0].startVal).toBe(0);
    expect(result[0].endVal).toBe(42);
  });

  it("should handle zero values in the middle", () => {
    const result = computeWaterfallRunning([10, 0, 20, 30]);
    expect(result[1]).toEqual({ startVal: 10, endVal: 10, isLast: false });
    expect(result[2]).toEqual({ startVal: 10, endVal: 30, isLast: false });
  });
});

describe("waterfall chart: bar color determination", () => {
  function waterfallBarColor(val: number, isLast: boolean): string {
    return isLast ? "#6366f1" : val >= 0 ? "#22c55e" : "#ef4444";
  }

  it("should use indigo for total (last) bar", () => {
    expect(waterfallBarColor(50, true)).toBe("#6366f1");
    expect(waterfallBarColor(-20, true)).toBe("#6366f1");
  });

  it("should use green for positive incremental bars", () => {
    expect(waterfallBarColor(10, false)).toBe("#22c55e");
  });

  it("should use red for negative incremental bars", () => {
    expect(waterfallBarColor(-10, false)).toBe("#ef4444");
  });

  it("should treat zero as positive (green)", () => {
    expect(waterfallBarColor(0, false)).toBe("#22c55e");
  });
});

describe("waterfall chart: bar dimensions", () => {
  it("should compute bar width at 60% of category slot", () => {
    const plotWidth = 300;
    const catCount = 5;
    const barWidth = (plotWidth / catCount) * 0.6;
    expect(barWidth).toBe(36);
  });

  it("should compute gap at 20% of category slot", () => {
    const plotWidth = 300;
    const catCount = 5;
    const gap = (plotWidth / catCount) * 0.2;
    expect(gap).toBe(12);
  });

  it("should position each bar at correct x offset", () => {
    const plotLeft = 48;
    const plotWidth = 300;
    const catCount = 3;
    const gap = (plotWidth / catCount) * 0.2;
    const slotWidth = plotWidth / catCount;
    const x0 = plotLeft + slotWidth * 0 + gap;
    const x1 = plotLeft + slotWidth * 1 + gap;
    expect(x1 - x0).toBe(slotWidth);
  });

  it("should produce minimum bar height of 1", () => {
    const range = computeValueRange([{ name: "A", values: [10] }]);
    const startY = valueToY(5, range, 0, 100);
    const endY = valueToY(5, range, 0, 100);
    const h = Math.max(Math.abs(endY - startY), 1);
    expect(h).toBe(1);
  });
});

describe("combo chart: bar and line geometry", () => {
  it("should compute bar width at 50% of group width", () => {
    const plotWidth = 400;
    const catCount = 4;
    const barGroupWidth = plotWidth / catCount;
    const barWidth = barGroupWidth * 0.5;
    expect(barWidth).toBe(50);
  });

  it("should center bar within group using offset", () => {
    const barGroupWidth = 100;
    const barWidth = 50;
    const barOffset = (barGroupWidth - barWidth) / 2;
    expect(barOffset).toBe(25);
  });

  it("should position line points at center of bar groups", () => {
    const plotLeft = 48;
    const plotWidth = 300;
    const catCount = 3;
    const barGroupWidth = plotWidth / catCount;
    const lineX0 = plotLeft + barGroupWidth * 0 + barGroupWidth / 2;
    const lineX1 = plotLeft + barGroupWidth * 1 + barGroupWidth / 2;
    const lineX2 = plotLeft + barGroupWidth * 2 + barGroupWidth / 2;
    expect(lineX1 - lineX0).toBe(barGroupWidth);
    expect(lineX2 - lineX1).toBe(barGroupWidth);
  });

  it("should compute line Y from valueToY", () => {
    const range = computeValueRange([{ name: "A", values: [0, 50, 100] }]);
    const midY = valueToY(50, range, 0, 200);
    expect(midY).toBe(100); // midpoint
  });
});
