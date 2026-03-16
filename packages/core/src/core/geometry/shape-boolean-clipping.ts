/**
 * Polygon clipping algorithms for shape boolean intersection.
 *
 * Implements the Sutherland-Hodgman algorithm for convex polygon clipping
 * and ear-clipping triangulation for handling concave clip polygons.
 *
 * @module geometry/shape-boolean-clipping
 */

import type { Vec2 } from './shape-boolean-types';
import { EPSILON, cross2, ensureCCW, polygonArea, pointInTriangle } from './shape-boolean-types';

// ---------------------------------------------------------------------------
// Line intersection
// ---------------------------------------------------------------------------

/**
 * Compute the intersection point of two infinite lines defined by segments
 * AB and CD. Returns `null` when the lines are parallel.
 *
 * @param a - First point of line 1.
 * @param b - Second point of line 1.
 * @param c - First point of line 2.
 * @param d - Second point of line 2.
 * @returns Intersection point or `null` if parallel.
 */
export function lineIntersection(a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2 | null {
	const denom = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
	if (Math.abs(denom) < EPSILON) {
		return null;
	}
	const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denom;
	return {
		x: a.x + t * (b.x - a.x),
		y: a.y + t * (b.y - a.y),
	};
}

// ---------------------------------------------------------------------------
// Sutherland-Hodgman polygon clipping
// ---------------------------------------------------------------------------

/**
 * Sutherland-Hodgman algorithm: clip a subject polygon by a convex clip
 * polygon.
 *
 * Both polygons should be in CCW winding order.
 *
 * @param subject - Polygon to be clipped.
 * @param clip - Convex clipping polygon.
 * @returns Clipped polygon (may be empty if no overlap).
 */
export function sutherlandHodgman(subject: Vec2[], clip: Vec2[]): Vec2[] {
	let output = [...subject];

	for (let i = 0; i < clip.length; i++) {
		if (output.length === 0) {
			return [];
		}
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
					if (inter) {
						output.push(inter);
					}
				}
				output.push(curr);
			} else if (prevInside) {
				const inter = lineIntersection(prev, curr, edgeStart, edgeEnd);
				if (inter) {
					output.push(inter);
				}
			}
		}
	}

	return output;
}

// ---------------------------------------------------------------------------
// Convex test
// ---------------------------------------------------------------------------

/**
 * Check whether a polygon is convex.
 *
 * @param poly - Polygon vertices.
 * @returns `true` when all cross-products at vertices share the same sign.
 */
export function isConvex(poly: Vec2[]): boolean {
	const n = poly.length;
	if (n < 3) {
		return false;
	}
	let sign = 0;
	for (let i = 0; i < n; i++) {
		const o = poly[i];
		const a = poly[(i + 1) % n];
		const b = poly[(i + 2) % n];
		const c = cross2(o, a, b);
		if (Math.abs(c) < EPSILON) {
			continue;
		}
		if (sign === 0) {
			sign = c > 0 ? 1 : -1;
		} else if ((c > 0 ? 1 : -1) !== sign) {
			return false;
		}
	}
	return true;
}

// ---------------------------------------------------------------------------
// Ear-clipping triangulation
// ---------------------------------------------------------------------------

/**
 * Simple ear-clipping triangulation for concave polygon decomposition.
 *
 * Returns an array of triangles (3-vertex polygons).
 *
 * @param poly - Input polygon (will be normalized to CCW).
 * @returns Array of triangles.
 */
export function triangulate(poly: Vec2[]): Vec2[][] {
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
			if (cross2(prev, curr, next) <= EPSILON) {
				continue;
			}

			// Check no other vertex is inside this ear triangle
			let isEar = true;
			for (let j = 0; j < n; j++) {
				if (j === (i + n - 1) % n || j === i || j === (i + 1) % n) {
					continue;
				}
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

		if (!earFound) {
			break;
		}
	}

	if (remaining.length === 3) {
		triangles.push([remaining[0], remaining[1], remaining[2]]);
	}

	return triangles;
}

// ---------------------------------------------------------------------------
// General polygon clipping (convex + concave)
// ---------------------------------------------------------------------------

/**
 * Merge a set of (possibly overlapping) convex polygons into fewer polygons.
 *
 * Currently removes degenerate polygons and returns the rest as-is, since
 * the triangulated intersection pieces may share edges.
 *
 * @param polys - Array of polygons to merge.
 * @returns Filtered array with degenerate polygons removed.
 */
export function mergeOverlappingPolygons(polys: Vec2[][]): Vec2[][] {
	return polys.filter((p) => p.length >= 3 && polygonArea(p) > EPSILON);
}

/**
 * Clip a subject polygon against a clip polygon.
 *
 * Handles both convex and concave clip polygons. For concave clips the
 * polygon is decomposed into triangles via ear-clipping and the subject
 * is clipped against each triangle individually.
 *
 * @param subject - Polygon to clip.
 * @param clip - Clipping polygon (convex or concave).
 * @returns Array of resulting polygons (may be empty).
 */
export function clipPolygons(subject: Vec2[], clip: Vec2[]): Vec2[][] {
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

	return mergeOverlappingPolygons(results);
}
