import { describe, it, expect } from "vitest";
import type {
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
  getSecondaryValueAxisId,
  getPrimaryValueAxisId,
  isSeriesOnSecondaryAxis,
  splitSeriesByAxis,
  computeDataTableHeight,
  type LayoutOptions,
} from "./chart-layout";
import { computeValueRange, valueToY } from "./chart-helpers";
import type { PptxChartSeries } from "pptx-viewer-core";

// ── Test data factories ─────────────────────────────────────────

function makePrimaryValueAxis(overrides?: Partial<PptxChartAxisFormatting>): PptxChartAxisFormatting {
  return { axisType: "valAx", axPos: "l", axisId: 100, ...overrides };
}

function makeSecondaryValueAxis(overrides?: Partial<PptxChartAxisFormatting>): PptxChartAxisFormatting {
  return { axisType: "valAx", axPos: "r", axisId: 200, ...overrides };
}

function makePrimaryCategoryAxis(overrides?: Partial<PptxChartAxisFormatting>): PptxChartAxisFormatting {
  return { axisType: "catAx", axPos: "b", axisId: 300, ...overrides };
}

function makeSecondaryCategoryAxis(overrides?: Partial<PptxChartAxisFormatting>): PptxChartAxisFormatting {
  return { axisType: "catAx", axPos: "t", axisId: 400, ...overrides };
}

function makeSeries(name: string, values: number[], axisId?: number): PptxChartSeries {
  return { name, values, axisId };
}

// ==================================================================
// 1. Secondary Axis Detection
// ==================================================================

describe("hasSecondaryValueAxis", () => {
  it("returns false when axes is undefined or has only primary axes", () => {
    expect(hasSecondaryValueAxis(undefined)).toBe(false);
    expect(hasSecondaryValueAxis([makePrimaryValueAxis()])).toBe(false);
  });

  it("returns true when a valAx has position 'r'", () => {
    expect(hasSecondaryValueAxis([makePrimaryValueAxis(), makeSecondaryValueAxis()])).toBe(true);
  });

  it("does not treat catAx at position 'r' as secondary value axis", () => {
    expect(hasSecondaryValueAxis([{ axisType: "catAx", axPos: "r" }])).toBe(false);
  });
});

describe("hasSecondaryCategoryAxis", () => {
  it("returns false with only bottom category axis", () => {
    expect(hasSecondaryCategoryAxis(undefined)).toBe(false);
    expect(hasSecondaryCategoryAxis([makePrimaryCategoryAxis()])).toBe(false);
  });

  it("returns true for catAx or dateAx at position 't'", () => {
    expect(hasSecondaryCategoryAxis([makeSecondaryCategoryAxis()])).toBe(true);
    expect(hasSecondaryCategoryAxis([{ axisType: "dateAx", axPos: "t" }])).toBe(true);
  });
});

// ==================================================================
// 2. Axis Retrieval and ID Helpers
// ==================================================================

describe("getSecondaryValueAxis and axis ID helpers", () => {
  it("returns undefined when no secondary axis exists", () => {
    expect(getSecondaryValueAxis(undefined)).toBeUndefined();
    expect(getSecondaryValueAxis([makePrimaryValueAxis()])).toBeUndefined();
  });

  it("returns the secondary value axis with its properties", () => {
    const secAxis = makeSecondaryValueAxis({ titleText: "Right Axis" });
    const result = getSecondaryValueAxis([makePrimaryValueAxis(), secAxis]);
    expect(result).toBe(secAxis);
    expect(result?.titleText).toBe("Right Axis");
  });

  it("getSecondaryCategoryAxis returns the top-positioned category axis", () => {
    const secCat = makeSecondaryCategoryAxis();
    expect(getSecondaryCategoryAxis([makePrimaryCategoryAxis(), secCat])).toBe(secCat);
  });

  it("getSecondaryValueAxisId returns the axisId of the secondary value axis", () => {
    expect(getSecondaryValueAxisId(undefined)).toBeUndefined();
    expect(getSecondaryValueAxisId([makePrimaryValueAxis(), makeSecondaryValueAxis({ axisId: 999 })])).toBe(999);
  });

  it("getPrimaryValueAxisId returns the axisId of the left value axis", () => {
    expect(getPrimaryValueAxisId(undefined)).toBeUndefined();
    expect(getPrimaryValueAxisId([makePrimaryValueAxis({ axisId: 42 })])).toBe(42);
    // Falls back to first valAx when no 'l' position
    expect(getPrimaryValueAxisId([{ axisType: "valAx", axisId: 77 }])).toBe(77);
  });
});

// ==================================================================
// 3. Series-to-Axis Mapping
// ==================================================================

describe("isSeriesOnSecondaryAxis", () => {
  it("returns false when no secondary axis or no axisId", () => {
    expect(isSeriesOnSecondaryAxis(makeSeries("A", [1]), undefined)).toBe(false);
    expect(isSeriesOnSecondaryAxis(makeSeries("A", [1]), [makePrimaryValueAxis()])).toBe(false);
    expect(isSeriesOnSecondaryAxis(makeSeries("A", [1]), [makePrimaryValueAxis(), makeSecondaryValueAxis()])).toBe(false);
  });

  it("returns true when series axisId matches secondary axis", () => {
    const axes = [makePrimaryValueAxis(), makeSecondaryValueAxis({ axisId: 200 })];
    expect(isSeriesOnSecondaryAxis(makeSeries("A", [1], 200), axes)).toBe(true);
    expect(isSeriesOnSecondaryAxis(makeSeries("B", [2], 100), axes)).toBe(false);
  });
});

describe("splitSeriesByAxis", () => {
  it("puts all series in primary when no secondary axis", () => {
    const { primary, secondary } = splitSeriesByAxis(
      [makeSeries("A", [1]), makeSeries("B", [2])],
      [makePrimaryValueAxis()],
    );
    expect(primary).toHaveLength(2);
    expect(secondary).toHaveLength(0);
  });

  it("splits series correctly by axisId and preserves indices", () => {
    const axes = [makePrimaryValueAxis({ axisId: 100 }), makeSecondaryValueAxis({ axisId: 200 })];
    const series = [
      makeSeries("S0", [1], 200),
      makeSeries("S1", [2], 100),
      makeSeries("S2", [3], 200),
    ];
    const { primary, secondary } = splitSeriesByAxis(series, axes);
    expect(primary).toHaveLength(1);
    expect(primary[0].index).toBe(1);
    expect(secondary).toHaveLength(2);
    expect(secondary[0].index).toBe(0);
    expect(secondary[1].index).toBe(2);
  });

  it("puts all series in primary when axes is undefined", () => {
    const { primary, secondary } = splitSeriesByAxis(
      [makeSeries("A", [1]), makeSeries("B", [2])],
      undefined,
    );
    expect(primary).toHaveLength(2);
    expect(secondary).toHaveLength(0);
  });
});

// ==================================================================
// 4. Secondary Axis Value Range
// ==================================================================

describe("secondary axis value range computation", () => {
  it("computes independent ranges for primary and secondary series", () => {
    const primaryRange = computeValueRange([makeSeries("Revenue", [100, 200, 300])]);
    const secondaryRange = computeValueRange([makeSeries("Growth %", [5, 10, 15])]);
    expect(primaryRange.max).toBe(300);
    expect(secondaryRange.max).toBe(15);
  });

  it("maps equivalent fractional positions to same Y coordinate", () => {
    const primaryRange = { min: 0, max: 100, span: 100 };
    const secondaryRange = { min: 0, max: 1000, span: 1000 };
    expect(valueToY(50, primaryRange, 10, 110)).toBe(valueToY(500, secondaryRange, 10, 110));
  });

  it("maps same value differently on different ranges", () => {
    const primaryRange = { min: 0, max: 1000, span: 1000 };
    const secondaryRange = { min: 0, max: 100, span: 100 };
    const y1 = valueToY(50, primaryRange, 10, 210);
    const y2 = valueToY(50, secondaryRange, 10, 210);
    expect(y1).toBeGreaterThan(y2);
  });
});

// ==================================================================
// 5. Layout with Secondary Axes
// ==================================================================

describe("computeLayout with secondary axes", () => {
  it("reserves right margin (40px) for secondary value axis", () => {
    const base = computeLayout(800, 600, undefined, true, "b");
    const withSec = computeLayout(800, 600, undefined, true, "b", { hasSecondaryValueAxis: true });
    expect(base.plotRight - withSec.plotRight).toBe(40);
  });

  it("reserves top margin (16px) for secondary category axis", () => {
    const base = computeLayout(800, 600, undefined, true, "b");
    const withSec = computeLayout(800, 600, undefined, true, "b", { hasSecondaryCategoryAxis: true });
    expect(withSec.plotTop - base.plotTop).toBe(16);
  });

  it("does not affect layout when all options are false/undefined", () => {
    const base = computeLayout(800, 600, undefined, true, "b");
    const same = computeLayout(800, 600, undefined, true, "b", {
      hasSecondaryValueAxis: false,
      hasSecondaryCategoryAxis: false,
      hasDataTable: false,
    });
    expect(same).toEqual(base);
  });
});

// ==================================================================
// 6. computeLayoutOptions
// ==================================================================

describe("computeLayoutOptions", () => {
  it("returns all false when no secondary axes or data table", () => {
    const opts = computeLayoutOptions(undefined, undefined, 2);
    expect(opts.hasSecondaryValueAxis).toBe(false);
    expect(opts.hasSecondaryCategoryAxis).toBe(false);
    expect(opts.hasDataTable).toBe(false);
  });

  it("detects secondary axes and data table from chart data", () => {
    const axes = [makeSecondaryValueAxis(), makeSecondaryCategoryAxis()];
    const dt: PptxChartDataTable = {};
    const opts = computeLayoutOptions(axes, dt, 4);
    expect(opts.hasSecondaryValueAxis).toBe(true);
    expect(opts.hasSecondaryCategoryAxis).toBe(true);
    expect(opts.hasDataTable).toBe(true);
    expect(opts.dataTableRowCount).toBe(4);
  });
});

// ==================================================================
// 7. Data Table Layout
// ==================================================================

describe("data table layout", () => {
  it("reserves space based on row count (header + rows * 14)", () => {
    const base = computeLayout(800, 600, undefined, true, "b");
    const with3 = computeLayout(800, 600, undefined, true, "b", { hasDataTable: true, dataTableRowCount: 3 });
    expect(base.plotBottom - with3.plotBottom).toBe(14 + 3 * 14);
  });

  it("defaults to 1 row (28px) when dataTableRowCount is not specified", () => {
    const base = computeLayout(800, 600, undefined, true, "b");
    const withDef = computeLayout(800, 600, undefined, true, "b", { hasDataTable: true });
    expect(base.plotBottom - withDef.plotBottom).toBe(28);
  });

  it("scales reserved space linearly with row count", () => {
    const with2 = computeLayout(800, 600, undefined, true, "b", { hasDataTable: true, dataTableRowCount: 2 });
    const with5 = computeLayout(800, 600, undefined, true, "b", { hasDataTable: true, dataTableRowCount: 5 });
    expect(with2.plotBottom - with5.plotBottom).toBe(3 * 14);
  });
});

describe("computeDataTableHeight", () => {
  it("returns 0 when dataTable is undefined", () => {
    expect(computeDataTableHeight(undefined, 3)).toBe(0);
  });

  it("computes height = 14 + seriesCount * 14", () => {
    const dt: PptxChartDataTable = {};
    expect(computeDataTableHeight(dt, 3)).toBe(56);
    expect(computeDataTableHeight(dt, 0)).toBe(28); // min 1 row
  });
});

// ==================================================================
// 8. Data Table Border Configuration
// ==================================================================

describe("data table border configuration", () => {
  it("allows toggling flags and defaults undefined (treated as true)", () => {
    const custom: PptxChartDataTable = { showHorzBorder: false, showVertBorder: true, showOutline: true, showKeys: false };
    expect(custom.showHorzBorder).toBe(false);
    expect(custom.showKeys).toBe(false);

    const defaults: PptxChartDataTable = {};
    expect(defaults.showHorzBorder).toBeUndefined();
    expect(defaults.showVertBorder).toBeUndefined();
    expect(defaults.showOutline).toBeUndefined();
    expect(defaults.showKeys).toBeUndefined();
  });
});

// ==================================================================
// 9. Combined Layout: All Modifiers
// ==================================================================

describe("combined secondary axes + data table + title + legend layout", () => {
  it("handles all layout modifiers simultaneously", () => {
    const style: PptxChartStyle = { hasTitle: true, hasLegend: true };
    const opts: LayoutOptions = {
      hasSecondaryValueAxis: true,
      hasSecondaryCategoryAxis: true,
      hasDataTable: true,
      dataTableRowCount: 3,
    };
    const layout = computeLayout(800, 600, style, true, "b", opts);
    // Title pushes top by 20, sec cat axis by 16
    expect(layout.plotTop).toBeGreaterThanOrEqual(8 + 20 + 16);
    expect(layout.plotWidth).toBeGreaterThanOrEqual(1);
    expect(layout.plotHeight).toBeGreaterThanOrEqual(1);
  });

  it("preserves minimum plot area under extreme configuration", () => {
    const style: PptxChartStyle = { hasTitle: true, hasLegend: true };
    const layout = computeLayout(320, 180, style, true, "b", {
      hasSecondaryValueAxis: true,
      hasSecondaryCategoryAxis: true,
      hasDataTable: true,
      dataTableRowCount: 10,
    });
    expect(layout.plotWidth).toBeGreaterThanOrEqual(1);
    expect(layout.plotHeight).toBeGreaterThanOrEqual(1);
  });
});

// ==================================================================
// 10. Axis Formatting Properties
// ==================================================================

describe("axis formatting properties for secondary axes", () => {
  it("supports min/max, deleted, and font properties", () => {
    const axis = makeSecondaryValueAxis({
      min: 0,
      max: 100,
      deleted: false,
      fontFamily: "Arial",
      fontSize: 10,
      fontBold: true,
      fontColor: "#FF0000",
    });
    expect(axis.min).toBe(0);
    expect(axis.max).toBe(100);
    expect(axis.deleted).toBe(false);
    expect(axis.fontFamily).toBe("Arial");
  });

  it("supports gridline formatting on secondary axis", () => {
    const axis = makeSecondaryValueAxis({
      majorGridlinesSpPr: { strokeColor: "#CCC", strokeWidth: 1 },
      minorGridlinesSpPr: { strokeColor: "#EEE", strokeWidth: 0.5 },
    });
    expect(axis.majorGridlinesSpPr?.strokeColor).toBe("#CCC");
    expect(axis.minorGridlinesSpPr?.strokeWidth).toBe(0.5);
  });
});

// ==================================================================
// 11. Secondary Axis Tick Geometry
// ==================================================================

describe("secondary axis tick geometry", () => {
  it("computes correct tick Y positions across range", () => {
    const range = { min: 0, max: 100, span: 100 };
    const ticks = [0, 1, 2, 3, 4].map((i) => {
      const val = range.min + (range.span * i) / 4;
      return valueToY(val, range, 50, 250);
    });
    expect(ticks[0]).toBe(250); // val=0 at bottom
    expect(ticks[4]).toBe(50);  // val=100 at top
    expect(ticks[2]).toBe(150); // val=50 at midpoint
  });

  it("secondary axis labels are positioned right of plotRight", () => {
    const layout = computeLayout(800, 600, undefined, true, "b", { hasSecondaryValueAxis: true });
    const labelX = layout.plotRight + 4;
    expect(labelX).toBeGreaterThan(layout.plotRight);
    expect(labelX).toBeLessThan(layout.svgWidth);
  });
});
