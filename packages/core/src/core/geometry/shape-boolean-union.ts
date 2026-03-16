/**
 * Union algorithm for polygon boolean operations.
 *
 * Implements a Weiler-Atherton-inspired boundary walk to merge two
 * (possibly concave) polygons into their union outline. Falls back to
 * convex-hull when the walk produces no result.
 *
 * @module geometry/shape-boolean-union
 */

import type { Vec2 } from './shape-boolean-types';
import { EPSILON, vec2Eq, pointInPolygon } from './shape-boolean-types';

// ---------------------------------------------------------------------------
// Segment-segment intersection
// ---------------------------------------------------------------------------

/**
 * Compute the intersection of two line segments (A1→A2 and B1→B2).
 *
 * Returns the intersection point together with the parametric `t` values
 * along each segment, or `null` when the segments do not cross.
 *
 * @param a1 - Start of segment A.
 * @param a2 - End of segment A.
 * @param b1 - Start of segment B.
 * @param b2 - End of segment B.
 * @returns Intersection descriptor or `null`.
 */
export function segmentIntersection(
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
	if (Math.abs(denom) < EPSILON) {
		return null;
	}

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

// ---------------------------------------------------------------------------
// All-pairs intersection finder
// ---------------------------------------------------------------------------

/**
 * Find all intersection points between the edges of two polygons.
 *
 * @param polyA - First polygon.
 * @param polyB - Second polygon.
 * @returns Array of intersection descriptors including the point, edge
 *   indices, and parametric t values.
 */
export function findAllIntersections(
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

// ---------------------------------------------------------------------------
// Intersection vertex insertion
// ---------------------------------------------------------------------------

/**
 * Build a copy of a polygon with intersection vertices inserted at the
 * correct positions along each edge.
 *
 * @param poly - Original polygon.
 * @param intersections - Intersection descriptors (edge index + parametric t).
 * @returns Augmented polygon.
 */
export function insertIntersections(
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

// ---------------------------------------------------------------------------
// Convex hull (Andrew's monotone chain)
// ---------------------------------------------------------------------------

/**
 * Compute the convex hull of a set of points using Andrew's monotone chain
 * algorithm.
 *
 * @param points - Input points.
 * @returns Vertices of the convex hull in CCW order.
 */
export function convexHull(points: Vec2[]): Vec2[] {
	const pts = [...points].sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));
	if (pts.length <= 1) {
		return pts;
	}

	const cross = (o: Vec2, a: Vec2, b: Vec2): number =>
		(a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

	const lower: Vec2[] = [];
	for (const p of pts) {
		while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
			lower.pop();
		}
		lower.push(p);
	}

	const upper: Vec2[] = [];
	for (let i = pts.length - 1; i >= 0; i--) {
		const p = pts[i];
		while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
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
// Union walk (Weiler-Atherton inspired)
// ---------------------------------------------------------------------------

/**
 * Walk along polygon boundaries to construct the union outline.
 *
 * Uses a simplified Weiler-Atherton-style approach: augmented polygons
 * (with intersection vertices inserted) are walked, switching between
 * polygon A and polygon B at each intersection to trace the exterior
 * boundary.
 *
 * Falls back to convex hull when the walk produces no valid result.
 *
 * @param polyA - First polygon (CCW).
 * @param polyB - Second polygon (CCW).
 * @returns Array of union result polygons.
 */
export function computeUnionWalk(polyA: Vec2[], polyB: Vec2[]): Vec2[][] {
	const intersections = findAllIntersections(polyA, polyB);

	// If no intersections, check containment
	if (intersections.length === 0) {
		const aInB = pointInPolygon(polyA[0], polyB);
		const bInA = pointInPolygon(polyB[0], polyA);

		if (aInB) {
			return [polyB];
		} // A inside B
		if (bInA) {
			return [polyA];
		} // B inside A
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
			if (vec2Eq(aug[i], pt)) {
				return i;
			}
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
		if (visited.has(key)) {
			continue;
		}

		const outline: Vec2[] = [];
		let onA = true;
		let currentIdx = findInAug(augA, startPt);
		if (currentIdx === -1) {
			continue;
		}

		let maxSteps = augA.length + augB.length + interPts.length * 2;
		let started = false;

		while (maxSteps > 0) {
			maxSteps--;
			const aug = onA ? augA : augB;
			const pt = aug[currentIdx];

			if (started && vec2Eq(pt, startPt)) {
				break;
			}
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
		if (hull.length >= 3) {
			return [hull];
		}
	}

	return results;
}
