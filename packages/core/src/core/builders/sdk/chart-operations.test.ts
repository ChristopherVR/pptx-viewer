import { describe, it, expect, beforeEach } from "vitest";
import {
	setChartType,
	addChartSeries,
	removeChartSeries,
	setChartCategories,
	updateChartSeriesValues,
	setChartTitle,
	setChartGrouping,
	updateChartDataPoint,
	addChartCategory,
	removeChartCategory,
} from "./chart-operations";
import { createChartElement, resetIdCounter } from "./ElementFactory";
import type { ChartPptxElement } from "../../types/elements";
import type { PptxChartType } from "../../types/chart";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a standard test chart element with predictable data. */
function makeTestChart(
	overrides?: Partial<{
		chartType: PptxChartType;
		categories: string[];
		series: { name: string; values: number[]; color?: string }[];
		title: string;
		grouping: "clustered" | "stacked" | "percentStacked";
	}>,
): ChartPptxElement {
	return createChartElement(overrides?.chartType ?? "bar", {
		series: overrides?.series ?? [
			{ name: "Revenue", values: [100, 200, 300], color: "#4472C4" },
			{ name: "Cost", values: [80, 160, 240], color: "#ED7D31" },
		],
		categories: overrides?.categories ?? ["Q1", "Q2", "Q3"],
		title: overrides?.title ?? "Test Chart",
		grouping: overrides?.grouping,
	});
}

/** Create a chart element with no chartData (simulates uninitialised state). */
function makeEmptyChart(): ChartPptxElement {
	return {
		type: "chart",
		id: "empty_chart",
		x: 0,
		y: 0,
		width: 600,
		height: 400,
		chartData: undefined,
	};
}

beforeEach(() => {
	resetIdCounter();
});

// ===========================================================================
// setChartType
// ===========================================================================

describe("setChartType", () => {
	it("changes chart type from bar to line", () => {
		const el = makeTestChart();
		setChartType(el, "line");
		expect(el.chartData?.chartType).toBe("line");
	});

	it("changes chart type from bar to pie", () => {
		const el = makeTestChart();
		setChartType(el, "pie");
		expect(el.chartData?.chartType).toBe("pie");
	});

	it("preserves series data after type switch", () => {
		const el = makeTestChart();
		const seriesBefore = JSON.parse(JSON.stringify(el.chartData?.series));
		setChartType(el, "area");
		expect(el.chartData?.series).toEqual(seriesBefore);
	});

	it("preserves categories after type switch", () => {
		const el = makeTestChart();
		const catsBefore = [...el.chartData!.categories];
		setChartType(el, "scatter");
		expect(el.chartData?.categories).toEqual(catsBefore);
	});

	it("preserves title after type switch", () => {
		const el = makeTestChart({ title: "My Title" });
		setChartType(el, "doughnut");
		expect(el.chartData?.title).toBe("My Title");
	});

	it("can switch to 3D chart types", () => {
		const el = makeTestChart();
		setChartType(el, "bar3D");
		expect(el.chartData?.chartType).toBe("bar3D");
	});

	it("can switch to modern chart types", () => {
		const el = makeTestChart();
		setChartType(el, "waterfall");
		expect(el.chartData?.chartType).toBe("waterfall");
	});

	it("can set type to the same value (no-op)", () => {
		const el = makeTestChart({ chartType: "bar" });
		setChartType(el, "bar");
		expect(el.chartData?.chartType).toBe("bar");
	});

	it("throws when chartData is missing", () => {
		const el = makeEmptyChart();
		expect(() => setChartType(el, "line")).toThrow(/no chartData/);
	});
});

// ===========================================================================
// addChartSeries
// ===========================================================================

describe("addChartSeries", () => {
	it("adds a series to the chart", () => {
		const el = makeTestChart();
		const before = el.chartData!.series.length;
		addChartSeries(el, { name: "Profit", values: [20, 40, 60] });
		expect(el.chartData!.series.length).toBe(before + 1);
		expect(el.chartData!.series[before].name).toBe("Profit");
		expect(el.chartData!.series[before].values).toEqual([20, 40, 60]);
	});

	it("adds a series with color", () => {
		const el = makeTestChart();
		addChartSeries(el, { name: "Extra", values: [1, 2], color: "#00FF00" });
		const added = el.chartData!.series[el.chartData!.series.length - 1];
		expect(added.color).toBe("#00FF00");
	});

	it("adds a series without color", () => {
		const el = makeTestChart();
		addChartSeries(el, { name: "NoColor", values: [5] });
		const added = el.chartData!.series[el.chartData!.series.length - 1];
		expect(added.color).toBeUndefined();
	});

	it("adds a series with empty values array", () => {
		const el = makeTestChart();
		addChartSeries(el, { name: "Empty", values: [] });
		const added = el.chartData!.series[el.chartData!.series.length - 1];
		expect(added.values).toEqual([]);
	});

	it("can add multiple series sequentially", () => {
		const el = makeTestChart();
		const before = el.chartData!.series.length;
		addChartSeries(el, { name: "S1", values: [1] });
		addChartSeries(el, { name: "S2", values: [2] });
		addChartSeries(el, { name: "S3", values: [3] });
		expect(el.chartData!.series.length).toBe(before + 3);
	});

	it("appends to the end of existing series", () => {
		const el = makeTestChart();
		addChartSeries(el, { name: "Last", values: [999] });
		const last = el.chartData!.series[el.chartData!.series.length - 1];
		expect(last.name).toBe("Last");
	});

	it("throws when chartData is missing", () => {
		const el = makeEmptyChart();
		expect(() => addChartSeries(el, { name: "X", values: [1] })).toThrow(/no chartData/);
	});
});

// ===========================================================================
// removeChartSeries
// ===========================================================================

describe("removeChartSeries", () => {
	it("removes the first series", () => {
		const el = makeTestChart();
		const secondName = el.chartData!.series[1].name;
		removeChartSeries(el, 0);
		expect(el.chartData!.series.length).toBe(1);
		expect(el.chartData!.series[0].name).toBe(secondName);
	});

	it("removes the last series", () => {
		const el = makeTestChart();
		const firstName = el.chartData!.series[0].name;
		removeChartSeries(el, 1);
		expect(el.chartData!.series.length).toBe(1);
		expect(el.chartData!.series[0].name).toBe(firstName);
	});

	it("removes a middle series from a 3-series chart", () => {
		const el = makeTestChart();
		addChartSeries(el, { name: "Third", values: [10, 20, 30] });
		expect(el.chartData!.series.length).toBe(3);
		removeChartSeries(el, 1);
		expect(el.chartData!.series.length).toBe(2);
		expect(el.chartData!.series[0].name).toBe("Revenue");
		expect(el.chartData!.series[1].name).toBe("Third");
	});

	it("throws RangeError for negative index", () => {
		const el = makeTestChart();
		expect(() => removeChartSeries(el, -1)).toThrow(RangeError);
	});

	it("throws RangeError for index equal to series length", () => {
		const el = makeTestChart();
		expect(() => removeChartSeries(el, 2)).toThrow(RangeError);
	});

	it("throws RangeError for index beyond series length", () => {
		const el = makeTestChart();
		expect(() => removeChartSeries(el, 100)).toThrow(RangeError);
	});

	it("throws when chartData is missing", () => {
		const el = makeEmptyChart();
		expect(() => removeChartSeries(el, 0)).toThrow(/no chartData/);
	});

	it("can remove all series one by one", () => {
		const el = makeTestChart();
		removeChartSeries(el, 1);
		removeChartSeries(el, 0);
		expect(el.chartData!.series.length).toBe(0);
	});
});

// ===========================================================================
// setChartCategories
// ===========================================================================

describe("setChartCategories", () => {
	it("replaces categories", () => {
		const el = makeTestChart();
		setChartCategories(el, ["Jan", "Feb", "Mar", "Apr"]);
		expect(el.chartData?.categories).toEqual(["Jan", "Feb", "Mar", "Apr"]);
	});

	it("sets categories to an empty array", () => {
		const el = makeTestChart();
		setChartCategories(el, []);
		expect(el.chartData?.categories).toEqual([]);
	});

	it("can increase the number of categories", () => {
		const el = makeTestChart({ categories: ["A"] });
		setChartCategories(el, ["A", "B", "C", "D", "E"]);
		expect(el.chartData?.categories.length).toBe(5);
	});

	it("can decrease the number of categories", () => {
		const el = makeTestChart({ categories: ["A", "B", "C"] });
		setChartCategories(el, ["X"]);
		expect(el.chartData?.categories.length).toBe(1);
	});

	it("does not affect series data", () => {
		const el = makeTestChart();
		const seriesBefore = JSON.parse(JSON.stringify(el.chartData?.series));
		setChartCategories(el, ["New1", "New2"]);
		expect(el.chartData?.series).toEqual(seriesBefore);
	});

	it("throws when chartData is missing", () => {
		const el = makeEmptyChart();
		expect(() => setChartCategories(el, ["A"])).toThrow(/no chartData/);
	});
});

// ===========================================================================
// updateChartSeriesValues
// ===========================================================================

describe("updateChartSeriesValues", () => {
	it("updates values for the first series", () => {
		const el = makeTestChart();
		updateChartSeriesValues(el, 0, [999, 888, 777]);
		expect(el.chartData!.series[0].values).toEqual([999, 888, 777]);
	});

	it("updates values for the second series", () => {
		const el = makeTestChart();
		updateChartSeriesValues(el, 1, [10, 20]);
		expect(el.chartData!.series[1].values).toEqual([10, 20]);
	});

	it("can set values to an empty array", () => {
		const el = makeTestChart();
		updateChartSeriesValues(el, 0, []);
		expect(el.chartData!.series[0].values).toEqual([]);
	});

	it("preserves other series when updating one", () => {
		const el = makeTestChart();
		const secondBefore = [...el.chartData!.series[1].values];
		updateChartSeriesValues(el, 0, [1, 2, 3]);
		expect(el.chartData!.series[1].values).toEqual(secondBefore);
	});

	it("preserves series name and color", () => {
		const el = makeTestChart();
		const nameBefore = el.chartData!.series[0].name;
		const colorBefore = el.chartData!.series[0].color;
		updateChartSeriesValues(el, 0, [42]);
		expect(el.chartData!.series[0].name).toBe(nameBefore);
		expect(el.chartData!.series[0].color).toBe(colorBefore);
	});

	it("throws RangeError for negative index", () => {
		const el = makeTestChart();
		expect(() => updateChartSeriesValues(el, -1, [1])).toThrow(RangeError);
	});

	it("throws RangeError for out-of-bounds index", () => {
		const el = makeTestChart();
		expect(() => updateChartSeriesValues(el, 5, [1])).toThrow(RangeError);
	});

	it("throws when chartData is missing", () => {
		const el = makeEmptyChart();
		expect(() => updateChartSeriesValues(el, 0, [1])).toThrow(/no chartData/);
	});
});

// ===========================================================================
// setChartTitle
// ===========================================================================

describe("setChartTitle", () => {
	it("sets the chart title", () => {
		const el = makeTestChart();
		setChartTitle(el, "New Title");
		expect(el.chartData?.title).toBe("New Title");
	});

	it("overwrites an existing title", () => {
		const el = makeTestChart({ title: "Old Title" });
		setChartTitle(el, "Updated Title");
		expect(el.chartData?.title).toBe("Updated Title");
	});

	it("can set an empty title", () => {
		const el = makeTestChart({ title: "Has Title" });
		setChartTitle(el, "");
		expect(el.chartData?.title).toBe("");
	});

	it("throws when chartData is missing", () => {
		const el = makeEmptyChart();
		expect(() => setChartTitle(el, "Title")).toThrow(/no chartData/);
	});
});

// ===========================================================================
// setChartGrouping
// ===========================================================================

describe("setChartGrouping", () => {
	it("sets grouping to clustered", () => {
		const el = makeTestChart();
		setChartGrouping(el, "clustered");
		expect(el.chartData?.grouping).toBe("clustered");
	});

	it("sets grouping to stacked", () => {
		const el = makeTestChart();
		setChartGrouping(el, "stacked");
		expect(el.chartData?.grouping).toBe("stacked");
	});

	it("sets grouping to percentStacked", () => {
		const el = makeTestChart();
		setChartGrouping(el, "percentStacked");
		expect(el.chartData?.grouping).toBe("percentStacked");
	});

	it("overwrites existing grouping", () => {
		const el = makeTestChart({ grouping: "stacked" });
		setChartGrouping(el, "clustered");
		expect(el.chartData?.grouping).toBe("clustered");
	});

	it("throws when chartData is missing", () => {
		const el = makeEmptyChart();
		expect(() => setChartGrouping(el, "stacked")).toThrow(/no chartData/);
	});
});

// ===========================================================================
// Combined / integration scenarios
// ===========================================================================

describe("combined chart operations", () => {
	it("switches type and adds a series", () => {
		const el = makeTestChart({ chartType: "bar" });
		setChartType(el, "line");
		addChartSeries(el, { name: "New", values: [1, 2, 3] });
		expect(el.chartData?.chartType).toBe("line");
		expect(el.chartData?.series.length).toBe(3);
	});

	it("adds then removes a series, returning to original state", () => {
		const el = makeTestChart();
		const originalLength = el.chartData!.series.length;
		addChartSeries(el, { name: "Temp", values: [1] });
		expect(el.chartData!.series.length).toBe(originalLength + 1);
		removeChartSeries(el, originalLength); // remove the added one
		expect(el.chartData!.series.length).toBe(originalLength);
	});

	it("updates categories, title, and grouping together", () => {
		const el = makeTestChart();
		setChartCategories(el, ["X", "Y"]);
		setChartTitle(el, "Combined");
		setChartGrouping(el, "percentStacked");
		expect(el.chartData?.categories).toEqual(["X", "Y"]);
		expect(el.chartData?.title).toBe("Combined");
		expect(el.chartData?.grouping).toBe("percentStacked");
	});

	it("performs a full chart rebuild: type switch, clear series, add new series, set categories", () => {
		const el = makeTestChart();
		setChartType(el, "pie");
		// Remove all existing series
		while (el.chartData!.series.length > 0) {
			removeChartSeries(el, 0);
		}
		addChartSeries(el, { name: "Segments", values: [40, 30, 20, 10], color: "#FF6384" });
		setChartCategories(el, ["A", "B", "C", "D"]);
		setChartTitle(el, "Distribution");

		expect(el.chartData?.chartType).toBe("pie");
		expect(el.chartData?.series.length).toBe(1);
		expect(el.chartData?.series[0].name).toBe("Segments");
		expect(el.chartData?.series[0].values).toEqual([40, 30, 20, 10]);
		expect(el.chartData?.categories).toEqual(["A", "B", "C", "D"]);
		expect(el.chartData?.title).toBe("Distribution");
	});

	it("updates values for a newly added series", () => {
		const el = makeTestChart();
		addChartSeries(el, { name: "Added", values: [0, 0, 0] });
		const newIndex = el.chartData!.series.length - 1;
		updateChartSeriesValues(el, newIndex, [10, 20, 30]);
		expect(el.chartData!.series[newIndex].values).toEqual([10, 20, 30]);
	});

	it("preserves internal chartData properties (chartPartPath, chartRelationshipId) through operations", () => {
		const el = makeTestChart();
		el.chartData!.chartPartPath = "ppt/charts/chart1.xml";
		el.chartData!.chartRelationshipId = "rId5";

		setChartType(el, "line");
		addChartSeries(el, { name: "Extra", values: [1] });
		setChartTitle(el, "Changed");
		setChartGrouping(el, "stacked");
		setChartCategories(el, ["A"]);

		expect(el.chartData?.chartPartPath).toBe("ppt/charts/chart1.xml");
		expect(el.chartData?.chartRelationshipId).toBe("rId5");
	});
});

// ===========================================================================
// updateChartDataPoint
// ===========================================================================

describe("updateChartDataPoint", () => {
	it("updates a single data point in the first series", () => {
		const el = makeTestChart();
		updateChartDataPoint(el, 0, 1, 999);
		expect(el.chartData!.series[0].values).toEqual([100, 999, 300]);
	});

	it("updates a data point in the second series", () => {
		const el = makeTestChart();
		updateChartDataPoint(el, 1, 0, 42);
		expect(el.chartData!.series[1].values[0]).toBe(42);
	});

	it("does not affect other series", () => {
		const el = makeTestChart();
		const secondBefore = [...el.chartData!.series[1].values];
		updateChartDataPoint(el, 0, 0, 42);
		expect(el.chartData!.series[1].values).toEqual(secondBefore);
	});

	it("does not affect other data points in the same series", () => {
		const el = makeTestChart();
		updateChartDataPoint(el, 0, 1, 777);
		expect(el.chartData!.series[0].values[0]).toBe(100);
		expect(el.chartData!.series[0].values[2]).toBe(300);
	});

	it("can set a value to zero", () => {
		const el = makeTestChart();
		updateChartDataPoint(el, 0, 0, 0);
		expect(el.chartData!.series[0].values[0]).toBe(0);
	});

	it("can set a negative value", () => {
		const el = makeTestChart();
		updateChartDataPoint(el, 0, 0, -50);
		expect(el.chartData!.series[0].values[0]).toBe(-50);
	});

	it("throws RangeError for invalid series index", () => {
		const el = makeTestChart();
		expect(() => updateChartDataPoint(el, -1, 0, 1)).toThrow(RangeError);
		expect(() => updateChartDataPoint(el, 5, 0, 1)).toThrow(RangeError);
	});

	it("throws RangeError for invalid point index", () => {
		const el = makeTestChart();
		expect(() => updateChartDataPoint(el, 0, -1, 1)).toThrow(RangeError);
		expect(() => updateChartDataPoint(el, 0, 10, 1)).toThrow(RangeError);
	});

	it("throws when chartData is missing", () => {
		const el = makeEmptyChart();
		expect(() => updateChartDataPoint(el, 0, 0, 1)).toThrow(/no chartData/);
	});
});

// ===========================================================================
// addChartCategory
// ===========================================================================

describe("addChartCategory", () => {
	it("appends a category to the chart", () => {
		const el = makeTestChart();
		addChartCategory(el, "Q4");
		expect(el.chartData!.categories).toEqual(["Q1", "Q2", "Q3", "Q4"]);
	});

	it("adds a zero value to every series", () => {
		const el = makeTestChart();
		addChartCategory(el, "Q4");
		expect(el.chartData!.series[0].values).toEqual([100, 200, 300, 0]);
		expect(el.chartData!.series[1].values).toEqual([80, 160, 240, 0]);
	});

	it("works with no existing categories", () => {
		const el = makeTestChart({ categories: [] });
		el.chartData!.series[0].values = [];
		el.chartData!.series[1].values = [];
		addChartCategory(el, "First");
		expect(el.chartData!.categories).toEqual(["First"]);
		expect(el.chartData!.series[0].values).toEqual([0]);
		expect(el.chartData!.series[1].values).toEqual([0]);
	});

	it("can add multiple categories sequentially", () => {
		const el = makeTestChart();
		addChartCategory(el, "Q4");
		addChartCategory(el, "Q5");
		expect(el.chartData!.categories).toHaveLength(5);
		expect(el.chartData!.series[0].values).toHaveLength(5);
	});

	it("throws when chartData is missing", () => {
		const el = makeEmptyChart();
		expect(() => addChartCategory(el, "X")).toThrow(/no chartData/);
	});
});

// ===========================================================================
// removeChartCategory
// ===========================================================================

describe("removeChartCategory", () => {
	it("removes the first category", () => {
		const el = makeTestChart();
		removeChartCategory(el, 0);
		expect(el.chartData!.categories).toEqual(["Q2", "Q3"]);
		expect(el.chartData!.series[0].values).toEqual([200, 300]);
		expect(el.chartData!.series[1].values).toEqual([160, 240]);
	});

	it("removes the last category", () => {
		const el = makeTestChart();
		removeChartCategory(el, 2);
		expect(el.chartData!.categories).toEqual(["Q1", "Q2"]);
		expect(el.chartData!.series[0].values).toEqual([100, 200]);
	});

	it("removes a middle category", () => {
		const el = makeTestChart();
		removeChartCategory(el, 1);
		expect(el.chartData!.categories).toEqual(["Q1", "Q3"]);
		expect(el.chartData!.series[0].values).toEqual([100, 300]);
	});

	it("throws RangeError for negative index", () => {
		const el = makeTestChart();
		expect(() => removeChartCategory(el, -1)).toThrow(RangeError);
	});

	it("throws RangeError for index equal to category count", () => {
		const el = makeTestChart();
		expect(() => removeChartCategory(el, 3)).toThrow(RangeError);
	});

	it("throws RangeError for index beyond category count", () => {
		const el = makeTestChart();
		expect(() => removeChartCategory(el, 100)).toThrow(RangeError);
	});

	it("throws when chartData is missing", () => {
		const el = makeEmptyChart();
		expect(() => removeChartCategory(el, 0)).toThrow(/no chartData/);
	});

	it("can remove all categories one by one", () => {
		const el = makeTestChart();
		removeChartCategory(el, 2);
		removeChartCategory(el, 1);
		removeChartCategory(el, 0);
		expect(el.chartData!.categories).toHaveLength(0);
		expect(el.chartData!.series[0].values).toHaveLength(0);
	});
});

// ===========================================================================
// Combined: new + existing operations
// ===========================================================================

describe("combined with new operations", () => {
	it("add category then update the new data point", () => {
		const el = makeTestChart();
		addChartCategory(el, "Q4");
		updateChartDataPoint(el, 0, 3, 400);
		expect(el.chartData!.series[0].values).toEqual([100, 200, 300, 400]);
	});

	it("remove category then verify remaining data integrity", () => {
		const el = makeTestChart();
		removeChartCategory(el, 0); // remove Q1
		expect(el.chartData!.categories).toEqual(["Q2", "Q3"]);
		updateChartDataPoint(el, 0, 0, 999); // Q2 position is now [0]
		expect(el.chartData!.series[0].values[0]).toBe(999);
	});

	it("full workflow: add series, add category, update point, remove", () => {
		const el = makeTestChart();
		addChartSeries(el, { name: "Extra", values: [10, 20, 30] });
		addChartCategory(el, "Q4");
		updateChartDataPoint(el, 2, 3, 40); // Extra series, Q4
		expect(el.chartData!.series[2].values).toEqual([10, 20, 30, 40]);

		removeChartCategory(el, 0); // remove Q1
		expect(el.chartData!.categories).toEqual(["Q2", "Q3", "Q4"]);
		expect(el.chartData!.series[2].values).toEqual([20, 30, 40]);

		removeChartSeries(el, 2);
		expect(el.chartData!.series).toHaveLength(2);
	});
});
