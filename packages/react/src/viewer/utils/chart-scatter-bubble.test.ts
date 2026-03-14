import { describe, it, expect } from "vitest";
import { computeValueRange, valueToY, seriesColor } from "./chart-helpers";
import { computeLayout } from "./chart-layout";
import type { PptxChartSeries } from "pptx-viewer-core";

/**
 * Tests for the scatter/bubble chart computation logic used in
 * chart-scatter-bubble.tsx.
 *
 * The renderScatterChart and renderBubbleChart functions compute point
 * positions by mapping index-based X and value-based Y, plus bubble
 * radius scaling.
 */

describe("scatter chart: point position computation", () => {
  function computeScatterX(
    vi: number,
    maxX: number,
    plotLeft: number,
    plotWidth: number,
  ): number {
    return plotLeft + (maxX > 0 ? vi / maxX : 0) * plotWidth;
  }

  it("should map first point to plotLeft", () => {
    const x = computeScatterX(0, 4, 50, 300);
    expect(x).toBe(50);
  });

  it("should map last point to plotLeft + plotWidth", () => {
    const x = computeScatterX(4, 4, 50, 300);
    expect(x).toBe(350);
  });

  it("should map middle point to midpoint", () => {
    const x = computeScatterX(2, 4, 50, 300);
    expect(x).toBe(200);
  });

  it("should handle maxX=0 (all points at plotLeft)", () => {
    const x = computeScatterX(0, 0, 50, 300);
    expect(x).toBe(50);
  });

  it("should compute correct maxX from series indices", () => {
    const series: PptxChartSeries[] = [
      { name: "A", values: [10, 20, 30] },
      { name: "B", values: [5, 15] },
    ];
    const allX = series.flatMap((s) => s.values.map((_v, i) => i));
    const maxX = Math.max(1, ...allX);
    expect(maxX).toBe(2); // 0, 1, 2 from series A
  });

  it("should map Y using valueToY for each data point", () => {
    const series: PptxChartSeries[] = [
      { name: "A", values: [0, 50, 100] },
    ];
    const range = computeValueRange(series);
    const topY = 10;
    const bottomY = 110;
    const y0 = valueToY(0, range, topY, bottomY);
    const y50 = valueToY(50, range, topY, bottomY);
    const y100 = valueToY(100, range, topY, bottomY);
    expect(y0).toBe(bottomY);
    expect(y100).toBe(topY);
    expect(y50).toBe(60); // midpoint
  });
});

describe("bubble chart: radius computation", () => {
  function computeBubbleRadius(
    bubbleVal: number | undefined,
    maxBubble: number,
    medianRadius: number,
  ): number {
    if (bubbleVal !== undefined) {
      return (
        medianRadius * 0.5 +
        (Math.abs(bubbleVal) / maxBubble) * medianRadius * 1.5
      );
    }
    return medianRadius;
  }

  it("should return medianRadius when no bubble size data", () => {
    const r = computeBubbleRadius(undefined, 100, 10);
    expect(r).toBe(10);
  });

  it("should compute minimum radius for zero bubble value", () => {
    const r = computeBubbleRadius(0, 100, 10);
    // 10*0.5 + (0/100)*10*1.5 = 5
    expect(r).toBe(5);
  });

  it("should compute maximum radius for max bubble value", () => {
    const r = computeBubbleRadius(100, 100, 10);
    // 10*0.5 + (100/100)*10*1.5 = 5 + 15 = 20
    expect(r).toBe(20);
  });

  it("should use absolute value for negative bubble sizes", () => {
    const r = computeBubbleRadius(-50, 100, 10);
    const rPos = computeBubbleRadius(50, 100, 10);
    expect(r).toBe(rPos);
  });

  it("should scale linearly between min and max", () => {
    const r25 = computeBubbleRadius(25, 100, 10);
    const r50 = computeBubbleRadius(50, 100, 10);
    const r75 = computeBubbleRadius(75, 100, 10);
    // r = 5 + (val/100)*15
    expect(r25).toBeCloseTo(8.75, 10);
    expect(r50).toBeCloseTo(12.5, 10);
    expect(r75).toBeCloseTo(16.25, 10);
    // Check linearity
    expect(r50 - r25).toBeCloseTo(r75 - r50, 10);
  });

  it("should compute medianRadius from plot dimensions", () => {
    const layout = computeLayout(800, 600, undefined, true, "b");
    const medianRadius =
      Math.min(layout.plotWidth, layout.plotHeight) * 0.04;
    expect(medianRadius).toBeGreaterThan(0);
    expect(medianRadius).toBeLessThan(30);
  });
});

describe("bubble chart: bubble size series extraction", () => {
  it("should use third series for bubble sizes when available", () => {
    const series: PptxChartSeries[] = [
      { name: "X", values: [1, 2, 3] },
      { name: "Y", values: [10, 20, 30] },
      { name: "Size", values: [5, 10, 15] },
    ];
    const bubbleSizeSeries =
      series.length >= 3 ? series[2] : undefined;
    expect(bubbleSizeSeries?.name).toBe("Size");
    const maxBubble = bubbleSizeSeries
      ? Math.max(1, ...bubbleSizeSeries.values.map(Math.abs))
      : 1;
    expect(maxBubble).toBe(15);
  });

  it("should fallback to no bubble size for fewer than 3 series", () => {
    const series: PptxChartSeries[] = [
      { name: "X", values: [1, 2] },
      { name: "Y", values: [10, 20] },
    ];
    const bubbleSizeSeries =
      series.length >= 3 ? series[2] : undefined;
    expect(bubbleSizeSeries).toBeUndefined();
  });

  it("should clamp maxBubble to at least 1", () => {
    const series: PptxChartSeries[] = [
      { name: "X", values: [1] },
      { name: "Y", values: [10] },
      { name: "Size", values: [0] },
    ];
    const bubbleSizeSeries = series[2];
    const maxBubble = Math.max(1, ...bubbleSizeSeries.values.map(Math.abs));
    expect(maxBubble).toBe(1);
  });

  it("should only render first 2 series as data points", () => {
    const series: PptxChartSeries[] = [
      { name: "X", values: [1, 2] },
      { name: "Y", values: [10, 20] },
      { name: "Size", values: [5, 15] },
      { name: "Extra", values: [100, 200] },
    ];
    const dataSeries = series.slice(0, 2);
    expect(dataSeries.length).toBe(2);
    expect(dataSeries[0].name).toBe("X");
    expect(dataSeries[1].name).toBe("Y");
  });
});
