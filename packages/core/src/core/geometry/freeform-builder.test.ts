import { describe, it, expect, beforeEach } from "vitest";
import {
  FreeformPathBuilder,
  douglasPeucker,
  catmullRomToBezier,
} from "./freeform-builder";
import type { CustomGeometryPoint } from "../types";

// ===========================================================================
// douglasPeucker
// ===========================================================================

describe("douglasPeucker", () => {
  it("returns the same points when there are 2 or fewer", () => {
    const pts: CustomGeometryPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ];
    const result = douglasPeucker(pts, 1);
    expect(result).toEqual(pts);
  });

  it("returns a new array (does not mutate input)", () => {
    const pts: CustomGeometryPoint[] = [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
    ];
    const result = douglasPeucker(pts, 1);
    expect(result).not.toBe(pts);
  });

  it("removes collinear intermediate points", () => {
    // Points on a straight line y = x
    const pts: CustomGeometryPoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 4 },
    ];
    const result = douglasPeucker(pts, 0.1);
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 4 },
    ]);
  });

  it("keeps points that deviate beyond tolerance", () => {
    const pts: CustomGeometryPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 100 }, // far from line (0,0)-(100,0)
      { x: 100, y: 0 },
    ];
    const result = douglasPeucker(pts, 5);
    expect(result).toHaveLength(3);
    expect(result[1]).toEqual({ x: 50, y: 100 });
  });

  it("removes points within tolerance", () => {
    const pts: CustomGeometryPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0.5 }, // very close to line (0,0)-(100,0)
      { x: 100, y: 0 },
    ];
    const result = douglasPeucker(pts, 1);
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
  });

  it("handles a zigzag pattern with appropriate tolerance", () => {
    const pts: CustomGeometryPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 20 },
      { x: 20, y: 0 },
      { x: 30, y: 20 },
      { x: 40, y: 0 },
    ];
    // With a very small tolerance, should keep most points
    const tight = douglasPeucker(pts, 0.01);
    expect(tight.length).toBeGreaterThanOrEqual(4);

    // With a large tolerance, should reduce aggressively
    const loose = douglasPeucker(pts, 50);
    expect(loose).toHaveLength(2);
  });

  it("returns single point when input has one point", () => {
    const pts: CustomGeometryPoint[] = [{ x: 5, y: 5 }];
    const result = douglasPeucker(pts, 1);
    expect(result).toEqual([{ x: 5, y: 5 }]);
  });

  it("handles coincident start and end points", () => {
    const pts: CustomGeometryPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 0, y: 0 },
    ];
    const result = douglasPeucker(pts, 1);
    // The middle point is far from the (degenerate) line between
    // coincident start/end, so it must be kept
    expect(result).toHaveLength(3);
  });
});

// ===========================================================================
// catmullRomToBezier
// ===========================================================================

describe("catmullRomToBezier", () => {
  it("returns empty array for fewer than 2 points", () => {
    expect(catmullRomToBezier([])).toEqual([]);
    expect(catmullRomToBezier([{ x: 0, y: 0 }])).toEqual([]);
  });

  it("produces one curve segment for 2 points", () => {
    const pts: CustomGeometryPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ];
    const curves = catmullRomToBezier(pts);
    expect(curves).toHaveLength(1);
    // End point of the curve should be the second input point
    expect(curves[0][2]).toEqual({ x: 100, y: 100 });
  });

  it("produces N-1 curve segments for N points", () => {
    const pts: CustomGeometryPoint[] = [
      { x: 0, y: 0 },
      { x: 30, y: 50 },
      { x: 60, y: 20 },
      { x: 100, y: 80 },
    ];
    const curves = catmullRomToBezier(pts);
    expect(curves).toHaveLength(3);
  });

  it("each curve has 3 control/end points", () => {
    const pts: CustomGeometryPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 },
    ];
    const curves = catmullRomToBezier(pts);
    for (const curve of curves) {
      expect(curve).toHaveLength(3);
      // Each point should have x and y
      for (const pt of curve) {
        expect(typeof pt.x).toBe("number");
        expect(typeof pt.y).toBe("number");
      }
    }
  });

  it("endpoint of each segment matches the next input point", () => {
    const pts: CustomGeometryPoint[] = [
      { x: 0, y: 0 },
      { x: 25, y: 75 },
      { x: 50, y: 25 },
      { x: 100, y: 50 },
    ];
    const curves = catmullRomToBezier(pts);
    for (let i = 0; i < curves.length; i++) {
      expect(curves[i][2]).toEqual(pts[i + 1]);
    }
  });

  it("respects the factor parameter for tangent magnitude", () => {
    const pts: CustomGeometryPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 0 },
    ];
    const tight = catmullRomToBezier(pts, 3);
    const gentle = catmullRomToBezier(pts, 12);
    // A smaller factor produces larger tangents => control points
    // deviate more from the chord
    const tightDev =
      Math.abs(tight[0][0].x - pts[0].x) +
      Math.abs(tight[0][0].y - pts[0].y);
    const gentleDev =
      Math.abs(gentle[0][0].x - pts[0].x) +
      Math.abs(gentle[0][0].y - pts[0].y);
    expect(tightDev).toBeGreaterThan(gentleDev);
  });
});

// ===========================================================================
// FreeformPathBuilder
// ===========================================================================

describe("FreeformPathBuilder", () => {
  let builder: FreeformPathBuilder;

  beforeEach(() => {
    builder = new FreeformPathBuilder();
  });

  // -- addPoint / getPoints ------------------------------------------------

  it("starts with no points", () => {
    expect(builder.getPoints()).toEqual([]);
  });

  it("accumulates points via addPoint", () => {
    builder.addPoint(10, 20).addPoint(30, 40);
    expect(builder.getPoints()).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ]);
  });

  it("addPoint returns this for chaining", () => {
    const result = builder.addPoint(0, 0);
    expect(result).toBe(builder);
  });

  // -- close / isClosed ----------------------------------------------------

  it("is not closed by default", () => {
    expect(builder.isClosed()).toBe(false);
  });

  it("close() marks the path as closed", () => {
    builder.close();
    expect(builder.isClosed()).toBe(true);
  });

  it("close() returns this for chaining", () => {
    expect(builder.close()).toBe(builder);
  });

  // -- toSvgPath (polyline mode) -------------------------------------------

  it("returns empty string when no points", () => {
    expect(builder.toSvgPath()).toBe("");
  });

  it("produces M for a single point", () => {
    builder.addPoint(5, 10);
    expect(builder.toSvgPath()).toBe("M 5 10");
  });

  it("produces M + L commands for multiple points", () => {
    builder.addPoint(0, 0).addPoint(100, 50).addPoint(200, 0);
    expect(builder.toSvgPath()).toBe("M 0 0 L 100 50 L 200 0");
  });

  it("appends Z when closed", () => {
    builder.addPoint(0, 0).addPoint(100, 0).addPoint(100, 100).close();
    expect(builder.toSvgPath()).toBe("M 0 0 L 100 0 L 100 100 Z");
  });

  // -- toSvgPath (smoothed mode) -------------------------------------------

  it("produces M + C commands after smooth()", () => {
    builder
      .addPoint(0, 0)
      .addPoint(50, 100)
      .addPoint(100, 0)
      .smooth();
    const path = builder.toSvgPath();
    expect(path).toMatch(/^M 0 0 C /);
    // Should have 2 cubic segments (3 points => 2 spans)
    const cCount = (path.match(/C /g) ?? []).length;
    expect(cCount).toBe(2);
  });

  it("smooth() returns this for chaining", () => {
    builder.addPoint(0, 0).addPoint(10, 10);
    expect(builder.smooth()).toBe(builder);
  });

  it("isSmoothed() reflects smooth state", () => {
    builder.addPoint(0, 0).addPoint(10, 10);
    expect(builder.isSmoothed()).toBe(false);
    builder.smooth();
    expect(builder.isSmoothed()).toBe(true);
  });

  it("adding a point after smooth invalidates smoothed state", () => {
    builder.addPoint(0, 0).addPoint(10, 10).smooth();
    expect(builder.isSmoothed()).toBe(true);
    builder.addPoint(20, 20);
    expect(builder.isSmoothed()).toBe(false);
    // Should fall back to L commands
    expect(builder.toSvgPath()).toMatch(/L /);
  });

  // -- simplify ------------------------------------------------------------

  it("simplify() returns this for chaining", () => {
    builder.addPoint(0, 0).addPoint(5, 5).addPoint(10, 10);
    expect(builder.simplify(1)).toBe(builder);
  });

  it("simplify removes collinear intermediate points", () => {
    // Horizontal line with many intermediate points
    for (let i = 0; i <= 100; i++) {
      builder.addPoint(i, 0);
    }
    builder.simplify(0.1);
    // Should reduce to just start and end
    expect(builder.getPoints()).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
  });

  it("simplify preserves shape-defining points", () => {
    builder
      .addPoint(0, 0)
      .addPoint(50, 100) // important corner
      .addPoint(100, 0);
    builder.simplify(1);
    expect(builder.getPoints()).toHaveLength(3);
  });

  it("simplify with tolerance 0 keeps all non-collinear points", () => {
    builder.addPoint(0, 0).addPoint(10, 5).addPoint(20, 0);
    builder.simplify(0);
    // All points are non-collinear so should be kept
    expect(builder.getPoints()).toHaveLength(3);
  });

  it("simplify does nothing for 2 or fewer points", () => {
    builder.addPoint(0, 0).addPoint(10, 10);
    builder.simplify(100);
    expect(builder.getPoints()).toHaveLength(2);
  });

  it("simplify invalidates smoothed state", () => {
    builder
      .addPoint(0, 0)
      .addPoint(50, 100)
      .addPoint(100, 0)
      .smooth();
    expect(builder.isSmoothed()).toBe(true);
    builder.simplify(1);
    expect(builder.isSmoothed()).toBe(false);
  });

  // -- toCustomGeometryPaths (polyline mode) --------------------------------

  it("returns single empty path when no points", () => {
    const paths = builder.toCustomGeometryPaths();
    expect(paths).toHaveLength(1);
    expect(paths[0].segments).toEqual([]);
    expect(paths[0].width).toBe(1);
    expect(paths[0].height).toBe(1);
  });

  it("emits moveTo + lineTo segments for polyline", () => {
    builder.addPoint(0, 0).addPoint(100, 50).addPoint(200, 100);
    const paths = builder.toCustomGeometryPaths();
    expect(paths).toHaveLength(1);
    expect(paths[0].segments).toEqual([
      { type: "moveTo", pt: { x: 0, y: 0 } },
      { type: "lineTo", pt: { x: 100, y: 50 } },
      { type: "lineTo", pt: { x: 200, y: 100 } },
    ]);
  });

  it("appends close segment when closed", () => {
    builder.addPoint(0, 0).addPoint(100, 0).addPoint(100, 100).close();
    const paths = builder.toCustomGeometryPaths();
    const segs = paths[0].segments;
    expect(segs[segs.length - 1]).toEqual({ type: "close" });
  });

  it("computes correct bounding dimensions", () => {
    builder.addPoint(10, 20).addPoint(300, 150);
    const paths = builder.toCustomGeometryPaths();
    expect(paths[0].width).toBe(300);
    expect(paths[0].height).toBe(150);
  });

  it("enforces minimum dimensions of 1", () => {
    builder.addPoint(0, 0);
    const paths = builder.toCustomGeometryPaths();
    expect(paths[0].width).toBe(1);
    expect(paths[0].height).toBe(1);
  });

  // -- toCustomGeometryPaths (smoothed mode) --------------------------------

  it("emits cubicBezTo segments after smooth()", () => {
    builder
      .addPoint(0, 0)
      .addPoint(50, 100)
      .addPoint(100, 0)
      .smooth();
    const paths = builder.toCustomGeometryPaths();
    const segs = paths[0].segments;
    // First segment is moveTo
    expect(segs[0].type).toBe("moveTo");
    // Remaining segments are cubicBezTo
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].type).toBe("cubicBezTo");
    }
  });

  // -- full pipeline: simplify + smooth + output ----------------------------

  it("pipeline: simplify then smooth produces valid SVG", () => {
    // Simulate freeform input with many points
    for (let i = 0; i <= 50; i++) {
      const x = i * 2;
      const y = Math.sin(i * 0.2) * 50 + 50;
      builder.addPoint(x, y);
    }
    builder.simplify(3).smooth(6);

    const path = builder.toSvgPath();
    expect(path).toMatch(/^M /);
    expect(path).toMatch(/C /);
    // Point count should be reduced from original 51
    expect(builder.getPoints().length).toBeLessThan(51);
  });

  it("pipeline: simplify then smooth produces valid geometry paths", () => {
    builder
      .addPoint(0, 0)
      .addPoint(10, 30)
      .addPoint(20, 10)
      .addPoint(30, 40)
      .addPoint(40, 5)
      .simplify(1)
      .smooth(6);

    const paths = builder.toCustomGeometryPaths();
    expect(paths).toHaveLength(1);
    expect(paths[0].width).toBeGreaterThan(0);
    expect(paths[0].height).toBeGreaterThan(0);
    // Should have moveTo followed by cubicBezTo segments
    expect(paths[0].segments[0].type).toBe("moveTo");
    expect(
      paths[0].segments.filter((s) => s.type === "cubicBezTo").length,
    ).toBeGreaterThan(0);
  });

  it("closed smoothed path includes close segment", () => {
    builder
      .addPoint(0, 0)
      .addPoint(100, 0)
      .addPoint(100, 100)
      .addPoint(0, 100)
      .close()
      .smooth();
    const paths = builder.toCustomGeometryPaths();
    const segs = paths[0].segments;
    expect(segs[segs.length - 1]).toEqual({ type: "close" });
  });
});
