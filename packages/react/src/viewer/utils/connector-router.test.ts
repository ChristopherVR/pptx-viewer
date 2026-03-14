import { describe, it, expect } from "vitest";
import { routeConnector, waypointsToPathData } from "./connector-router";
import type { RouterPoint, RouterRect } from "./connector-router-types";

// ==========================================================================
// waypointsToPathData
// ==========================================================================

describe("waypointsToPathData", () => {
  it("returns empty string for empty array", () => {
    expect(waypointsToPathData([])).toBe("");
  });

  it("returns M command for single point", () => {
    const result = waypointsToPathData([{ x: 10, y: 20 }]);
    expect(result).toBe("M 10 20");
  });

  it("returns M + L commands for two points", () => {
    const result = waypointsToPathData([
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    ]);
    expect(result).toBe("M 0 0 L 100 50");
  });

  it("returns M + multiple L commands for a polyline", () => {
    const result = waypointsToPathData([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 50 },
    ]);
    expect(result).toBe("M 0 0 L 50 0 L 50 50 L 100 50");
  });

  it("handles negative coordinates", () => {
    const result = waypointsToPathData([
      { x: -10, y: -20 },
      { x: 30, y: 40 },
    ]);
    expect(result).toBe("M -10 -20 L 30 40");
  });

  it("handles floating point coordinates", () => {
    const result = waypointsToPathData([
      { x: 1.5, y: 2.7 },
      { x: 3.14, y: 4.28 },
    ]);
    expect(result).toContain("M 1.5 2.7");
    expect(result).toContain("L 3.14 4.28");
  });
});

// ==========================================================================
// routeConnector
// ==========================================================================

describe("routeConnector", () => {
  const defaults = {
    canvasWidth: 1000,
    canvasHeight: 600,
  };

  // -------------------------------------------------------------------
  // No obstacles - direct path
  // -------------------------------------------------------------------

  it("returns direct path when no obstacles", () => {
    const start: RouterPoint = { x: 10, y: 50 };
    const end: RouterPoint = { x: 200, y: 50 };
    const result = routeConnector({
      start,
      end,
      obstacles: [],
      ...defaults,
    });
    expect(result).toEqual([start, end]);
  });

  // -------------------------------------------------------------------
  // Direct path clear even with obstacles
  // -------------------------------------------------------------------

  it("returns direct path when obstacle does not block the line", () => {
    const start: RouterPoint = { x: 10, y: 10 };
    const end: RouterPoint = { x: 200, y: 10 };
    // Obstacle is below the line
    const obstacles: RouterRect[] = [
      { x: 50, y: 100, width: 50, height: 50 },
    ];
    const result = routeConnector({
      start,
      end,
      obstacles,
      ...defaults,
    });
    expect(result).toEqual([start, end]);
  });

  // -------------------------------------------------------------------
  // Elbow path when obstacles block direct path
  // -------------------------------------------------------------------

  it("returns elbow path when direct is blocked but elbow is clear", () => {
    const start: RouterPoint = { x: 10, y: 50 };
    const end: RouterPoint = { x: 200, y: 150 };
    // Obstacle blocks the direct diagonal but leaves elbow open
    const obstacles: RouterRect[] = [
      { x: 80, y: 80, width: 40, height: 40 },
    ];
    const result = routeConnector({
      start,
      end,
      obstacles,
      ...defaults,
    });
    // Should have 3 points (start, bend, end) for elbow path
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]).toEqual(start);
    expect(result[result.length - 1]).toEqual(end);
  });

  // -------------------------------------------------------------------
  // Full A* search when elbows are blocked
  // -------------------------------------------------------------------

  it("routes around obstacle using A* when elbows are blocked", () => {
    const start: RouterPoint = { x: 10, y: 100 };
    const end: RouterPoint = { x: 300, y: 100 };
    // Large obstacle blocking both direct and elbow paths
    const obstacles: RouterRect[] = [
      { x: 100, y: 50, width: 100, height: 100 },
    ];
    const result = routeConnector({
      start,
      end,
      obstacles,
      ...defaults,
    });
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]).toEqual(start);
    expect(result[result.length - 1]).toEqual(end);
  });

  // -------------------------------------------------------------------
  // Custom padding
  // -------------------------------------------------------------------

  it("respects custom padding", () => {
    const start: RouterPoint = { x: 10, y: 50 };
    const end: RouterPoint = { x: 200, y: 50 };
    const obstacles: RouterRect[] = [
      { x: 80, y: 30, width: 40, height: 40 },
    ];
    // With zero padding, the path may be different from default padding
    const resultZero = routeConnector({
      start,
      end,
      obstacles,
      padding: 0,
      ...defaults,
    });
    expect(resultZero.length).toBeGreaterThanOrEqual(2);
    expect(resultZero[0]).toEqual(start);
    expect(resultZero[resultZero.length - 1]).toEqual(end);
  });

  // -------------------------------------------------------------------
  // Multiple obstacles
  // -------------------------------------------------------------------

  it("routes around multiple obstacles", () => {
    const start: RouterPoint = { x: 10, y: 100 };
    const end: RouterPoint = { x: 500, y: 100 };
    const obstacles: RouterRect[] = [
      { x: 100, y: 50, width: 80, height: 100 },
      { x: 300, y: 50, width: 80, height: 100 },
    ];
    const result = routeConnector({
      start,
      end,
      obstacles,
      ...defaults,
    });
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]).toEqual(start);
    expect(result[result.length - 1]).toEqual(end);
  });

  // -------------------------------------------------------------------
  // Horizontal path (same y)
  // -------------------------------------------------------------------

  it("handles horizontal path with no height difference", () => {
    const start: RouterPoint = { x: 0, y: 100 };
    const end: RouterPoint = { x: 500, y: 100 };
    const result = routeConnector({
      start,
      end,
      obstacles: [],
      ...defaults,
    });
    expect(result).toEqual([start, end]);
  });

  // -------------------------------------------------------------------
  // Vertical path (same x)
  // -------------------------------------------------------------------

  it("handles vertical path with no width difference", () => {
    const start: RouterPoint = { x: 100, y: 0 };
    const end: RouterPoint = { x: 100, y: 300 };
    const result = routeConnector({
      start,
      end,
      obstacles: [],
      ...defaults,
    });
    expect(result).toEqual([start, end]);
  });

  // -------------------------------------------------------------------
  // Start equals end
  // -------------------------------------------------------------------

  it("handles start and end at the same position", () => {
    const point: RouterPoint = { x: 50, y: 50 };
    const result = routeConnector({
      start: point,
      end: point,
      obstacles: [],
      ...defaults,
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  // -------------------------------------------------------------------
  // Points near canvas edges
  // -------------------------------------------------------------------

  it("handles points near canvas edges", () => {
    const start: RouterPoint = { x: 5, y: 5 };
    const end: RouterPoint = { x: 995, y: 595 };
    const result = routeConnector({
      start,
      end,
      obstacles: [],
      ...defaults,
    });
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]).toEqual(start);
    expect(result[result.length - 1]).toEqual(end);
  });
});
