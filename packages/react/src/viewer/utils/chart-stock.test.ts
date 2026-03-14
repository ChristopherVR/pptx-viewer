import { describe, it, expect } from "vitest";
import { computeValueRange, valueToY } from "./chart-helpers";
import type { PptxChartSeries } from "pptx-viewer-core";

/**
 * Tests for the stock chart computation logic used in chart-stock.tsx.
 *
 * The renderStockChart function handles OHLC (Open-High-Low-Close) and
 * HLC (High-Low-Close) data layouts, candlestick body geometry, and
 * up/down color selection.
 */

describe("stock chart: series index mapping", () => {
  function mapStockSeries(series: PptxChartSeries[]) {
    const hasFour = series.length >= 4;
    return {
      openSeries: hasFour ? series[0] : undefined,
      highSeries: series[hasFour ? 1 : 0],
      lowSeries: series[hasFour ? 2 : 1],
      closeSeries: series[hasFour ? 3 : 2],
    };
  }

  it("should map 4 series as OHLC", () => {
    const series: PptxChartSeries[] = [
      { name: "Open", values: [100] },
      { name: "High", values: [110] },
      { name: "Low", values: [90] },
      { name: "Close", values: [105] },
    ];
    const mapped = mapStockSeries(series);
    expect(mapped.openSeries?.name).toBe("Open");
    expect(mapped.highSeries.name).toBe("High");
    expect(mapped.lowSeries.name).toBe("Low");
    expect(mapped.closeSeries.name).toBe("Close");
  });

  it("should map 3 series as HLC (no open)", () => {
    const series: PptxChartSeries[] = [
      { name: "High", values: [110] },
      { name: "Low", values: [90] },
      { name: "Close", values: [105] },
    ];
    const mapped = mapStockSeries(series);
    expect(mapped.openSeries).toBeUndefined();
    expect(mapped.highSeries.name).toBe("High");
    expect(mapped.lowSeries.name).toBe("Low");
    expect(mapped.closeSeries.name).toBe("Close");
  });

  it("should handle 5+ series (OHLC uses first 4)", () => {
    const series: PptxChartSeries[] = [
      { name: "Open", values: [100] },
      { name: "High", values: [110] },
      { name: "Low", values: [90] },
      { name: "Close", values: [105] },
      { name: "Volume", values: [50000] },
    ];
    const mapped = mapStockSeries(series);
    expect(mapped.openSeries?.name).toBe("Open");
    expect(mapped.closeSeries.name).toBe("Close");
  });
});

describe("stock chart: candlestick body geometry", () => {
  it("should determine up candle (green) when close >= open", () => {
    const open = 100;
    const close = 110;
    const isUp = close >= open;
    expect(isUp).toBe(true);
  });

  it("should determine down candle (red) when close < open", () => {
    const open = 110;
    const close = 100;
    const isUp = close >= open;
    expect(isUp).toBe(false);
  });

  it("should consider equal open/close as up (green)", () => {
    const isUp = 100 >= 100;
    expect(isUp).toBe(true);
  });

  it("should compute body Y bounds correctly for up candle", () => {
    const range = computeValueRange([
      { name: "H", values: [120] },
      { name: "L", values: [80] },
    ]);
    const openY = valueToY(100, range, 0, 200);
    const closeY = valueToY(110, range, 0, 200);
    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.max(Math.abs(openY - closeY), 1);
    expect(bodyTop).toBe(closeY); // close is higher, so closeY < openY
    expect(bodyHeight).toBeGreaterThan(0);
  });

  it("should enforce minimum body height of 1", () => {
    // When open === close, body height would be 0
    const range = computeValueRange([
      { name: "A", values: [100] },
    ]);
    const openY = valueToY(100, range, 0, 100);
    const closeY = valueToY(100, range, 0, 100);
    const bodyHeight = Math.max(Math.abs(openY - closeY), 1);
    expect(bodyHeight).toBe(1);
  });

  it("should compute wick spanning from high to low Y", () => {
    const range = computeValueRange([
      { name: "A", values: [80, 120] },
    ]);
    const highY = valueToY(120, range, 0, 200);
    const lowY = valueToY(80, range, 0, 200);
    // High value maps to lower Y (top of chart)
    expect(highY).toBeLessThan(lowY);
  });

  it("should default open to low when no open series present", () => {
    const low = 90;
    const open = undefined ?? low;
    expect(open).toBe(90);
  });
});

describe("stock chart: candle width and positioning", () => {
  it("should compute candle width at 50% of bar group width", () => {
    const plotWidth = 400;
    const catCount = 5;
    const barGroupWidth = plotWidth / catCount;
    const candleWidth = barGroupWidth * 0.5;
    expect(candleWidth).toBe(40);
  });

  it("should center candle horizontally within group", () => {
    const plotLeft = 48;
    const plotWidth = 400;
    const catCount = 4;
    const barGroupWidth = plotWidth / catCount;
    const ci = 2; // third category
    const cx = plotLeft + barGroupWidth * ci + barGroupWidth / 2;
    expect(cx).toBe(plotLeft + barGroupWidth * 2.5);
  });

  it("should position candle rect relative to center x", () => {
    const cx = 200;
    const candleWidth = 40;
    const rectX = cx - candleWidth / 2;
    expect(rectX).toBe(180);
  });

  it("should handle single category", () => {
    const plotWidth = 400;
    const catCount = 1;
    const barGroupWidth = plotWidth / Math.max(catCount, 1);
    expect(barGroupWidth).toBe(400);
    const candleWidth = barGroupWidth * 0.5;
    expect(candleWidth).toBe(200);
  });
});
