import { describe, it, expect } from "vitest";
import type {
  PptxChartData,
  PptxChartSeries,
  PptxChartAxisFormatting,
  PptxChartDataTable,
  PptxChartStyle,
} from "pptx-viewer-core";
import {
  computeLayout,
  computeLayoutOptions,
  hasSecondaryValueAxis,
  hasSecondaryCategoryAxis,
  getSecondaryValueAxis,
  getSecondaryCategoryAxis,
} from "./chart-layout";
import {
  computeValueRange,
  valueToY,
  formatAxisValue,
} from "./chart-helpers";
import {
  getSecondarySeriesIndices,
  computeSecondaryRange,
} from "./chart-chrome";

// ── Helpers ─────────────────────────────────────────────────────

function makeAxis(
  axisType: PptxChartAxisFormatting["axisType"],
  axPos: PptxChartAxisFormatting["axPos"],
  axisId?: number,
  crossAxisId?: number,
): PptxChartAxisFormatting {
  return { axisType, axPos, axisId, crossAxisId };
}

function makeChartData(
  overrides: Partial<PptxChartData> = {},
): PptxChartData {
  return {
    chartType: "bar",
    categories: ["A", "B", "C"],
    series: [
      { name: "S1", values: [10, 20, 30] },
      { name: "S2", values: [5, 15, 25] },
    ],
    ...overrides,
  };
}

// =================================================================
// 1. SECONDARY AXIS DETECTION
// =================================================================

describe("hasSecondaryValueAxis", () => {
  it("returns false when axes is undefined", () => {
    expect(hasSecondaryValueAxis(undefined)).toBe(false);
  });

  it("returns false when only primary axes exist", () => {
    const axes = [makeAxis("catAx", "b"), makeAxis("valAx", "l")];
    expect(hasSecondaryValueAxis(axes)).toBe(false);
  });

  it("returns true when valAx at position r exists", () => {
    const axes = [makeAxis("valAx", "l"), makeAxis("valAx", "r")];
    expect(hasSecondaryValueAxis(axes)).toBe(true);
  });

  it("does not treat catAx at position r as secondary value axis", () => {
    expect(hasSecondaryValueAxis([makeAxis("catAx", "r")])).toBe(false);
  });
});

describe("hasSecondaryCategoryAxis", () => {
  it("returns false with only bottom category axis", () => {
    expect(hasSecondaryCategoryAxis([makeAxis("catAx", "b")])).toBe(false);
  });

  it("returns true when catAx at position t exists", () => {
    const axes = [makeAxis("catAx", "b"), makeAxis("catAx", "t")];
    expect(hasSecondaryCategoryAxis(axes)).toBe(true);
  });

  it("returns true when dateAx at position t exists", () => {
    expect(hasSecondaryCategoryAxis([makeAxis("dateAx", "t")])).toBe(true);
  });
});

describe("getSecondaryValueAxis", () => {
  it("returns undefined when no secondary axis present", () => {
    expect(getSecondaryValueAxis([makeAxis("valAx", "l")])).toBeUndefined();
  });

  it("returns the secondary axis object with its properties", () => {
    const secondary = makeAxis("valAx", "r", 200, 100);
    secondary.titleText = "Secondary Y";
    const result = getSecondaryValueAxis([makeAxis("valAx", "l", 100), secondary]);
    expect(result).toBeDefined();
    expect(result!.axPos).toBe("r");
    expect(result!.axisId).toBe(200);
    expect(result!.titleText).toBe("Secondary Y");
  });
});

describe("getSecondaryCategoryAxis", () => {
  it("returns the secondary category axis at position t", () => {
    const axes = [makeAxis("catAx", "b", 100), makeAxis("catAx", "t", 300)];
    const result = getSecondaryCategoryAxis(axes);
    expect(result).toBeDefined();
    expect(result!.axPos).toBe("t");
  });
});

// =================================================================
// 2. LAYOUT OPTIONS COMPUTATION
// =================================================================

describe("computeLayoutOptions", () => {
  it("returns all false when no secondary axes or data table", () => {
    const opts = computeLayoutOptions(undefined, undefined, 2);
    expect(opts.hasSecondaryValueAxis).toBe(false);
    expect(opts.hasSecondaryCategoryAxis).toBe(false);
    expect(opts.hasDataTable).toBe(false);
  });

  it("detects secondary value axis from axes array", () => {
    const axes = [makeAxis("valAx", "l"), makeAxis("valAx", "r")];
    const opts = computeLayoutOptions(axes, undefined, 2);
    expect(opts.hasSecondaryValueAxis).toBe(true);
  });

  it("sets hasDataTable and dataTableRowCount when data table present", () => {
    const dt: PptxChartDataTable = { showHorzBorder: true };
    const opts = computeLayoutOptions(undefined, dt, 3);
    expect(opts.hasDataTable).toBe(true);
    expect(opts.dataTableRowCount).toBe(3);
  });

  it("handles both secondary axis and data table together", () => {
    const axes = [makeAxis("valAx", "r"), makeAxis("catAx", "t")];
    const dt: PptxChartDataTable = {};
    const opts = computeLayoutOptions(axes, dt, 4);
    expect(opts.hasSecondaryValueAxis).toBe(true);
    expect(opts.hasSecondaryCategoryAxis).toBe(true);
    expect(opts.hasDataTable).toBe(true);
    expect(opts.dataTableRowCount).toBe(4);
  });
});

// =================================================================
// 3. LAYOUT WITH SECONDARY AXES AND DATA TABLE
// =================================================================

describe("computeLayout with secondary axes and data table", () => {
  it("reduces plotRight by 40 for secondary value axis", () => {
    const base = computeLayout(800, 600, undefined, true, "b");
    const withSec = computeLayout(800, 600, undefined, true, "b", {
      hasSecondaryValueAxis: true,
    });
    expect(base.plotRight - withSec.plotRight).toBe(40);
  });

  it("increases plotTop by 16 for secondary category axis", () => {
    const base = computeLayout(800, 600, undefined, true, "b");
    const withSec = computeLayout(800, 600, undefined, true, "b", {
      hasSecondaryCategoryAxis: true,
    });
    expect(withSec.plotTop - base.plotTop).toBe(16);
  });

  it("reduces plotBottom for data table based on row count", () => {
    const base = computeLayout(800, 600, undefined, true, "b");
    const withTable = computeLayout(800, 600, undefined, true, "b", {
      hasDataTable: true,
      dataTableRowCount: 3,
    });
    expect(base.plotBottom - withTable.plotBottom).toBe(14 + 3 * 14);
  });

  it("uses default row count of 1 when not specified", () => {
    const base = computeLayout(800, 600, undefined, true, "b");
    const withTable = computeLayout(800, 600, undefined, true, "b", {
      hasDataTable: true,
    });
    expect(base.plotBottom - withTable.plotBottom).toBe(28);
  });

  it("combines all adjustments while preserving minimum plot area", () => {
    const full = computeLayout(800, 600, undefined, true, "b", {
      hasSecondaryValueAxis: true,
      hasSecondaryCategoryAxis: true,
      hasDataTable: true,
      dataTableRowCount: 2,
    });
    expect(full.plotWidth).toBeGreaterThanOrEqual(1);
    expect(full.plotHeight).toBeGreaterThanOrEqual(1);
  });

  it("does not affect layout when all options are false", () => {
    const base = computeLayout(800, 600, undefined, true, "b");
    const same = computeLayout(800, 600, undefined, true, "b", {
      hasSecondaryValueAxis: false,
      hasSecondaryCategoryAxis: false,
      hasDataTable: false,
    });
    expect(same.plotLeft).toBe(base.plotLeft);
    expect(same.plotRight).toBe(base.plotRight);
    expect(same.plotTop).toBe(base.plotTop);
    expect(same.plotBottom).toBe(base.plotBottom);
  });
});

// =================================================================
// 4. SECONDARY SERIES IDENTIFICATION
// =================================================================

describe("getSecondarySeriesIndices", () => {
  it("returns empty array when no axes defined", () => {
    expect(getSecondarySeriesIndices(makeChartData())).toEqual([]);
  });

  it("returns empty when no secondary value axis", () => {
    const data = makeChartData({ axes: [makeAxis("valAx", "l", 100)] });
    expect(getSecondarySeriesIndices(data)).toEqual([]);
  });

  it("identifies series by matching axisId to secondary axis", () => {
    const data = makeChartData({
      series: [
        { name: "Primary", values: [10, 20], axisId: 100 },
        { name: "Secondary", values: [50, 60], axisId: 200 },
      ],
      axes: [makeAxis("valAx", "l", 100), makeAxis("valAx", "r", 200)],
    });
    expect(getSecondarySeriesIndices(data)).toEqual([1]);
  });

  it("identifies multiple secondary series", () => {
    const data = makeChartData({
      series: [
        { name: "S1", values: [10], axisId: 100 },
        { name: "S2", values: [50], axisId: 200 },
        { name: "S3", values: [70], axisId: 200 },
      ],
      axes: [makeAxis("valAx", "l", 100), makeAxis("valAx", "r", 200)],
    });
    expect(getSecondarySeriesIndices(data)).toEqual([1, 2]);
  });

  it("uses heuristic fallback for series without axisId", () => {
    const data = makeChartData({
      series: [
        { name: "S1", values: [10] },
        { name: "S2", values: [50] },
        { name: "S3", values: [70] },
        { name: "S4", values: [90] },
      ],
      axes: [makeAxis("valAx", "l"), makeAxis("valAx", "r")],
    });
    // ceil(4/2)=2, so indices 2 and 3
    expect(getSecondarySeriesIndices(data)).toEqual([2, 3]);
  });

  it("does not use heuristic for single series", () => {
    const data = makeChartData({
      series: [{ name: "S1", values: [10] }],
      axes: [makeAxis("valAx", "l"), makeAxis("valAx", "r")],
    });
    expect(getSecondarySeriesIndices(data)).toEqual([]);
  });
});

// =================================================================
// 5. SECONDARY VALUE RANGE
// =================================================================

describe("computeSecondaryRange", () => {
  const allSeries: PptxChartSeries[] = [
    { name: "S1", values: [10, 20, 30] },
    { name: "S2", values: [100, 200, 300] },
    { name: "S3", values: [50, 150, 250] },
  ];

  it("computes range for specified series indices only", () => {
    const range = computeSecondaryRange(allSeries, [1, 2]);
    expect(range.min).toBe(0);
    expect(range.max).toBe(300);
    expect(range.span).toBe(300);
  });

  it("returns default range for empty indices", () => {
    expect(computeSecondaryRange(allSeries, [])).toEqual({ min: 0, max: 1, span: 1 });
  });

  it("handles negative values in secondary series", () => {
    const series: PptxChartSeries[] = [
      { name: "S1", values: [10] },
      { name: "S2", values: [-50, 100] },
    ];
    const range = computeSecondaryRange(series, [1]);
    expect(range.min).toBe(-50);
    expect(range.max).toBe(100);
    expect(range.span).toBe(150);
  });
});

// =================================================================
// 6. DATA TABLE INTEGRATION WITH LAYOUT
// =================================================================

describe("data table layout integration", () => {
  it("reduces available chart height when data table is present", () => {
    const without = computeLayout(800, 600, undefined, true, "b");
    const with_ = computeLayout(800, 600, undefined, true, "b", {
      hasDataTable: true,
      dataTableRowCount: 3,
    });
    expect(with_.plotHeight).toBeLessThan(without.plotHeight);
  });

  it("scales data table height with series count", () => {
    const with2 = computeLayout(800, 600, undefined, true, "b", {
      hasDataTable: true,
      dataTableRowCount: 2,
    });
    const with5 = computeLayout(800, 600, undefined, true, "b", {
      hasDataTable: true,
      dataTableRowCount: 5,
    });
    expect(with2.plotBottom - with5.plotBottom).toBe(42);
  });

  it("still leaves positive plot area for large data table", () => {
    const layout = computeLayout(800, 400, undefined, true, "b", {
      hasDataTable: true,
      dataTableRowCount: 10,
    });
    expect(layout.plotWidth).toBeGreaterThanOrEqual(1);
    expect(layout.plotHeight).toBeGreaterThanOrEqual(1);
  });
});

// =================================================================
// 7. AXIS ID AND CROSS-AXIS LINKING
// =================================================================

describe("axis ID and cross-axis linking", () => {
  it("links primary and secondary axes via cross references", () => {
    const primary = makeAxis("valAx", "l", 100, 200);
    const secondary = makeAxis("valAx", "r", 200, 100);
    expect(primary.crossAxisId).toBe(secondary.axisId);
    expect(secondary.crossAxisId).toBe(primary.axisId);
  });

  it("links category and value axes correctly", () => {
    const cat = makeAxis("catAx", "b", 300, 100);
    const val = makeAxis("valAx", "l", 100, 300);
    expect(cat.crossAxisId).toBe(val.axisId);
    expect(val.crossAxisId).toBe(cat.axisId);
  });
});

// =================================================================
// 8. SECONDARY AXIS Y-COORDINATE MAPPING
// =================================================================

describe("secondary axis Y-coordinate mapping", () => {
  it("maps different ranges to same visual space correctly", () => {
    const primaryRange = { min: 0, max: 100, span: 100 };
    const secondaryRange = { min: 0, max: 1000, span: 1000 };
    const topY = 10;
    const bottomY = 110;

    // Primary 50% = 50, Secondary 50% = 500
    expect(valueToY(50, primaryRange, topY, bottomY)).toBe(60);
    expect(valueToY(500, secondaryRange, topY, bottomY)).toBe(60);
  });

  it("positions secondary axis labels to the right of plotRight", () => {
    const layout = computeLayout(800, 600, undefined, true, "b", {
      hasSecondaryValueAxis: true,
    });
    const labelX = layout.plotRight + 4;
    expect(labelX).toBeGreaterThan(layout.plotRight);
    expect(labelX).toBeLessThan(layout.svgWidth);
  });
});

// =================================================================
// 9. INTEGRATION: FULL CHART DATA FLOW
// =================================================================

describe("full chart data integration", () => {
  it("detects secondary axes and data table from chart data", () => {
    const data = makeChartData({
      axes: [
        makeAxis("catAx", "b"),
        makeAxis("valAx", "l"),
        makeAxis("catAx", "t"),
        makeAxis("valAx", "r"),
      ],
      dataTable: { showHorzBorder: true, showVertBorder: true },
    });
    const opts = computeLayoutOptions(data.axes, data.dataTable, data.series.length);
    expect(opts.hasSecondaryValueAxis).toBe(true);
    expect(opts.hasSecondaryCategoryAxis).toBe(true);
    expect(opts.hasDataTable).toBe(true);
    expect(opts.dataTableRowCount).toBe(2);
  });

  it("handles chart data with no axes or data table", () => {
    const opts = computeLayoutOptions(undefined, undefined, 2);
    expect(opts.hasSecondaryValueAxis).toBe(false);
    expect(opts.hasDataTable).toBe(false);
  });
});
