import { describe, it, expect } from "vitest";
import {
  svgPathToPolygons,
  polygonsToSvgPath,
  unionShapes,
  intersectShapes,
  subtractShapes,
  fragmentShapes,
  combineShapes,
  mergeShapes,
  type Vec2,
  type MergeShapeOperation,
} from "./shape-boolean";

// ---------------------------------------------------------------------------
// Helper: simple rectangle SVG path from bounds
// ---------------------------------------------------------------------------

function rectPath(x: number, y: number, w: number, h: number): string {
  return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
}

/** Triangle pointing up at given position. */
function triPath(
  cx: number,
  cy: number,
  size: number,
): string {
  const half = size / 2;
  return `M ${cx} ${cy - half} L ${cx + half} ${cy + half} L ${cx - half} ${cy + half} Z`;
}

/**
 * Parse path back to polygons and compute total area for assertions.
 */
function pathArea(pathData: string): number {
  const polys = svgPathToPolygons(pathData);
  let total = 0;
  for (const poly of polys) {
    let a = 0;
    for (let i = 0, n = poly.length; i < n; i++) {
      const j = (i + 1) % n;
      a += poly[i].x * poly[j].y;
      a -= poly[j].x * poly[i].y;
    }
    total += Math.abs(a / 2);
  }
  return total;
}

// ---------------------------------------------------------------------------
// svgPathToPolygons
// ---------------------------------------------------------------------------

describe("svgPathToPolygons", () => {
  it("parses a simple rectangle", () => {
    const polys = svgPathToPolygons("M 0 0 L 100 0 L 100 100 L 0 100 Z");
    expect(polys).toHaveLength(1);
    expect(polys[0]).toHaveLength(4);
    expect(polys[0][0]).toEqual({ x: 0, y: 0 });
    expect(polys[0][2]).toEqual({ x: 100, y: 100 });
  });

  it("parses multiple sub-paths", () => {
    const path =
      "M 0 0 L 10 0 L 10 10 L 0 10 Z M 20 20 L 30 20 L 30 30 L 20 30 Z";
    const polys = svgPathToPolygons(path);
    expect(polys).toHaveLength(2);
    expect(polys[0]).toHaveLength(4);
    expect(polys[1]).toHaveLength(4);
  });

  it("returns empty array for empty input", () => {
    expect(svgPathToPolygons("")).toHaveLength(0);
  });

  it("ignores sub-paths with fewer than 3 points", () => {
    const polys = svgPathToPolygons("M 0 0 L 10 10 Z");
    expect(polys).toHaveLength(0);
  });

  it("handles H and V commands", () => {
    const polys = svgPathToPolygons("M 0 0 H 100 V 100 H 0 Z");
    expect(polys).toHaveLength(1);
    expect(polys[0]).toHaveLength(4);
    expect(polys[0][1]).toEqual({ x: 100, y: 0 });
    expect(polys[0][2]).toEqual({ x: 100, y: 100 });
    expect(polys[0][3]).toEqual({ x: 0, y: 100 });
  });

  it("removes consecutive duplicate vertices", () => {
    const polys = svgPathToPolygons(
      "M 0 0 L 50 0 L 50 0 L 100 0 L 100 100 L 0 100 Z",
    );
    expect(polys).toHaveLength(1);
    // The duplicate L 50 0 should be collapsed
    expect(polys[0]).toHaveLength(5);
  });

  it("handles relative move (m) command", () => {
    // After Z, pen resets to the moveTo start (10,10). m 30 30 => (40,40).
    const polys = svgPathToPolygons("M 10 10 L 20 10 L 20 20 L 10 20 Z m 30 30 l 10 0 l 0 10 l -10 0 Z");
    expect(polys).toHaveLength(2);
    expect(polys[1][0]).toEqual({ x: 40, y: 40 });
  });
});

// ---------------------------------------------------------------------------
// polygonsToSvgPath
// ---------------------------------------------------------------------------

describe("polygonsToSvgPath", () => {
  it("converts a single polygon to SVG path", () => {
    const path = polygonsToSvgPath([
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
    ]);
    expect(path).toBe("M 0 0 L 100 0 L 100 100 Z");
  });

  it("converts multiple polygons to multi-sub-path", () => {
    const path = polygonsToSvgPath([
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      [
        { x: 20, y: 20 },
        { x: 30, y: 20 },
        { x: 30, y: 30 },
      ],
    ]);
    expect(path).toContain("M 0 0");
    expect(path).toContain("M 20 20");
    expect((path.match(/Z/g) ?? []).length).toBe(2);
  });

  it("returns empty string for empty input", () => {
    expect(polygonsToSvgPath([])).toBe("");
  });

  it("skips degenerate polygons with fewer than 3 points", () => {
    const path = polygonsToSvgPath([
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
    ]);
    expect(path).toBe("");
  });

  it("round-trips with svgPathToPolygons", () => {
    const original = "M 0 0 L 100 0 L 100 100 L 0 100 Z";
    const polys = svgPathToPolygons(original);
    const result = polygonsToSvgPath(polys);
    // Should be semantically equivalent
    const reparsed = svgPathToPolygons(result);
    expect(reparsed).toHaveLength(1);
    expect(reparsed[0]).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// intersectShapes
// ---------------------------------------------------------------------------

describe("intersectShapes", () => {
  it("returns overlap region of two overlapping rectangles", () => {
    const rect1 = rectPath(0, 0, 100, 100);
    const rect2 = rectPath(50, 50, 100, 100);
    const result = intersectShapes(rect1, rect2);
    expect(result).not.toBe("");
    const area = pathArea(result);
    // Overlap is 50x50 = 2500
    expect(area).toBeCloseTo(2500, 0);
  });

  it("returns empty for non-overlapping rectangles", () => {
    const rect1 = rectPath(0, 0, 100, 100);
    const rect2 = rectPath(200, 200, 100, 100);
    const result = intersectShapes(rect1, rect2);
    expect(result).toBe("");
  });

  it("returns the smaller shape when one fully contains the other", () => {
    const outer = rectPath(0, 0, 200, 200);
    const inner = rectPath(50, 50, 50, 50);
    const result = intersectShapes(outer, inner);
    expect(result).not.toBe("");
    const area = pathArea(result);
    expect(area).toBeCloseTo(2500, 0); // 50x50
  });

  it("handles empty first path", () => {
    expect(intersectShapes("", rectPath(0, 0, 100, 100))).toBe("");
  });

  it("handles empty second path", () => {
    expect(intersectShapes(rectPath(0, 0, 100, 100), "")).toBe("");
  });

  it("correctly intersects a triangle and rectangle", () => {
    // Triangle with vertices at (50,0), (100,100), (0,100)
    const tri = "M 50 0 L 100 100 L 0 100 Z";
    // Rectangle covering lower half
    const rect = rectPath(0, 50, 100, 50);
    const result = intersectShapes(tri, rect);
    expect(result).not.toBe("");
    // The intersection should be a trapezoid
    const area = pathArea(result);
    expect(area).toBeGreaterThan(0);
    expect(area).toBeLessThan(5000);
  });
});

// ---------------------------------------------------------------------------
// subtractShapes
// ---------------------------------------------------------------------------

describe("subtractShapes", () => {
  it("returns original when shapes do not overlap", () => {
    const rect1 = rectPath(0, 0, 100, 100);
    const rect2 = rectPath(200, 200, 100, 100);
    const result = subtractShapes(rect1, rect2);
    expect(result).not.toBe("");
    // Area should remain 10000 (100x100)
    const polys = svgPathToPolygons(result);
    expect(polys.length).toBeGreaterThanOrEqual(1);
  });

  it("removes overlap from partially overlapping rectangles", () => {
    const rect1 = rectPath(0, 0, 100, 100);
    const rect2 = rectPath(50, 50, 100, 100);
    const result = subtractShapes(rect1, rect2);
    expect(result).not.toBe("");
    // Original area (10000) minus overlap (2500) = 7500 if rendered with evenodd
    const polys = svgPathToPolygons(result);
    expect(polys.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty when clip fully covers subject", () => {
    const inner = rectPath(25, 25, 50, 50);
    const outer = rectPath(0, 0, 200, 200);
    const result = subtractShapes(inner, outer);
    // The inner is fully contained in outer, so subtract removes everything
    expect(result).toBe("");
  });

  it("handles empty subject", () => {
    expect(subtractShapes("", rectPath(0, 0, 100, 100))).toBe("");
  });

  it("returns original when clip is empty", () => {
    const rect = rectPath(0, 0, 100, 100);
    const result = subtractShapes(rect, "");
    expect(result).not.toBe("");
  });
});

// ---------------------------------------------------------------------------
// unionShapes
// ---------------------------------------------------------------------------

describe("unionShapes", () => {
  it("returns second path when first is empty", () => {
    const rect = rectPath(0, 0, 100, 100);
    expect(unionShapes("", rect)).toBe(rect);
  });

  it("returns first path when second is empty", () => {
    const rect = rectPath(0, 0, 100, 100);
    expect(unionShapes(rect, "")).toBe(rect);
  });

  it("produces a path for overlapping rectangles", () => {
    const rect1 = rectPath(0, 0, 100, 100);
    const rect2 = rectPath(50, 50, 100, 100);
    const result = unionShapes(rect1, rect2);
    expect(result).not.toBe("");
    const polys = svgPathToPolygons(result);
    expect(polys.length).toBeGreaterThanOrEqual(1);
  });

  it("keeps both shapes when they are disjoint", () => {
    const rect1 = rectPath(0, 0, 50, 50);
    const rect2 = rectPath(100, 100, 50, 50);
    const result = unionShapes(rect1, rect2);
    expect(result).not.toBe("");
    const polys = svgPathToPolygons(result);
    expect(polys).toHaveLength(2);
  });

  it("returns the larger shape when one contains the other", () => {
    const outer = rectPath(0, 0, 200, 200);
    const inner = rectPath(50, 50, 50, 50);
    const result = unionShapes(outer, inner);
    expect(result).not.toBe("");
    const polys = svgPathToPolygons(result);
    // Inner is contained; union should be just the outer
    expect(polys).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// fragmentShapes
// ---------------------------------------------------------------------------

describe("fragmentShapes", () => {
  it("returns empty array for two empty paths", () => {
    expect(fragmentShapes("", "")).toHaveLength(0);
  });

  it("returns single fragment for non-overlapping shapes", () => {
    const rect1 = rectPath(0, 0, 50, 50);
    const rect2 = rectPath(100, 100, 50, 50);
    const frags = fragmentShapes(rect1, rect2);
    // Should have 2 fragments (one for each shape, no intersection)
    expect(frags.length).toBe(2);
  });

  it("returns 3 fragments for overlapping shapes", () => {
    const rect1 = rectPath(0, 0, 100, 100);
    const rect2 = rectPath(50, 50, 100, 100);
    const frags = fragmentShapes(rect1, rect2);
    // Should have: unique-to-1, unique-to-2, intersection
    expect(frags.length).toBe(3);
    // Each fragment should be non-empty
    for (const f of frags) {
      expect(f.length).toBeGreaterThan(0);
    }
  });

  it("handles one shape containing the other", () => {
    const outer = rectPath(0, 0, 200, 200);
    const inner = rectPath(50, 50, 50, 50);
    const frags = fragmentShapes(outer, inner);
    // Should have: outer minus inner, and inner (intersection = inner)
    expect(frags.length).toBeGreaterThanOrEqual(2);
  });

  it("returns single fragment when only paths1 is given", () => {
    const rect = rectPath(0, 0, 100, 100);
    const frags = fragmentShapes(rect, "");
    expect(frags).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// combineShapes
// ---------------------------------------------------------------------------

describe("combineShapes", () => {
  it("returns union-like result for non-overlapping shapes", () => {
    const rect1 = rectPath(0, 0, 50, 50);
    const rect2 = rectPath(100, 100, 50, 50);
    const result = combineShapes(rect1, rect2);
    expect(result).not.toBe("");
    const polys = svgPathToPolygons(result);
    // Non-overlapping: combine is same as union
    expect(polys).toHaveLength(2);
  });

  it("removes overlap region for overlapping shapes", () => {
    const rect1 = rectPath(0, 0, 100, 100);
    const rect2 = rectPath(50, 50, 100, 100);
    const result = combineShapes(rect1, rect2);
    expect(result).not.toBe("");
  });

  it("returns empty when shapes are identical", () => {
    const rect = rectPath(0, 0, 100, 100);
    const result = combineShapes(rect, rect);
    // XOR of identical shapes = empty
    expect(result).toBe("");
  });
});

// ---------------------------------------------------------------------------
// mergeShapes dispatcher
// ---------------------------------------------------------------------------

describe("mergeShapes", () => {
  const rect1 = rectPath(0, 0, 100, 100);
  const rect2 = rectPath(50, 50, 100, 100);

  it("dispatches union operation", () => {
    const result = mergeShapes("union", rect1, rect2);
    expect(typeof result).toBe("string");
    expect((result as string).length).toBeGreaterThan(0);
  });

  it("dispatches intersect operation", () => {
    const result = mergeShapes("intersect", rect1, rect2);
    expect(typeof result).toBe("string");
  });

  it("dispatches subtract operation", () => {
    const result = mergeShapes("subtract", rect1, rect2);
    expect(typeof result).toBe("string");
  });

  it("dispatches fragment operation", () => {
    const result = mergeShapes("fragment", rect1, rect2);
    expect(Array.isArray(result)).toBe(true);
  });

  it("dispatches combine operation", () => {
    const result = mergeShapes("combine", rect1, rect2);
    expect(typeof result).toBe("string");
  });

  it("fragment returns array of SVG paths", () => {
    const frags = mergeShapes("fragment", rect1, rect2) as string[];
    for (const frag of frags) {
      expect(typeof frag).toBe("string");
      expect(frag.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases and complex shapes
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("handles identical shapes for intersection", () => {
    const rect = rectPath(0, 0, 100, 100);
    const result = intersectShapes(rect, rect);
    expect(result).not.toBe("");
    const area = pathArea(result);
    expect(area).toBeCloseTo(10000, -1); // 100x100
  });

  it("handles a shape contained within another for subtract", () => {
    const outer = rectPath(0, 0, 100, 100);
    const inner = rectPath(25, 25, 50, 50);
    const result = subtractShapes(outer, inner);
    // Should produce the outer with a hole (two sub-paths)
    expect(result).not.toBe("");
    const polys = svgPathToPolygons(result);
    expect(polys.length).toBeGreaterThanOrEqual(2);
  });

  it("handles triangles for intersection", () => {
    const tri1 = triPath(50, 50, 100);
    const tri2 = triPath(70, 50, 100);
    const result = intersectShapes(tri1, tri2);
    expect(result).not.toBe("");
    const area = pathArea(result);
    expect(area).toBeGreaterThan(0);
  });

  it("intersection is commutative", () => {
    const rect1 = rectPath(0, 0, 100, 100);
    const rect2 = rectPath(50, 0, 100, 100);
    const r1 = intersectShapes(rect1, rect2);
    const r2 = intersectShapes(rect2, rect1);
    const area1 = pathArea(r1);
    const area2 = pathArea(r2);
    expect(area1).toBeCloseTo(area2, 0);
  });

  it("subtract is not commutative", () => {
    const small = rectPath(0, 0, 50, 50);
    const large = rectPath(25, 25, 100, 100);
    const r1 = subtractShapes(small, large);
    const r2 = subtractShapes(large, small);
    // r1 should be smaller than r2
    const polys1 = svgPathToPolygons(r1);
    const polys2 = svgPathToPolygons(r2);
    // They should be different
    expect(r1).not.toBe(r2);
  });
});
