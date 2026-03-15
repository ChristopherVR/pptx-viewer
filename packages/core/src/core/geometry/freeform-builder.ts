/**
 * Freeform drawing path builder for pen/mouse input.
 *
 * Provides a fluent API for accumulating raw points from user input,
 * then simplifying (Douglas-Peucker) and smoothing (Catmull-Rom spline
 * fitting to cubic Bezier curves) the result before converting to
 * SVG path data or structured {@link CustomGeometryPath} arrays.
 *
 * @module geometry/freeform-builder
 */

import type { CustomGeometryPath, CustomGeometryPoint } from "../types";

// ---------------------------------------------------------------------------
// Douglas-Peucker path simplification
// ---------------------------------------------------------------------------

/**
 * Compute the perpendicular distance from point `p` to the line
 * segment defined by `start` and `end`.
 */
function perpendicularDistance(
  p: CustomGeometryPoint,
  start: CustomGeometryPoint,
  end: CustomGeometryPoint,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    // start and end are the same point
    const ex = p.x - start.x;
    const ey = p.y - start.y;
    return Math.sqrt(ex * ex + ey * ey);
  }
  const t = ((p.x - start.x) * dx + (p.y - start.y) * dy) / lengthSq;
  const clamped = Math.max(0, Math.min(1, t));
  const projX = start.x + clamped * dx;
  const projY = start.y + clamped * dy;
  const distX = p.x - projX;
  const distY = p.y - projY;
  return Math.sqrt(distX * distX + distY * distY);
}

/**
 * Douglas-Peucker polyline simplification.
 *
 * Recursively removes points that lie within `tolerance` of the line
 * segment connecting their neighbours, preserving overall shape while
 * dramatically reducing point count for freeform drawing input.
 *
 * @param points - Input polyline points (at least 2).
 * @param tolerance - Maximum perpendicular distance for a point to be
 *   removed. Larger values produce fewer points. Default: `2`.
 * @returns A new array containing only the retained points.
 */
export function douglasPeucker(
  points: CustomGeometryPoint[],
  tolerance: number,
): CustomGeometryPoint[] {
  if (points.length <= 2) return [...points];

  // Find the point farthest from the line between first and last
  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    // Recursively simplify each half
    const left = douglasPeucker(points.slice(0, maxIdx + 1), tolerance);
    const right = douglasPeucker(points.slice(maxIdx), tolerance);
    // Concatenate, removing duplicate junction point
    return [...left.slice(0, -1), ...right];
  }

  // All intermediate points are within tolerance — keep only endpoints
  return [first, last];
}

// ---------------------------------------------------------------------------
// Catmull-Rom to cubic Bezier conversion
// ---------------------------------------------------------------------------

/**
 * Convert a sequence of points to smooth cubic Bezier curves using
 * Catmull-Rom spline interpolation.
 *
 * For each interior span between consecutive points, this computes
 * two cubic Bezier control points that approximate the Catmull-Rom
 * spline through the surrounding four points. The `factor` parameter
 * (default 6) controls the tangent magnitude — higher values produce
 * gentler curves; lower values produce tighter curves.
 *
 * @param points - Input polyline (minimum 2 points).
 * @param factor - Catmull-Rom tension divisor. Default: `6`.
 * @returns Array of cubic Bezier curve segments. Each entry is a tuple
 *   of `[cp1, cp2, endPt]` where `cp1`/`cp2` are the control points.
 */
export function catmullRomToBezier(
  points: CustomGeometryPoint[],
  factor = 6,
): Array<[CustomGeometryPoint, CustomGeometryPoint, CustomGeometryPoint]> {
  if (points.length < 2) return [];

  const curves: Array<
    [CustomGeometryPoint, CustomGeometryPoint, CustomGeometryPoint]
  > = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1: CustomGeometryPoint = {
      x: p1.x + (p2.x - p0.x) / factor,
      y: p1.y + (p2.y - p0.y) / factor,
    };
    const cp2: CustomGeometryPoint = {
      x: p2.x - (p3.x - p1.x) / factor,
      y: p2.y - (p3.y - p1.y) / factor,
    };

    curves.push([cp1, cp2, { x: p2.x, y: p2.y }]);
  }

  return curves;
}

// ---------------------------------------------------------------------------
// FreeformPathBuilder
// ---------------------------------------------------------------------------

/**
 * Fluent builder for constructing freeform drawing paths from
 * pen/mouse input.
 *
 * Typical usage:
 * ```ts
 * const builder = new FreeformPathBuilder()
 *   .addPoint(0, 0)
 *   .addPoint(10, 5)
 *   .addPoint(20, 3)
 *   // ... many points from mouse events
 *   .simplify(2)
 *   .smooth(6);
 *
 * const svgPath = builder.toSvgPath();
 * const geomPaths = builder.toCustomGeometryPaths();
 * ```
 */
export class FreeformPathBuilder {
  private points: CustomGeometryPoint[] = [];
  private closed = false;
  private smoothed = false;
  private bezierCurves: Array<
    [CustomGeometryPoint, CustomGeometryPoint, CustomGeometryPoint]
  > = [];

  /**
   * Append a point to the path.
   *
   * @param x - X coordinate.
   * @param y - Y coordinate.
   * @returns `this` for chaining.
   */
  addPoint(x: number, y: number): this {
    this.points.push({ x, y });
    // Invalidate any previous smoothing when new points are added
    this.smoothed = false;
    this.bezierCurves = [];
    return this;
  }

  /**
   * Mark the path as closed (a Z command will be appended).
   *
   * @returns `this` for chaining.
   */
  close(): this {
    this.closed = true;
    return this;
  }

  /**
   * Return a shallow copy of the current points.
   */
  getPoints(): CustomGeometryPoint[] {
    return [...this.points];
  }

  /**
   * Return whether the path has been closed.
   */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * Return whether the path has been smoothed.
   */
  isSmoothed(): boolean {
    return this.smoothed;
  }

  /**
   * Simplify the path using Douglas-Peucker algorithm.
   *
   * Reduces the number of points while preserving the overall shape.
   * This is critical for freeform mouse/pen input which generates
   * many closely-spaced points.
   *
   * @param tolerance - Maximum perpendicular distance for a point to
   *   be removed. Larger values discard more points. Default: `2`.
   * @returns `this` for chaining.
   */
  simplify(tolerance = 2): this {
    if (this.points.length > 2) {
      this.points = douglasPeucker(this.points, tolerance);
      // Invalidate smoothing after simplification
      this.smoothed = false;
      this.bezierCurves = [];
    }
    return this;
  }

  /**
   * Convert the polyline points to smooth cubic Bezier curves using
   * Catmull-Rom spline fitting.
   *
   * After smoothing, {@link toSvgPath} and {@link toCustomGeometryPaths}
   * will emit cubic Bezier curve commands instead of straight line
   * segments.
   *
   * @param factor - Catmull-Rom tension divisor. Higher values produce
   *   gentler curves. Default: `6`.
   * @returns `this` for chaining.
   */
  smooth(factor = 6): this {
    if (this.points.length >= 2) {
      this.bezierCurves = catmullRomToBezier(this.points, factor);
      this.smoothed = true;
    }
    return this;
  }

  /**
   * Convert the current path to an SVG path data string.
   *
   * If the path has been smoothed, emits `M` followed by `C` (cubic
   * Bezier) commands. Otherwise emits `M` followed by `L` (line)
   * commands. Appends `Z` if the path was closed.
   *
   * @returns SVG path data string (e.g. `"M 0 0 L 10 5 L 20 3"`).
   */
  toSvgPath(): string {
    if (this.points.length === 0) return "";

    const parts: string[] = [];
    const first = this.points[0];
    parts.push(`M ${first.x} ${first.y}`);

    if (this.smoothed && this.bezierCurves.length > 0) {
      for (const [cp1, cp2, end] of this.bezierCurves) {
        parts.push(`C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y}`);
      }
    } else {
      for (let i = 1; i < this.points.length; i++) {
        parts.push(`L ${this.points[i].x} ${this.points[i].y}`);
      }
    }

    if (this.closed) {
      parts.push("Z");
    }

    return parts.join(" ");
  }

  /**
   * Convert the current path to structured {@link CustomGeometryPath}
   * arrays suitable for OOXML serialization.
   *
   * Automatically computes the bounding dimensions from the point data.
   *
   * @returns Array containing a single {@link CustomGeometryPath}.
   */
  toCustomGeometryPaths(): CustomGeometryPath[] {
    if (this.points.length === 0) {
      return [{ width: 1, height: 1, segments: [] }];
    }

    // Compute bounds
    let maxX = 0;
    let maxY = 0;
    for (const pt of this.points) {
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
    // Also consider bezier control points if smoothed
    if (this.smoothed) {
      for (const [cp1, cp2, end] of this.bezierCurves) {
        for (const pt of [cp1, cp2, end]) {
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y > maxY) maxY = pt.y;
        }
      }
    }
    const width = Math.max(maxX, 1);
    const height = Math.max(maxY, 1);

    const segments: CustomGeometryPath["segments"] = [];
    const first = this.points[0];
    segments.push({ type: "moveTo", pt: { x: first.x, y: first.y } });

    if (this.smoothed && this.bezierCurves.length > 0) {
      for (const [cp1, cp2, end] of this.bezierCurves) {
        segments.push({
          type: "cubicBezTo",
          pts: [
            { x: cp1.x, y: cp1.y },
            { x: cp2.x, y: cp2.y },
            { x: end.x, y: end.y },
          ],
        });
      }
    } else {
      for (let i = 1; i < this.points.length; i++) {
        segments.push({
          type: "lineTo",
          pt: { x: this.points[i].x, y: this.points[i].y },
        });
      }
    }

    if (this.closed) {
      segments.push({ type: "close" });
    }

    return [{ width, height, segments }];
  }
}
