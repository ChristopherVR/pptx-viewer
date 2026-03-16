/**
 * Core types and point-level helper functions for polygon boolean operations.
 *
 * Provides the {@link Vec2} interface and low-level geometric primitives
 * (equality, cross product, signed area, winding order, point-in-polygon,
 * de-duplication, etc.) shared by all shape-boolean sub-modules.
 *
 * @module geometry/shape-boolean-types
 */

// ---------------------------------------------------------------------------
// Point type & constants
// ---------------------------------------------------------------------------

/** A 2D point for polygon operations. */
export interface Vec2 {
	x: number;
	y: number;
}

/** Tolerance used for floating-point comparisons. */
export const EPSILON = 1e-9;

// ---------------------------------------------------------------------------
// Point helpers
// ---------------------------------------------------------------------------

/**
 * Test approximate equality of two 2D points within {@link EPSILON}.
 *
 * @param a - First point.
 * @param b - Second point.
 * @returns `true` when the points are within EPSILON distance on both axes.
 */
export function vec2Eq(a: Vec2, b: Vec2): boolean {
	return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;
}

/**
 * Compute the 2D cross product of vectors OA and OB.
 *
 * Positive when the turn O→A→B is counter-clockwise.
 *
 * @param o - Origin point.
 * @param a - First arm endpoint.
 * @param b - Second arm endpoint.
 * @returns Signed scalar cross product.
 */
export function cross2(o: Vec2, a: Vec2, b: Vec2): number {
	return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * Signed area of a polygon (positive = counter-clockwise).
 *
 * @param poly - Array of polygon vertices.
 * @returns Signed area (positive for CCW winding).
 */
export function signedArea(poly: Vec2[]): number {
	let area = 0;
	for (let i = 0, n = poly.length; i < n; i++) {
		const j = (i + 1) % n;
		area += poly[i].x * poly[j].y;
		area -= poly[j].x * poly[i].y;
	}
	return area / 2;
}

/**
 * Ensure polygon vertices are in counter-clockwise order.
 *
 * @param poly - Input polygon.
 * @returns A polygon guaranteed to be CCW (may return a reversed copy).
 */
export function ensureCCW(poly: Vec2[]): Vec2[] {
	return signedArea(poly) < 0 ? [...poly].reverse() : poly;
}

/**
 * Ensure polygon vertices are in clockwise order.
 *
 * @param poly - Input polygon.
 * @returns A polygon guaranteed to be CW (may return a reversed copy).
 */
export function ensureCW(poly: Vec2[]): Vec2[] {
	return signedArea(poly) > 0 ? [...poly].reverse() : poly;
}

/**
 * Unsigned area of a polygon.
 *
 * @param poly - Array of polygon vertices.
 * @returns Absolute (unsigned) area.
 */
export function polygonArea(poly: Vec2[]): number {
	return Math.abs(signedArea(poly));
}

/**
 * Remove consecutive duplicate vertices from a polygon.
 *
 * Also removes the closing duplicate when the first and last vertices coincide.
 *
 * @param poly - Input polygon.
 * @returns De-duplicated polygon.
 */
export function dedupPoly(poly: Vec2[]): Vec2[] {
	if (poly.length === 0) {
		return poly;
	}
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
 * Format a number, removing unnecessary trailing zeros.
 *
 * Rounds to 4 decimal places to avoid floating-point noise.
 *
 * @param n - Number to format.
 * @returns String representation.
 */
export function fmtNum(n: number): string {
	const rounded = Math.round(n * 10000) / 10000;
	return String(rounded);
}

/**
 * Test if point `p` is inside triangle `abc` (inclusive of edges).
 *
 * @param p - Point to test.
 * @param a - First triangle vertex.
 * @param b - Second triangle vertex.
 * @param c - Third triangle vertex.
 * @returns `true` when p lies on or inside the triangle.
 */
export function pointInTriangle(p: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean {
	const d1 = cross2(a, b, p);
	const d2 = cross2(b, c, p);
	const d3 = cross2(c, a, p);
	const hasNeg = d1 < -EPSILON || d2 < -EPSILON || d3 < -EPSILON;
	const hasPos = d1 > EPSILON || d2 > EPSILON || d3 > EPSILON;
	return !(hasNeg && hasPos);
}

/**
 * Test if a point is inside a polygon using the ray-casting algorithm.
 *
 * @param pt - Point to test.
 * @param poly - Polygon vertices.
 * @returns `true` when the point is inside the polygon.
 */
export function pointInPolygon(pt: Vec2, poly: Vec2[]): boolean {
	let inside = false;
	const n = poly.length;
	for (let i = 0, j = n - 1; i < n; j = i++) {
		const xi = poly[i].x,
			yi = poly[i].y;
		const xj = poly[j].x,
			yj = poly[j].y;
		if (yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) {
			inside = !inside;
		}
	}
	return inside;
}
