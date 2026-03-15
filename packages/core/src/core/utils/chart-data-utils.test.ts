import { describe, it, expect } from "vitest";
import type { PptxChartData, PptxChartType } from "../types/chart";
import {
  chartDataAddSeries,
  chartDataRemoveSeries,
  chartDataUpdatePoint,
  chartDataChangeType,
  chartDataAddCategory,
  chartDataRemoveCategory,
} from "./chart-data-utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a standard test chart data object. */
function makeChartData(
  overrides?: Partial<PptxChartData>,
): PptxChartData {
  return {
    chartType: "bar",
    categories: ["Q1", "Q2", "Q3"],
    series: [
      { name: "Revenue", values: [100, 200, 300], color: "#4472C4" },
      { name: "Cost", values: [80, 160, 240], color: "#ED7D31" },
    ],
    title: "Test Chart",
    grouping: "clustered",
    ...overrides,
  };
}

// ===========================================================================
// chartDataAddSeries
// ===========================================================================

describe("chartDataAddSeries", () => {
  it("appends a new series", () => {
    const data = makeChartData();
    const result = chartDataAddSeries(data, {
      name: "Profit",
      values: [20, 40, 60],
    });
    expect(result.series).toHaveLength(3);
    expect(result.series[2].name).toBe("Profit");
    expect(result.series[2].values).toEqual([20, 40, 60]);
  });

  it("preserves the original data (immutable)", () => {
    const data = makeChartData();
    const result = chartDataAddSeries(data, {
      name: "New",
      values: [1, 2, 3],
    });
    expect(data.series).toHaveLength(2);
    expect(result.series).toHaveLength(3);
    expect(data).not.toBe(result);
  });

  it("pads values with zeros when shorter than categories", () => {
    const data = makeChartData(); // 3 categories
    const result = chartDataAddSeries(data, {
      name: "Short",
      values: [10],
    });
    expect(result.series[2].values).toEqual([10, 0, 0]);
  });

  it("truncates values when longer than categories", () => {
    const data = makeChartData(); // 3 categories
    const result = chartDataAddSeries(data, {
      name: "Long",
      values: [10, 20, 30, 40, 50],
    });
    expect(result.series[2].values).toEqual([10, 20, 30]);
  });

  it("preserves color when provided", () => {
    const data = makeChartData();
    const result = chartDataAddSeries(data, {
      name: "Colored",
      values: [1, 2, 3],
      color: "#00FF00",
    });
    expect(result.series[2].color).toBe("#00FF00");
  });

  it("does not set color when omitted", () => {
    const data = makeChartData();
    const result = chartDataAddSeries(data, {
      name: "NoColor",
      values: [1, 2, 3],
    });
    expect(result.series[2].color).toBeUndefined();
  });

  it("accepts empty values when no categories", () => {
    const data = makeChartData({ categories: [] });
    const result = chartDataAddSeries(data, {
      name: "Empty",
      values: [],
    });
    expect(result.series[2].values).toEqual([]);
  });

  it("does not pad values when no categories exist", () => {
    const data = makeChartData({ categories: [] });
    const result = chartDataAddSeries(data, {
      name: "Free",
      values: [10, 20],
    });
    expect(result.series[2].values).toEqual([10, 20]);
  });

  it("preserves all other chart data fields", () => {
    const data = makeChartData({
      title: "My Chart",
      chartPartPath: "ppt/charts/chart1.xml",
      chartRelationshipId: "rId5",
    });
    const result = chartDataAddSeries(data, {
      name: "X",
      values: [1, 2, 3],
    });
    expect(result.title).toBe("My Chart");
    expect(result.chartPartPath).toBe("ppt/charts/chart1.xml");
    expect(result.chartRelationshipId).toBe("rId5");
    expect(result.categories).toEqual(data.categories);
  });
});

// ===========================================================================
// chartDataRemoveSeries
// ===========================================================================

describe("chartDataRemoveSeries", () => {
  it("removes the first series", () => {
    const data = makeChartData();
    const result = chartDataRemoveSeries(data, 0);
    expect(result.series).toHaveLength(1);
    expect(result.series[0].name).toBe("Cost");
  });

  it("removes the last series", () => {
    const data = makeChartData();
    const result = chartDataRemoveSeries(data, 1);
    expect(result.series).toHaveLength(1);
    expect(result.series[0].name).toBe("Revenue");
  });

  it("preserves original data (immutable)", () => {
    const data = makeChartData();
    const result = chartDataRemoveSeries(data, 0);
    expect(data.series).toHaveLength(2);
    expect(result.series).toHaveLength(1);
  });

  it("throws RangeError for negative index", () => {
    const data = makeChartData();
    expect(() => chartDataRemoveSeries(data, -1)).toThrow(RangeError);
  });

  it("throws RangeError for index equal to series length", () => {
    const data = makeChartData();
    expect(() => chartDataRemoveSeries(data, 2)).toThrow(RangeError);
  });

  it("throws RangeError for index beyond series length", () => {
    const data = makeChartData();
    expect(() => chartDataRemoveSeries(data, 100)).toThrow(RangeError);
  });

  it("can remove from a middle position in a 3-series chart", () => {
    const data = chartDataAddSeries(makeChartData(), {
      name: "Third",
      values: [10, 20, 30],
    });
    const result = chartDataRemoveSeries(data, 1);
    expect(result.series).toHaveLength(2);
    expect(result.series[0].name).toBe("Revenue");
    expect(result.series[1].name).toBe("Third");
  });

  it("preserves other chart fields", () => {
    const data = makeChartData({ title: "Keep" });
    const result = chartDataRemoveSeries(data, 0);
    expect(result.title).toBe("Keep");
    expect(result.categories).toEqual(data.categories);
  });
});

// ===========================================================================
// chartDataUpdatePoint
// ===========================================================================

describe("chartDataUpdatePoint", () => {
  it("updates a single data point", () => {
    const data = makeChartData();
    const result = chartDataUpdatePoint(data, 0, 1, 999);
    expect(result.series[0].values).toEqual([100, 999, 300]);
  });

  it("preserves original data (immutable)", () => {
    const data = makeChartData();
    const result = chartDataUpdatePoint(data, 0, 0, 42);
    expect(data.series[0].values[0]).toBe(100);
    expect(result.series[0].values[0]).toBe(42);
  });

  it("does not affect other series", () => {
    const data = makeChartData();
    const result = chartDataUpdatePoint(data, 0, 0, 42);
    expect(result.series[1].values).toEqual([80, 160, 240]);
  });

  it("does not affect other data points in the same series", () => {
    const data = makeChartData();
    const result = chartDataUpdatePoint(data, 1, 2, 500);
    expect(result.series[1].values).toEqual([80, 160, 500]);
    expect(result.series[1].values[0]).toBe(80);
    expect(result.series[1].values[1]).toBe(160);
  });

  it("throws RangeError for invalid series index", () => {
    const data = makeChartData();
    expect(() => chartDataUpdatePoint(data, -1, 0, 1)).toThrow(RangeError);
    expect(() => chartDataUpdatePoint(data, 5, 0, 1)).toThrow(RangeError);
  });

  it("throws RangeError for invalid point index", () => {
    const data = makeChartData();
    expect(() => chartDataUpdatePoint(data, 0, -1, 1)).toThrow(RangeError);
    expect(() => chartDataUpdatePoint(data, 0, 10, 1)).toThrow(RangeError);
  });

  it("can set a value to zero", () => {
    const data = makeChartData();
    const result = chartDataUpdatePoint(data, 0, 0, 0);
    expect(result.series[0].values[0]).toBe(0);
  });

  it("can set a negative value", () => {
    const data = makeChartData();
    const result = chartDataUpdatePoint(data, 0, 0, -50);
    expect(result.series[0].values[0]).toBe(-50);
  });

  it("can set a fractional value", () => {
    const data = makeChartData();
    const result = chartDataUpdatePoint(data, 0, 0, 3.14);
    expect(result.series[0].values[0]).toBeCloseTo(3.14);
  });
});

// ===========================================================================
// chartDataChangeType
// ===========================================================================

describe("chartDataChangeType", () => {
  it("changes chart type from bar to line", () => {
    const data = makeChartData({ chartType: "bar" });
    const result = chartDataChangeType(data, "line");
    expect(result.chartType).toBe("line");
  });

  it("preserves original data (immutable)", () => {
    const data = makeChartData({ chartType: "bar" });
    const result = chartDataChangeType(data, "pie");
    expect(data.chartType).toBe("bar");
    expect(result.chartType).toBe("pie");
  });

  it("preserves series data", () => {
    const data = makeChartData();
    const result = chartDataChangeType(data, "line");
    expect(result.series).toEqual(data.series);
  });

  it("preserves categories", () => {
    const data = makeChartData();
    const result = chartDataChangeType(data, "area");
    expect(result.categories).toEqual(data.categories);
  });

  it("clears grouping when switching to pie (unsupported)", () => {
    const data = makeChartData({ grouping: "stacked" });
    const result = chartDataChangeType(data, "pie");
    expect(result.grouping).toBeUndefined();
  });

  it("clears grouping when switching to doughnut (unsupported)", () => {
    const data = makeChartData({ grouping: "clustered" });
    const result = chartDataChangeType(data, "doughnut");
    expect(result.grouping).toBeUndefined();
  });

  it("preserves grouping when switching between grouping-compatible types", () => {
    const data = makeChartData({ chartType: "bar", grouping: "stacked" });
    const result = chartDataChangeType(data, "line");
    expect(result.grouping).toBe("stacked");
  });

  it("sets default grouping when switching to grouping-compatible type from pie", () => {
    const data = makeChartData({ chartType: "pie", grouping: undefined });
    const result = chartDataChangeType(data, "bar");
    expect(result.grouping).toBe("clustered");
  });

  it("converts non-numeric categories to sequential numbers when switching to scatter", () => {
    const data = makeChartData({ categories: ["Q1", "Q2", "Q3"] });
    const result = chartDataChangeType(data, "scatter");
    expect(result.categories).toEqual(["1", "2", "3"]);
  });

  it("preserves numeric categories when switching to scatter", () => {
    const data = makeChartData({ categories: ["10", "20", "30"] });
    const result = chartDataChangeType(data, "scatter");
    expect(result.categories).toEqual(["10", "20", "30"]);
  });

  it("does not convert categories when switching between category types", () => {
    const data = makeChartData({ categories: ["Q1", "Q2", "Q3"] });
    const result = chartDataChangeType(data, "line");
    expect(result.categories).toEqual(["Q1", "Q2", "Q3"]);
  });

  it("preserves chartPartPath and chartRelationshipId", () => {
    const data = makeChartData({
      chartPartPath: "ppt/charts/chart1.xml",
      chartRelationshipId: "rId5",
    });
    const result = chartDataChangeType(data, "pie");
    expect(result.chartPartPath).toBe("ppt/charts/chart1.xml");
    expect(result.chartRelationshipId).toBe("rId5");
  });

  it("handles switching to 3D types", () => {
    const data = makeChartData({ chartType: "bar" });
    const result = chartDataChangeType(data, "bar3D");
    expect(result.chartType).toBe("bar3D");
    expect(result.grouping).toBe("clustered");
  });

  it("handles same type switch (no-op)", () => {
    const data = makeChartData({ chartType: "bar", grouping: "stacked" });
    const result = chartDataChangeType(data, "bar");
    expect(result.chartType).toBe("bar");
    expect(result.grouping).toBe("stacked");
  });
});

// ===========================================================================
// chartDataAddCategory
// ===========================================================================

describe("chartDataAddCategory", () => {
  it("appends a category", () => {
    const data = makeChartData();
    const result = chartDataAddCategory(data, "Q4");
    expect(result.categories).toEqual(["Q1", "Q2", "Q3", "Q4"]);
  });

  it("adds a zero value to every series", () => {
    const data = makeChartData();
    const result = chartDataAddCategory(data, "Q4");
    expect(result.series[0].values).toEqual([100, 200, 300, 0]);
    expect(result.series[1].values).toEqual([80, 160, 240, 0]);
  });

  it("preserves original data (immutable)", () => {
    const data = makeChartData();
    const result = chartDataAddCategory(data, "Q4");
    expect(data.categories).toHaveLength(3);
    expect(result.categories).toHaveLength(4);
  });

  it("works with no existing categories", () => {
    const data = makeChartData({
      categories: [],
      series: [{ name: "S1", values: [] }],
    });
    const result = chartDataAddCategory(data, "First");
    expect(result.categories).toEqual(["First"]);
    expect(result.series[0].values).toEqual([0]);
  });

  it("preserves series names and colors", () => {
    const data = makeChartData();
    const result = chartDataAddCategory(data, "Q4");
    expect(result.series[0].name).toBe("Revenue");
    expect(result.series[0].color).toBe("#4472C4");
    expect(result.series[1].name).toBe("Cost");
  });

  it("preserves other chart fields", () => {
    const data = makeChartData({ title: "Quarterly" });
    const result = chartDataAddCategory(data, "Q4");
    expect(result.title).toBe("Quarterly");
    expect(result.chartType).toBe("bar");
  });
});

// ===========================================================================
// chartDataRemoveCategory
// ===========================================================================

describe("chartDataRemoveCategory", () => {
  it("removes the first category", () => {
    const data = makeChartData();
    const result = chartDataRemoveCategory(data, 0);
    expect(result.categories).toEqual(["Q2", "Q3"]);
    expect(result.series[0].values).toEqual([200, 300]);
    expect(result.series[1].values).toEqual([160, 240]);
  });

  it("removes the last category", () => {
    const data = makeChartData();
    const result = chartDataRemoveCategory(data, 2);
    expect(result.categories).toEqual(["Q1", "Q2"]);
    expect(result.series[0].values).toEqual([100, 200]);
  });

  it("removes a middle category", () => {
    const data = makeChartData();
    const result = chartDataRemoveCategory(data, 1);
    expect(result.categories).toEqual(["Q1", "Q3"]);
    expect(result.series[0].values).toEqual([100, 300]);
    expect(result.series[1].values).toEqual([80, 240]);
  });

  it("preserves original data (immutable)", () => {
    const data = makeChartData();
    const result = chartDataRemoveCategory(data, 0);
    expect(data.categories).toHaveLength(3);
    expect(result.categories).toHaveLength(2);
  });

  it("throws RangeError for negative index", () => {
    const data = makeChartData();
    expect(() => chartDataRemoveCategory(data, -1)).toThrow(RangeError);
  });

  it("throws RangeError for index equal to category count", () => {
    const data = makeChartData();
    expect(() => chartDataRemoveCategory(data, 3)).toThrow(RangeError);
  });

  it("throws RangeError for index beyond category count", () => {
    const data = makeChartData();
    expect(() => chartDataRemoveCategory(data, 100)).toThrow(RangeError);
  });

  it("preserves other chart fields", () => {
    const data = makeChartData({ title: "Sales" });
    const result = chartDataRemoveCategory(data, 0);
    expect(result.title).toBe("Sales");
  });
});

// ===========================================================================
// Combined / integration scenarios
// ===========================================================================

describe("combined chart data operations", () => {
  it("add series then remove it (roundtrip)", () => {
    const data = makeChartData();
    const withNew = chartDataAddSeries(data, {
      name: "Temp",
      values: [1, 2, 3],
    });
    expect(withNew.series).toHaveLength(3);
    const back = chartDataRemoveSeries(withNew, 2);
    expect(back.series).toHaveLength(2);
    expect(back.series[0].name).toBe("Revenue");
    expect(back.series[1].name).toBe("Cost");
  });

  it("add category then update the new data points", () => {
    const data = makeChartData();
    const withCat = chartDataAddCategory(data, "Q4");
    const updated = chartDataUpdatePoint(withCat, 0, 3, 400);
    expect(updated.series[0].values).toEqual([100, 200, 300, 400]);
  });

  it("change type and add series", () => {
    const data = makeChartData({ chartType: "bar" });
    const asLine = chartDataChangeType(data, "line");
    const withSeries = chartDataAddSeries(asLine, {
      name: "Forecast",
      values: [150, 250, 350],
    });
    expect(withSeries.chartType).toBe("line");
    expect(withSeries.series).toHaveLength(3);
  });

  it("remove category then add a new category", () => {
    const data = makeChartData();
    const removed = chartDataRemoveCategory(data, 1); // remove Q2
    const added = chartDataAddCategory(removed, "Q4");
    expect(added.categories).toEqual(["Q1", "Q3", "Q4"]);
    expect(added.series[0].values).toEqual([100, 300, 0]);
  });

  it("full rebuild: change type, remove all series, add new", () => {
    let data = makeChartData();
    data = chartDataChangeType(data, "pie");
    data = chartDataRemoveSeries(data, 1);
    data = chartDataRemoveSeries(data, 0);
    data = chartDataAddSeries(data, {
      name: "Segments",
      values: [40, 30, 30],
      color: "#FF6384",
    });
    expect(data.chartType).toBe("pie");
    expect(data.series).toHaveLength(1);
    expect(data.series[0].name).toBe("Segments");
    expect(data.grouping).toBeUndefined();
  });

  it("preserves chartPartPath through all operations", () => {
    let data = makeChartData({
      chartPartPath: "ppt/charts/chart1.xml",
      chartRelationshipId: "rId5",
    });
    data = chartDataChangeType(data, "line");
    data = chartDataAddSeries(data, { name: "X", values: [1, 2, 3] });
    data = chartDataRemoveSeries(data, 0);
    data = chartDataAddCategory(data, "Q4");
    data = chartDataRemoveCategory(data, 0);
    data = chartDataUpdatePoint(data, 0, 0, 999);
    expect(data.chartPartPath).toBe("ppt/charts/chart1.xml");
    expect(data.chartRelationshipId).toBe("rId5");
  });

  it("chained operations produce correct final state", () => {
    let data: PptxChartData = {
      chartType: "bar",
      categories: ["A", "B"],
      series: [{ name: "S1", values: [10, 20] }],
      grouping: "clustered",
    };

    // Add a category
    data = chartDataAddCategory(data, "C");
    expect(data.categories).toEqual(["A", "B", "C"]);
    expect(data.series[0].values).toEqual([10, 20, 0]);

    // Add a series
    data = chartDataAddSeries(data, {
      name: "S2",
      values: [30, 40, 50],
    });
    expect(data.series).toHaveLength(2);

    // Update a point
    data = chartDataUpdatePoint(data, 0, 2, 25);
    expect(data.series[0].values[2]).toBe(25);

    // Change type
    data = chartDataChangeType(data, "pie");
    expect(data.chartType).toBe("pie");
    expect(data.grouping).toBeUndefined();

    // Remove a category
    data = chartDataRemoveCategory(data, 0);
    expect(data.categories).toEqual(["B", "C"]);
    expect(data.series[0].values).toEqual([20, 25]);
    expect(data.series[1].values).toEqual([40, 50]);

    // Remove a series
    data = chartDataRemoveSeries(data, 0);
    expect(data.series).toHaveLength(1);
    expect(data.series[0].name).toBe("S2");
  });
});
