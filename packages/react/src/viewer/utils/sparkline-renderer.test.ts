import { describe, it, expect } from "vitest";
import { renderSparklineSvg, type SparklineData } from "./sparkline-renderer";

// ── Helper ──────────────────────────────────────────────────────────────

/** Parse an SVG string and return basic info about its structure. */
function parseSvg(svg: string) {
  const widthMatch = svg.match(/width="(\d+)"/);
  const heightMatch = svg.match(/height="(\d+)"/);
  const polylineMatch = svg.match(/<polyline[^/]*\/>/);
  const rects = [...svg.matchAll(/<rect[^/]*\/>/g)];
  const fillMatches = [...svg.matchAll(/fill="([^"]*)"/g)];
  const strokeMatch = svg.match(/stroke="([^"]*)"/);
  const pointsMatch = svg.match(/points="([^"]*)"/);
  return {
    width: widthMatch ? Number(widthMatch[1]) : undefined,
    height: heightMatch ? Number(heightMatch[1]) : undefined,
    hasPolyline: !!polylineMatch,
    rectCount: rects.length,
    fills: fillMatches.map((m) => m[1]),
    stroke: strokeMatch ? strokeMatch[1] : undefined,
    points: pointsMatch ? pointsMatch[1] : undefined,
    raw: svg,
  };
}

// ── Line sparkline tests ────────────────────────────────────────────────

describe("renderSparklineSvg — line type", () => {
  it("should return an SVG with a polyline for line type", () => {
    const data: SparklineData = { values: [1, 3, 2, 5, 4], type: "line" };
    const svg = renderSparklineSvg(data);
    const info = parseSvg(svg);
    expect(info.hasPolyline).toBe(true);
    expect(info.rectCount).toBe(0);
  });

  it("should use default dimensions (100x20) when not specified", () => {
    const data: SparklineData = { values: [1, 2, 3], type: "line" };
    const info = parseSvg(renderSparklineSvg(data));
    expect(info.width).toBe(100);
    expect(info.height).toBe(20);
  });

  it("should respect custom width and height", () => {
    const data: SparklineData = {
      values: [1, 2],
      type: "line",
      width: 200,
      height: 40,
    };
    const info = parseSvg(renderSparklineSvg(data));
    expect(info.width).toBe(200);
    expect(info.height).toBe(40);
  });

  it("should use custom stroke color", () => {
    const data: SparklineData = {
      values: [1, 2, 3],
      type: "line",
      color: "#ff0000",
    };
    const info = parseSvg(renderSparklineSvg(data));
    expect(info.stroke).toBe("#ff0000");
  });

  it("should handle a single data point", () => {
    const data: SparklineData = { values: [42], type: "line" };
    const svg = renderSparklineSvg(data);
    expect(svg).toContain("<polyline");
    // Single point should still produce valid SVG
    const info = parseSvg(svg);
    expect(info.points).toBeTruthy();
  });

  it("should handle all-equal values (flat line)", () => {
    const data: SparklineData = { values: [5, 5, 5, 5], type: "line" };
    const svg = renderSparklineSvg(data);
    expect(svg).toContain("<polyline");
    // All Y values should be the same (midpoint)
    const info = parseSvg(svg);
    const points = info.points!.split(" ");
    const yValues = points.map((p) => parseFloat(p.split(",")[1]));
    expect(new Set(yValues).size).toBe(1);
  });

  it("should handle negative values in line sparkline", () => {
    const data: SparklineData = { values: [-3, -1, 0, 2, 4], type: "line" };
    const svg = renderSparklineSvg(data);
    expect(svg).toContain("<polyline");
    const info = parseSvg(svg);
    const points = info.points!.split(" ");
    // The highest value (4) should have the lowest Y coordinate
    const yValues = points.map((p) => parseFloat(p.split(",")[1]));
    expect(yValues[4]).toBeLessThan(yValues[0]);
  });

  it("should produce correct number of points", () => {
    const values = [1, 2, 3, 4, 5];
    const data: SparklineData = { values, type: "line" };
    const info = parseSvg(renderSparklineSvg(data));
    const points = info.points!.split(" ");
    expect(points.length).toBe(values.length);
  });
});

// ── Bar sparkline tests ─────────────────────────────────────────────────

describe("renderSparklineSvg — bar type", () => {
  it("should render rect elements for each value", () => {
    const data: SparklineData = { values: [1, 3, 2, 5], type: "bar" };
    const info = parseSvg(renderSparklineSvg(data));
    expect(info.rectCount).toBe(4);
    expect(info.hasPolyline).toBe(false);
  });

  it("should use positive color for positive values", () => {
    const data: SparklineData = {
      values: [1, 2, 3],
      type: "bar",
      color: "#00ff00",
    };
    const info = parseSvg(renderSparklineSvg(data));
    // All fills should be the positive color
    expect(info.fills.every((f) => f === "#00ff00" || f === "none")).toBe(true);
    expect(info.fills.filter((f) => f === "#00ff00").length).toBe(3);
  });

  it("should use negative color for negative values", () => {
    const data: SparklineData = {
      values: [-1, -2, -3],
      type: "bar",
      color: "#00ff00",
      negativeColor: "#ff0000",
    };
    const info = parseSvg(renderSparklineSvg(data));
    expect(info.fills.filter((f) => f === "#ff0000").length).toBe(3);
  });

  it("should handle mixed positive and negative values", () => {
    const data: SparklineData = {
      values: [3, -2, 5, -1],
      type: "bar",
      color: "#0000ff",
      negativeColor: "#ff0000",
    };
    const info = parseSvg(renderSparklineSvg(data));
    expect(info.fills.filter((f) => f === "#0000ff").length).toBe(2);
    expect(info.fills.filter((f) => f === "#ff0000").length).toBe(2);
  });

  it("should use default colors when not specified", () => {
    const data: SparklineData = { values: [1, -1], type: "bar" };
    const info = parseSvg(renderSparklineSvg(data));
    // Default positive: #2563eb, default negative: #dc2626
    expect(info.fills).toContain("#2563eb");
    expect(info.fills).toContain("#dc2626");
  });

  it("should respect custom dimensions", () => {
    const data: SparklineData = {
      values: [1, 2],
      type: "bar",
      width: 150,
      height: 30,
    };
    const info = parseSvg(renderSparklineSvg(data));
    expect(info.width).toBe(150);
    expect(info.height).toBe(30);
  });

  it("should handle a single bar value", () => {
    const data: SparklineData = { values: [10], type: "bar" };
    const info = parseSvg(renderSparklineSvg(data));
    expect(info.rectCount).toBe(1);
  });
});

// ── Win/Loss sparkline tests ────────────────────────────────────────────

describe("renderSparklineSvg — winLoss type", () => {
  it("should render rect elements for each value", () => {
    const data: SparklineData = { values: [1, -1, 1, -1, 1], type: "winLoss" };
    const info = parseSvg(renderSparklineSvg(data));
    expect(info.rectCount).toBe(5);
  });

  it("should use positive color for wins and negative color for losses", () => {
    const data: SparklineData = {
      values: [1, -1, 1],
      type: "winLoss",
      color: "#00cc00",
      negativeColor: "#cc0000",
    };
    const info = parseSvg(renderSparklineSvg(data));
    expect(info.fills.filter((f) => f === "#00cc00").length).toBe(2);
    expect(info.fills.filter((f) => f === "#cc0000").length).toBe(1);
  });

  it("should treat zero as a loss (negative)", () => {
    const data: SparklineData = {
      values: [0],
      type: "winLoss",
      color: "#00cc00",
      negativeColor: "#cc0000",
    };
    const info = parseSvg(renderSparklineSvg(data));
    expect(info.fills).toContain("#cc0000");
  });

  it("should have fixed-height bars (all same height)", () => {
    const data: SparklineData = {
      values: [1, -1, 5, -10],
      type: "winLoss",
      height: 20,
    };
    const svg = renderSparklineSvg(data);
    const heightMatches = [...svg.matchAll(/height="([^"]*)"/g)];
    // First match is the SVG element itself; remaining are the rect elements
    const rectHeights = heightMatches.slice(1).map((m) => parseFloat(m[1]));
    // All bars should have the same height (half of drawing area)
    expect(new Set(rectHeights).size).toBe(1);
  });

  it("should position positive bars in the top half", () => {
    const data: SparklineData = {
      values: [1],
      type: "winLoss",
      height: 20,
    };
    const svg = renderSparklineSvg(data);
    const yMatch = svg.match(/<rect[^>]*y="([^"]*)"/);
    expect(yMatch).toBeTruthy();
    const y = parseFloat(yMatch![1]);
    // With padding=2 and height=20, the positive bar should start at PADDING (2)
    expect(y).toBe(2);
  });

  it("should position negative bars in the bottom half", () => {
    const data: SparklineData = {
      values: [-1],
      type: "winLoss",
      height: 20,
    };
    const svg = renderSparklineSvg(data);
    const yMatch = svg.match(/<rect[^>]*y="([^"]*)"/);
    expect(yMatch).toBeTruthy();
    const y = parseFloat(yMatch![1]);
    // With padding=2 and height=20, halfH = 8, negative bar at PADDING + halfH = 10
    expect(y).toBe(10);
  });
});

// ── Edge cases ──────────────────────────────────────────────────────────

describe("renderSparklineSvg — edge cases", () => {
  it("should return an empty SVG for empty values array", () => {
    const data: SparklineData = { values: [], type: "line" };
    const svg = renderSparklineSvg(data);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).not.toContain("<polyline");
    expect(svg).not.toContain("<rect");
  });

  it("should return valid SVG for two data points (line)", () => {
    const data: SparklineData = { values: [0, 10], type: "line" };
    const svg = renderSparklineSvg(data);
    expect(svg).toContain("<polyline");
    const info = parseSvg(svg);
    const points = info.points!.split(" ");
    expect(points.length).toBe(2);
  });
});
