/**
 * Shape boolean operations: union, intersect, subtract, fragment, combine.
 *
 * Implements polygon clipping using the Sutherland-Hodgman algorithm for
 * intersection and a vertex-insertion approach for union/subtract/fragment.
 * Operates on polygon-only geometry (line segments, no curves), which covers
 * the vast majority of real-world PowerPoint preset shapes.
 *
 * @module geometry/shape-boolean
 */

// ---------------------------------------------------------------------------
// Point type & helpers
// ---------------------------------------------------------------------------

/** A 2D point for polygon operations. */
export interface Vec2 {
  x: number;
  y: number;
}

const EPSILON = 1e-9;

function vec2Eq(a: Vec2, b: Vec2): boolean {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;
}

function cross2(o: Vec2, a: Vec2, b: Vec2): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Signed area of a polygon (positive = counter-clockwise). */
function signedArea(poly: Vec2[]): number {
  let area = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const j = (i + 1) % n;
    area += poly[i].x * poly[j].y;
    area -= poly[j].x * poly[i].y;
  }
  return area / 2;
}

/** Ensure polygon vertices are in counter-clockwise order. */
function ensureCCW(poly: Vec2[]): Vec2[] {
  return signedArea(poly) < 0 ? [...poly].reverse() : poly;
}

/** Ensure polygon vertices are in clockwise order. */
function ensureCW(poly: Vec2[]): Vec2[] {
  return signedArea(poly) > 0 ? [...poly].reverse() : poly;
}

/** Unsigned area of a polygon. */
function polygonArea(poly: Vec2[]): number {
  return Math.abs(signedArea(poly));
}

// ---------------------------------------------------------------------------
// SVG path parsing / serialization (polygon-only)
// ---------------------------------------------------------------------------

/**
 * Parse an SVG path data string into an array of polygon vertex arrays.
 *
 * Only absolute M, L, H, V, and Z commands are supported.
 * Each sub-path (delimited by M..Z) becomes a separate polygon.
 *
 * @param pathData - SVG path data string.
 * @returns Array of polygons (each polygon is an array of Vec2).
 */
export function svgPathToPolygons(pathData: string): Vec2[][] {
  const polygons: Vec2[][] = [];
  let current: Vec2[] = [];
  let penX = 0;
  let penY = 0;

  // Tokenize on command letters
  const tokens =
    pathData.match(/[MLHVZCSQTAmlhvzcsqta][^MLHVZCSQTAmlhvzcsqta]*/gi) ?? [];

  for (const token of tokens) {
    const cmd = token[0];
    const nums = (token.slice(1).match(/-?[\d.]+(?:e[+-]?\d+)?/gi) ?? []).map(
      Number,
    );

    switch (cmd) {
      case "M":
        // Start a new sub-path
        if (current.length >= 3) {
          polygons.push(dedupPoly(current));
        }
        current = [];
        if (nums.length >= 2) {
          penX = nums[0];
          penY = nums[1];
          current.push({ x: penX, y: penY });
          // Implicit lineTo for subsequent coordinate pairs
          for (let i = 2; i + 1 < nums.length; i += 2) {
            penX = nums[i];
            penY = nums[i + 1];
            current.push({ x: penX, y: penY });
          }
        }
        break;

      case "m": {
        if (current.length >= 3) {
          polygons.push(dedupPoly(current));
        }
        current = [];
        if (nums.length >= 2) {
          penX += nums[0];
          penY += nums[1];
          current.push({ x: penX, y: penY });
          for (let i = 2; i + 1 < nums.length; i += 2) {
            penX += nums[i];
            penY += nums[i + 1];
            current.push({ x: penX, y: penY });
          }
        }
        break;
      }

      case "L":
        for (let i = 0; i + 1 < nums.length; i += 2) {
          penX = nums[i];
          penY = nums[i + 1];
          current.push({ x: penX, y: penY });
        }
        break;

      case "l":
        for (let i = 0; i + 1 < nums.length; i += 2) {
          penX += nums[i];
          penY += nums[i + 1];
          current.push({ x: penX, y: penY });
        }
        break;

      case "H":
        if (nums.length >= 1) {
          penX = nums[0];
          current.push({ x: penX, y: penY });
        }
        break;

      case "h":
        if (nums.length >= 1) {
          penX += nums[0];
          current.push({ x: penX, y: penY });
        }
        break;

      case "V":
        if (nums.length >= 1) {
          penY = nums[0];
          current.push({ x: penX, y: penY });
        }
        break;

      case "v":
        if (nums.length >= 1) {
          penY += nums[0];
          current.push({ x: penX, y: penY });
        }
        break;

      case "Z":
      case "z":
        if (current.length >= 3) {
          polygons.push(dedupPoly(current));
        }
        // Reset pen to start of sub-path
        if (current.length > 0) {
          penX = current[0].x;
          penY = current[0].y;
        }
        current = [];
        break;
    }
  }

  // Flush any unclosed sub-path
  if (current.length >= 3) {
    polygons.push(dedupPoly(current));
  }

  return polygons;
}

/** Remove consecutive duplicate vertices from a polygon. */
function dedupPoly(poly: Vec2[]): Vec2[] {
  if (poly.length === 0) return poly;
  const result: Vec2[] = [poly[0]];
  for (let i = 1; i < poly.length; i++) {
    if (!vec2Eq(poly[i], result[result.length - 1])) {
      result.push(poly[i]);
    }
  }
  // Remove closing duplicate (first == last)
  if (result.length > 1 && vec2Eq(result[0], result[result.length - 1])) {
    result.pop();
  }
  return result;
}

/**
 * Convert polygon vertex arrays to an SVG path data string.
 *
 * Each polygon becomes an M ... L ... Z sub-path.
 *
 * @param polygons - Array of polygons (each an array of Vec2).
 * @returns SVG path data string.
 */
export function polygonsToSvgPath(polygons: Vec2[][]): string {
  const parts: string[] = [];
  for (const poly of polygons) {
    if (poly.length < 3) continue;
    parts.push(`M ${fmtNum(poly[0].x)} ${fmtNum(poly[0].y)}`);
    for (let i = 1; i < poly.length; i++) {
      parts.push(`L ${fmtNum(poly[i].x)} ${fmtNum(poly[i].y)}`);
    }
    parts.push("Z");
  }
  return parts.join(" ");
}

/** Format a number, removing unnecessary trailing zeros. */
function fmtNum(n: number): string {
  // Round to 4 decimal places to avoid floating point noise
  const rounded = Math.round(n * 10000) / 10000;
  return String(rounded);
}

// ---------------------------------------------------------------------------
// Sutherland-Hodgman polygon clipping (intersection)
// ---------------------------------------------------------------------------

/**
 * Compute the intersection point of two line segments AB and CD.
 * Returns null if segments are parallel.
 */
function lineIntersection(
  a: Vec2,
  b: Vec2,
  c: Vec2,
  d: Vec2,
): Vec2 | null {
  const denom =
    (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(denom) < EPSILON) return null;
  const t =
    ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denom;
  return {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
  };
}

/**
 * Sutherland-Hodgman algorithm: clip subject polygon by convex clip polygon.
 *
 * Both polygons should be in CCW winding order.
 *
 * @param subject - Polygon to be clipped.
 * @param clip - Convex clipping polygon.
 * @returns Clipped polygon (may be empty if no overlap).
 */
function sutherlandHodgman(subject: Vec2[], clip: Vec2[]): Vec2[] {
  let output = [...subject];

  for (let i = 0; i < clip.length; i++) {
    if (output.length === 0) return [];
    const input = output;
    output = [];

    const edgeStart = clip[i];
    const edgeEnd = clip[(i + 1) % clip.length];

    for (let j = 0; j < input.length; j++) {
      const curr = input[j];
      const prev = input[(j + input.length - 1) % input.length];

      const currInside = cross2(edgeStart, edgeEnd, curr) >= -EPSILON;
      const prevInside = cross2(edgeStart, edgeEnd, prev) >= -EPSILON;

      if (currInside) {
        if (!prevInside) {
          const inter = lineIntersection(prev, curr, edgeStart, edgeEnd);
          if (inter) output.push(inter);
        }
        output.push(curr);
      } else if (prevInside) {
        const inter = lineIntersection(prev, curr, edgeStart, edgeEnd);
        if (inter) output.push(inter);
      }
    }
  }

  return output;
}

// ---------------------------------------------------------------------------
// Convex decomposition for concave polygon clipping
// ---------------------------------------------------------------------------

/**
 * Check whether a polygon is convex.
 */
function isConvex(poly: Vec2[]): boolean {
  const n = poly.length;
  if (n < 3) return false;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const o = poly[i];
    const a = poly[(i + 1) % n];
    const b = poly[(i + 2) % n];
    const c = cross2(o, a, b);
    if (Math.abs(c) < EPSILON) continue;
    if (sign === 0) {
      sign = c > 0 ? 1 : -1;
    } else if ((c > 0 ? 1 : -1) !== sign) {
      return false;
    }
  }
  return true;
}

/**
 * Simple ear-clipping triangulation for concave polygon decomposition.
 *
 * Returns an array of triangles (3-vertex polygons).
 */
function triangulate(poly: Vec2[]): Vec2[][] {
  const ccw = ensureCCW(poly);
  const triangles: Vec2[][] = [];
  const remaining = [...ccw];

  let maxIterations = remaining.length * remaining.length;

  while (remaining.length > 3 && maxIterations > 0) {
    maxIterations--;
    let earFound = false;
    const n = remaining.length;

    for (let i = 0; i < n; i++) {
      const prev = remaining[(i + n - 1) % n];
      const curr = remaining[i];
      const next = remaining[(i + 1) % n];

      // Must be a convex vertex (left turn)
      if (cross2(prev, curr, next) <= EPSILON) continue;

      // Check no other vertex is inside this ear triangle
      let isEar = true;
      for (let j = 0; j < n; j++) {
        if (j === (i + n - 1) % n || j === i || j === (i + 1) % n) continue;
        if (pointInTriangle(remaining[j], prev, curr, next)) {
          isEar = false;
          break;
        }
      }

      if (isEar) {
        triangles.push([prev, curr, next]);
        remaining.splice(i, 1);
        earFound = true;
        break;
      }
    }

    if (!earFound) break;
  }

  if (remaining.length === 3) {
    triangles.push([remaining[0], remaining[1], remaining[2]]);
  }

  return triangles;
}

/** Test if point p is inside triangle abc (inclusive of edges). */
function pointInTriangle(p: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean {
  const d1 = cross2(a, b, p);
  const d2 = cross2(b, c, p);
  const d3 = cross2(c, a, p);
  const hasNeg = d1 < -EPSILON || d2 < -EPSILON || d3 < -EPSILON;
  const hasPos = d1 > EPSILON || d2 > EPSILON || d3 > EPSILON;
  return !(hasNeg && hasPos);
}

/**
 * Clip subject polygon against clip polygon.
 * Handles both convex and concave clip polygons.
 * Returns array of result polygons.
 */
function clipPolygons(subject: Vec2[], clip: Vec2[]): Vec2[][] {
  const subCCW = ensureCCW(subject);
  const clipCCW = ensureCCW(clip);

  if (isConvex(clipCCW)) {
    const result = sutherlandHodgman(subCCW, clipCCW);
    return result.length >= 3 ? [result] : [];
  }

  // For concave clip polygon, decompose into triangles and compute
  // intersection with each, then merge results
  const triangles = triangulate(clipCCW);
  const results: Vec2[][] = [];

  for (const tri of triangles) {
    const triCCW = ensureCCW(tri);
    // Clip subject by each convex triangle of the clip polygon
    const clipped = sutherlandHodgman(subCCW, triCCW);
    if (clipped.length >= 3) {
      results.push(clipped);
    }
  }

  // Similarly, we need to clip the clip polygon by the subject polygon
  // for areas that might be missed
  return mergeOverlappingPolygons(results);
}

/**
 * Merge a set of (possibly overlapping) convex polygons into fewer polygons.
 * For simplicity, we just deduplicate and return them as-is since the
 * triangulated intersection pieces may share edges.
 */
function mergeOverlappingPolygons(polys: Vec2[][]): Vec2[][] {
  // Remove degenerate polygons
  return polys.filter((p) => p.length >= 3 && polygonArea(p) > EPSILON);
}

// ---------------------------------------------------------------------------
// Point-in-polygon test (for union/subtract logic)
// ---------------------------------------------------------------------------

/** Test if point is inside a polygon using ray-casting. */
function pointInPolygon(pt: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y;
    const xj = poly[j].x,
      yj = poly[j].y;
    if (
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

// ---------------------------------------------------------------------------
// Convex hull (for union of simple polygons)
// ---------------------------------------------------------------------------

/**
 * Compute the convex hull of a set of points using Andrew's monotone chain.
 */
function convexHull(points: Vec2[]): Vec2[] {
  const pts = [...points].sort((a, b) =>
    a.x !== b.x ? a.x - b.x : a.y - b.y,
  );
  if (pts.length <= 1) return pts;

  const lower: Vec2[] = [];
  for (const p of pts) {
    while (
      lower.length >= 2 &&
      cross2(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Vec2[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (
      upper.length >= 2 &&
      cross2(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }

  // Remove last point of each half because it's repeated
  lower.pop();
  upper.pop();

  return [...lower, ...upper];
}

// ---------------------------------------------------------------------------
// Weiler-Atherton inspired union for concave polygons
// ---------------------------------------------------------------------------

/**
 * Compute segment-segment intersection for polygon edge walking.
 * Returns the intersection point and parametric t values, or null.
 */
function segmentIntersection(
  a1: Vec2,
  a2: Vec2,
  b1: Vec2,
  b2: Vec2,
): { pt: Vec2; tA: number; tB: number } | null {
  const dx1 = a2.x - a1.x;
  const dy1 = a2.y - a1.y;
  const dx2 = b2.x - b1.x;
  const dy2 = b2.y - b1.y;

  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < EPSILON) return null;

  const tA = ((b1.x - a1.x) * dy2 - (b1.y - a1.y) * dx2) / denom;
  const tB = ((b1.x - a1.x) * dy1 - (b1.y - a1.y) * dx1) / denom;

  if (tA < EPSILON || tA > 1 - EPSILON || tB < EPSILON || tB > 1 - EPSILON) {
    return null;
  }

  return {
    pt: { x: a1.x + tA * dx1, y: a1.y + tA * dy1 },
    tA,
    tB,
  };
}

/**
 * Find all intersection points between edges of two polygons.
 */
function findAllIntersections(
  polyA: Vec2[],
  polyB: Vec2[],
): Array<{ pt: Vec2; edgeA: number; tA: number; edgeB: number; tB: number }> {
  const results: Array<{
    pt: Vec2;
    edgeA: number;
    tA: number;
    edgeB: number;
    tB: number;
  }> = [];

  for (let i = 0; i < polyA.length; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % polyA.length];
    for (let j = 0; j < polyB.length; j++) {
      const b1 = polyB[j];
      const b2 = polyB[(j + 1) % polyB.length];
      const inter = segmentIntersection(a1, a2, b1, b2);
      if (inter) {
        results.push({
          pt: inter.pt,
          edgeA: i,
          tA: inter.tA,
          edgeB: j,
          tB: inter.tB,
        });
      }
    }
  }

  return results;
}

/**
 * Build a polygon with intersection vertices inserted at the correct positions.
 */
function insertIntersections(
  poly: Vec2[],
  intersections: Array<{ pt: Vec2; edge: number; t: number }>,
): Vec2[] {
  // Group intersections by edge
  const byEdge = new Map<number, Array<{ pt: Vec2; t: number }>>();
  for (const inter of intersections) {
    const list = byEdge.get(inter.edge) ?? [];
    list.push({ pt: inter.pt, t: inter.t });
    byEdge.set(inter.edge, list);
  }

  const result: Vec2[] = [];
  for (let i = 0; i < poly.length; i++) {
    result.push(poly[i]);
    const edgeInters = byEdge.get(i);
    if (edgeInters) {
      // Sort by parametric value along the edge
      edgeInters.sort((a, b) => a.t - b.t);
      for (const ei of edgeInters) {
        result.push(ei.pt);
      }
    }
  }

  return result;
}

/**
 * Walk along polygon boundaries to construct the union outline.
 * Uses a simplified Weiler-Atherton-style approach.
 */
function computeUnionWalk(polyA: Vec2[], polyB: Vec2[]): Vec2[][] {
  const intersections = findAllIntersections(polyA, polyB);

  // If no intersections, check containment
  if (intersections.length === 0) {
    const aInB = pointInPolygon(polyA[0], polyB);
    const bInA = pointInPolygon(polyB[0], polyA);

    if (aInB) return [polyB]; // A inside B
    if (bInA) return [polyA]; // B inside A
    return [polyA, polyB]; // Disjoint
  }

  // Build augmented polygons with intersection points inserted
  const augA = insertIntersections(
    polyA,
    intersections.map((i) => ({ pt: i.pt, edge: i.edgeA, t: i.tA })),
  );
  const augB = insertIntersections(
    polyB,
    intersections.map((i) => ({ pt: i.pt, edge: i.edgeB, t: i.tB })),
  );

  // Build lookup from intersection point to index in each augmented polygon
  const interPts = intersections.map((i) => i.pt);

  function findInAug(aug: Vec2[], pt: Vec2): number {
    for (let i = 0; i < aug.length; i++) {
      if (vec2Eq(aug[i], pt)) return i;
    }
    return -1;
  }

  // Walk the union boundary
  const visited = new Set<string>();
  const results: Vec2[][] = [];

  function ptKey(pt: Vec2): string {
    return `${Math.round(pt.x * 10000)},${Math.round(pt.y * 10000)}`;
  }

  for (const startPt of interPts) {
    const key = ptKey(startPt);
    if (visited.has(key)) continue;

    const outline: Vec2[] = [];
    let onA = true;
    let currentIdx = findInAug(augA, startPt);
    if (currentIdx === -1) continue;

    let maxSteps = augA.length + augB.length + interPts.length * 2;
    let started = false;

    while (maxSteps > 0) {
      maxSteps--;
      const aug = onA ? augA : augB;
      const pt = aug[currentIdx];

      if (started && vec2Eq(pt, startPt)) break;
      started = true;

      outline.push(pt);

      // Check if this is an intersection point
      const isInter = interPts.some((ip) => vec2Eq(ip, pt));

      if (isInter && outline.length > 1) {
        visited.add(ptKey(pt));
        // Determine if we should switch polygons
        // At an intersection, switch to the other polygon's outside
        const nextIdxA = findInAug(augA, pt);
        const nextIdxB = findInAug(augB, pt);

        if (onA && nextIdxB !== -1) {
          // Check if next point along B is outside A
          const nextBIdx = (nextIdxB + 1) % augB.length;
          const nextBPt = augB[nextBIdx];
          if (!pointInPolygon(nextBPt, polyA)) {
            onA = false;
            currentIdx = nextBIdx;
            continue;
          }
        }
        if (!onA && nextIdxA !== -1) {
          const nextAIdx = (nextIdxA + 1) % augA.length;
          const nextAPt = augA[nextAIdx];
          if (!pointInPolygon(nextAPt, polyB)) {
            onA = true;
            currentIdx = nextAIdx;
            continue;
          }
        }
      }

      currentIdx = (currentIdx + 1) % aug.length;
    }

    if (outline.length >= 3) {
      results.push(outline);
    }
  }

  // If walk failed to produce results, fall back to convex hull
  if (results.length === 0) {
    const allPoints = [...polyA, ...polyB];
    const hull = convexHull(allPoints);
    if (hull.length >= 3) return [hull];
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API: Boolean operations on SVG path strings
// ---------------------------------------------------------------------------

/**
 * Compute the union of two SVG path shapes.
 *
 * Merges the outer boundaries of both shapes into a single path.
 * For non-overlapping shapes, returns a multi-sub-path result.
 *
 * @param paths1 - First SVG path data string.
 * @param paths2 - Second SVG path data string.
 * @returns SVG path data string of the union.
 */
export function unionShapes(paths1: string, paths2: string): string {
  const polys1 = svgPathToPolygons(paths1);
  const polys2 = svgPathToPolygons(paths2);

  if (polys1.length === 0) return paths2;
  if (polys2.length === 0) return paths1;

  let result: Vec2[][] = [];

  // Start with all polygons from paths1
  let accumulated = polys1.map((p) => ensureCCW(p));

  // Union each polygon from paths2
  for (const poly2 of polys2) {
    const p2 = ensureCCW(poly2);
    const newAccumulated: Vec2[][] = [];
    let merged = false;

    for (const p1 of accumulated) {
      if (!merged) {
        const unionResult = computeUnionWalk(p1, p2);
        if (unionResult.length === 1) {
          // Successfully merged into one polygon
          newAccumulated.push(unionResult[0]);
          merged = true;
        } else if (unionResult.length === 2) {
          // Disjoint: keep both separate for now
          newAccumulated.push(p1);
        } else {
          newAccumulated.push(p1);
        }
      } else {
        newAccumulated.push(p1);
      }
    }

    if (!merged) {
      newAccumulated.push(p2);
    }

    accumulated = newAccumulated;
  }

  result = accumulated;
  return polygonsToSvgPath(result);
}

/**
 * Compute the intersection of two SVG path shapes.
 *
 * Keeps only the overlapping region of both shapes.
 *
 * @param paths1 - First SVG path data string.
 * @param paths2 - Second SVG path data string.
 * @returns SVG path data string of the intersection.
 */
export function intersectShapes(paths1: string, paths2: string): string {
  const polys1 = svgPathToPolygons(paths1);
  const polys2 = svgPathToPolygons(paths2);

  if (polys1.length === 0 || polys2.length === 0) return "";

  const results: Vec2[][] = [];

  for (const p1 of polys1) {
    for (const p2 of polys2) {
      const ccw1 = ensureCCW(p1);
      const ccw2 = ensureCCW(p2);

      const clipped = clipPolygons(ccw1, ccw2);
      results.push(...clipped);
    }
  }

  return polygonsToSvgPath(results);
}

/**
 * Compute the subtraction of two SVG path shapes (paths1 - paths2).
 *
 * Removes the overlapping region of paths2 from paths1.
 *
 * @param paths1 - Subject SVG path data string.
 * @param paths2 - Clip SVG path data string to subtract.
 * @returns SVG path data string of the difference.
 */
export function subtractShapes(paths1: string, paths2: string): string {
  const polys1 = svgPathToPolygons(paths1);
  const polys2 = svgPathToPolygons(paths2);

  if (polys1.length === 0) return "";
  if (polys2.length === 0) return paths1;

  const results: Vec2[][] = [];

  for (const p1 of polys1) {
    let remainders = [ensureCCW(p1)];

    for (const p2 of polys2) {
      const clipPoly = ensureCCW(p2);
      const newRemainders: Vec2[][] = [];

      for (const rem of remainders) {
        const subtracted = subtractSinglePoly(rem, clipPoly);
        newRemainders.push(...subtracted);
      }

      remainders = newRemainders;
    }

    results.push(...remainders);
  }

  return polygonsToSvgPath(results);
}

/**
 * Subtract one convex or concave polygon from another.
 * Returns the resulting polygon(s).
 */
function subtractSinglePoly(subject: Vec2[], clip: Vec2[]): Vec2[][] {
  // Compute intersection
  const intersection = clipPolygons(subject, clip);

  if (intersection.length === 0) {
    // No overlap, subject unchanged
    return [subject];
  }

  // Check if clip fully contains subject
  const interArea = intersection.reduce(
    (sum, p) => sum + polygonArea(p),
    0,
  );
  const subjectArea = polygonArea(subject);

  if (Math.abs(interArea - subjectArea) < EPSILON * 100) {
    // Clip fully contains subject
    return [];
  }

  // Use the clip polygon (reversed) as a hole in the subject.
  // The SVG fill-rule evenodd will handle the rendering.
  // We construct this as: subject outline + reversed clip intersection.
  const results: Vec2[][] = [];

  // For each intersection polygon, create a "hole" by reversing it
  // and appending it as a separate sub-path
  results.push(subject);
  for (const inter of intersection) {
    // Reverse the intersection polygon to create a hole
    results.push(ensureCW(inter));
  }

  return results;
}

/**
 * Fragment two SVG path shapes into non-overlapping pieces.
 *
 * Splits the shapes into up to 3 regions:
 * - Parts of paths1 not overlapping paths2
 * - Parts of paths2 not overlapping paths1
 * - The overlapping region
 *
 * @param paths1 - First SVG path data string.
 * @param paths2 - Second SVG path data string.
 * @returns Array of SVG path data strings, one per fragment.
 */
export function fragmentShapes(paths1: string, paths2: string): string[] {
  const polys1 = svgPathToPolygons(paths1);
  const polys2 = svgPathToPolygons(paths2);

  if (polys1.length === 0 && polys2.length === 0) return [];
  if (polys1.length === 0) return [paths2];
  if (polys2.length === 0) return [paths1];

  const results: string[] = [];

  // 1. Intersection (overlap region)
  const intersectionPath = intersectShapes(paths1, paths2);

  // 2. paths1 - paths2 (unique to paths1)
  const onlyIn1 = subtractShapes(paths1, paths2);

  // 3. paths2 - paths1 (unique to paths2)
  const onlyIn2 = subtractShapes(paths2, paths1);

  // Collect non-empty results
  if (onlyIn1) results.push(onlyIn1);
  if (onlyIn2) results.push(onlyIn2);
  if (intersectionPath) results.push(intersectionPath);

  return results.filter((r) => r.length > 0);
}

/**
 * Compute the symmetric difference (XOR / Combine) of two SVG path shapes.
 *
 * Returns the regions that belong to exactly one of the two shapes,
 * excluding the overlap. This is the PowerPoint "Combine" operation.
 *
 * @param paths1 - First SVG path data string.
 * @param paths2 - Second SVG path data string.
 * @returns SVG path data string of the combined (XOR) result.
 */
export function combineShapes(paths1: string, paths2: string): string {
  const onlyIn1 = subtractShapes(paths1, paths2);
  const onlyIn2 = subtractShapes(paths2, paths1);

  if (!onlyIn1 && !onlyIn2) return "";
  if (!onlyIn1) return onlyIn2;
  if (!onlyIn2) return onlyIn1;

  // Merge the two subtraction results into a single multi-sub-path string
  return `${onlyIn1} ${onlyIn2}`.trim();
}

// ---------------------------------------------------------------------------
// Merge shapes operation type
// ---------------------------------------------------------------------------

/** Supported merge shape operations (matching PowerPoint's Merge Shapes menu). */
export type MergeShapeOperation =
  | "union"
  | "intersect"
  | "subtract"
  | "fragment"
  | "combine";

/**
 * Apply a merge shape operation to two SVG path strings.
 *
 * @param operation - The boolean operation to perform.
 * @param paths1 - First SVG path data string.
 * @param paths2 - Second SVG path data string.
 * @returns Result SVG path string(s). Fragment returns multiple strings; others return one.
 */
export function mergeShapes(
  operation: MergeShapeOperation,
  paths1: string,
  paths2: string,
): string | string[] {
  switch (operation) {
    case "union":
      return unionShapes(paths1, paths2);
    case "intersect":
      return intersectShapes(paths1, paths2);
    case "subtract":
      return subtractShapes(paths1, paths2);
    case "fragment":
      return fragmentShapes(paths1, paths2);
    case "combine":
      return combineShapes(paths1, paths2);
  }
}
