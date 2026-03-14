import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Extracted logic from PptxHandlerRuntimeChartDetection (protected methods)
// ---------------------------------------------------------------------------

type ChartType =
  | "bar"
  | "bar3D"
  | "line"
  | "line3D"
  | "pie"
  | "pie3D"
  | "doughnut"
  | "area"
  | "area3D"
  | "scatter"
  | "bubble"
  | "radar"
  | "stock"
  | "surface"
  | "combo"
  | "waterfall"
  | "funnel"
  | "treemap"
  | "sunburst"
  | "boxWhisker"
  | "histogram"
  | "unknown";

interface XmlObject {
  [key: string]: unknown;
}

/**
 * Simplified getXmlLocalName — strips namespace prefix.
 */
function getXmlLocalName(qualifiedName: string): string {
  const colonIndex = qualifiedName.lastIndexOf(":");
  return colonIndex >= 0 ? qualifiedName.substring(colonIndex + 1) : qualifiedName;
}

/**
 * Ensures a value is an array. Mirrors the runtime ensureArray method.
 */
function ensureArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Extracted from detectChartType. Simplified to not use service references
 * since getXmlLocalName is a pure function.
 */
function detectChartType(plotArea: XmlObject | undefined): ChartType {
  if (!plotArea) return "unknown";

  const chartElementMap: Record<string, ChartType> = {
    barChart: "bar",
    bar3DChart: "bar3D",
    lineChart: "line",
    line3DChart: "line3D",
    pieChart: "pie",
    pie3DChart: "pie3D",
    doughnutChart: "doughnut",
    areaChart: "area",
    area3DChart: "area3D",
    scatterChart: "scatter",
    bubbleChart: "bubble",
    radarChart: "radar",
    stockChart: "stock",
    surfaceChart: "surface",
    surface3DChart: "surface",
  };

  const matchedKeys: string[] = [];

  for (const key of Object.keys(plotArea)) {
    const localName = getXmlLocalName(key);
    const mapped = chartElementMap[localName];
    if (mapped) matchedKeys.push(localName);
  }

  // Multiple chart types in plotArea => combo chart
  if (matchedKeys.length >= 2) return "combo";

  // Single match
  if (matchedKeys.length === 1) {
    return chartElementMap[matchedKeys[0]];
  }

  // Check for Office 2016+ chart extension types (cx:chart namespace)
  for (const key of Object.keys(plotArea)) {
    const localName = getXmlLocalName(key);
    if (localName === "plotAreaRegion" || localName === "plotSurface") {
      const innerObj = plotArea[key] as XmlObject | undefined;
      const seriesArr = ensureArray(
        innerObj?.["cx:series"] ?? innerObj?.["series"],
      ) as XmlObject[];
      for (const ser of seriesArr) {
        const layoutRef = String(ser?.["@_layoutId"] || "").toLowerCase();
        if (layoutRef.includes("waterfall")) return "waterfall";
        if (layoutRef.includes("funnel")) return "funnel";
        if (layoutRef.includes("treemap")) return "treemap";
        if (layoutRef.includes("sunburst")) return "sunburst";
        if (layoutRef.includes("boxwhisker") || layoutRef.includes("box"))
          return "boxWhisker";
        if (layoutRef.includes("histogram") || layoutRef.includes("pareto"))
          return "histogram";
      }
    }
  }

  return "unknown";
}

// ---------------------------------------------------------------------------
// Tests: detectChartType
// ---------------------------------------------------------------------------
describe("detectChartType", () => {
  it("should return 'unknown' for undefined plotArea", () => {
    expect(detectChartType(undefined)).toBe("unknown");
  });

  it("should return 'unknown' for empty plotArea", () => {
    expect(detectChartType({})).toBe("unknown");
  });

  it("should detect bar chart", () => {
    expect(detectChartType({ "c:barChart": {} })).toBe("bar");
  });

  it("should detect bar3D chart", () => {
    expect(detectChartType({ "c:bar3DChart": {} })).toBe("bar3D");
  });

  it("should detect line chart", () => {
    expect(detectChartType({ "c:lineChart": {} })).toBe("line");
  });

  it("should detect line3D chart", () => {
    expect(detectChartType({ "c:line3DChart": {} })).toBe("line3D");
  });

  it("should detect pie chart", () => {
    expect(detectChartType({ "c:pieChart": {} })).toBe("pie");
  });

  it("should detect pie3D chart", () => {
    expect(detectChartType({ "c:pie3DChart": {} })).toBe("pie3D");
  });

  it("should detect doughnut chart", () => {
    expect(detectChartType({ "c:doughnutChart": {} })).toBe("doughnut");
  });

  it("should detect area chart", () => {
    expect(detectChartType({ "c:areaChart": {} })).toBe("area");
  });

  it("should detect area3D chart", () => {
    expect(detectChartType({ "c:area3DChart": {} })).toBe("area3D");
  });

  it("should detect scatter chart", () => {
    expect(detectChartType({ "c:scatterChart": {} })).toBe("scatter");
  });

  it("should detect bubble chart", () => {
    expect(detectChartType({ "c:bubbleChart": {} })).toBe("bubble");
  });

  it("should detect radar chart", () => {
    expect(detectChartType({ "c:radarChart": {} })).toBe("radar");
  });

  it("should detect stock chart", () => {
    expect(detectChartType({ "c:stockChart": {} })).toBe("stock");
  });

  it("should detect surface chart", () => {
    expect(detectChartType({ "c:surfaceChart": {} })).toBe("surface");
  });

  it("should detect surface3D chart as surface", () => {
    expect(detectChartType({ "c:surface3DChart": {} })).toBe("surface");
  });

  it("should detect combo chart when two types present", () => {
    expect(detectChartType({ "c:barChart": {}, "c:lineChart": {} })).toBe("combo");
  });

  it("should detect combo chart with three types", () => {
    expect(
      detectChartType({ "c:barChart": {}, "c:lineChart": {}, "c:areaChart": {} }),
    ).toBe("combo");
  });

  it("should ignore non-chart keys", () => {
    expect(detectChartType({ "c:catAx": {}, "c:valAx": {} })).toBe("unknown");
  });

  it("should handle chart type with non-chart sibling keys", () => {
    expect(detectChartType({ "c:barChart": {}, "c:catAx": {}, "c:valAx": {} })).toBe("bar");
  });

  it("should detect waterfall from cx:plotAreaRegion", () => {
    expect(
      detectChartType({
        "cx:plotAreaRegion": {
          "cx:series": { "@_layoutId": "waterfall" },
        },
      }),
    ).toBe("waterfall");
  });

  it("should detect funnel from cx:plotAreaRegion", () => {
    expect(
      detectChartType({
        "cx:plotAreaRegion": {
          "cx:series": { "@_layoutId": "funnel" },
        },
      }),
    ).toBe("funnel");
  });

  it("should detect treemap from cx:plotAreaRegion", () => {
    expect(
      detectChartType({
        "cx:plotAreaRegion": {
          "cx:series": { "@_layoutId": "treemap" },
        },
      }),
    ).toBe("treemap");
  });

  it("should detect sunburst from cx:plotAreaRegion", () => {
    expect(
      detectChartType({
        "cx:plotAreaRegion": {
          "cx:series": { "@_layoutId": "sunburst" },
        },
      }),
    ).toBe("sunburst");
  });

  it("should detect boxWhisker from cx:plotAreaRegion", () => {
    expect(
      detectChartType({
        "cx:plotAreaRegion": {
          "cx:series": { "@_layoutId": "boxWhisker" },
        },
      }),
    ).toBe("boxWhisker");
  });

  it("should detect histogram from cx:plotAreaRegion", () => {
    expect(
      detectChartType({
        "cx:plotAreaRegion": {
          "cx:series": { "@_layoutId": "histogram" },
        },
      }),
    ).toBe("histogram");
  });

  it("should detect pareto as histogram", () => {
    expect(
      detectChartType({
        "cx:plotAreaRegion": {
          "cx:series": { "@_layoutId": "pareto" },
        },
      }),
    ).toBe("histogram");
  });

  it("should handle namespace-less chart keys", () => {
    expect(detectChartType({ barChart: {} })).toBe("bar");
  });

  it("should detect chart type from plotSurface", () => {
    expect(
      detectChartType({
        plotSurface: {
          series: { "@_layoutId": "funnel" },
        },
      }),
    ).toBe("funnel");
  });

  it("should handle array of series in plotAreaRegion", () => {
    expect(
      detectChartType({
        "cx:plotAreaRegion": {
          "cx:series": [
            { "@_layoutId": "waterfall" },
            { "@_layoutId": "other" },
          ],
        },
      }),
    ).toBe("waterfall");
  });
});

// ---------------------------------------------------------------------------
// Tests: getXmlLocalName (utility used by chart detection)
// ---------------------------------------------------------------------------
describe("getXmlLocalName", () => {
  it("should strip namespace prefix", () => {
    expect(getXmlLocalName("c:barChart")).toBe("barChart");
  });

  it("should return the name unchanged when no prefix", () => {
    expect(getXmlLocalName("barChart")).toBe("barChart");
  });

  it("should handle multiple colons (uses last colon)", () => {
    expect(getXmlLocalName("ns:sub:element")).toBe("element");
  });

  it("should handle empty string", () => {
    expect(getXmlLocalName("")).toBe("");
  });
});
