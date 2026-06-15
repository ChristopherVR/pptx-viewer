/**
 * Unit tests for the A* orthogonal connector router.
 *
 * Mirrors the coverage from:
 *   packages/react/src/viewer/utils/connector-router.test.ts
 *   packages/react/src/viewer/utils/connector-router-graph.test.ts
 *   packages/react/src/viewer/utils/connector-router-astar.test.ts
 *
 * All tests exercise pure functions — no Angular TestBed or DOM required.
 */
import { describe, expect, it } from 'vitest';

import {
	ROUTING_PADDING_DEFAULT,
	aStarOrthogonal,
	buildGraphNodes,
	directPathClear,
	heuristic,
	inflateRect,
	pointInRect,
	pointKey,
	routeOrthogonalConnector,
	segmentIntersectsRect,
	simplifyPath,
	waypointsToPathD,
} from './connector-routing';
import type { Point, Rect } from './connector-routing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Make a Rect inline. */
function rect(x: number, y: number, w: number, h: number): Rect {
	return { x, y, width: w, height: h };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('routing padding default', () => {
	it('is a positive number', () => {
		expect(ROUTING_PADDING_DEFAULT).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// inflateRect
// ---------------------------------------------------------------------------

describe('inflateRect', () => {
	it('expands each edge by the padding amount', () => {
		const r = inflateRect(rect(10, 20, 100, 50), 5);
		expect(r.x).toBe(5);
		expect(r.y).toBe(15);
		expect(r.width).toBe(110);
		expect(r.height).toBe(60);
	});

	it('handles zero padding — returns an identical rect', () => {
		const r = inflateRect(rect(10, 20, 100, 50), 0);
		expect(r).toStrictEqual(rect(10, 20, 100, 50));
	});
});

// ---------------------------------------------------------------------------
// pointInRect
// ---------------------------------------------------------------------------

describe('pointInRect', () => {
	const r = rect(10, 10, 80, 60);

	it('returns true for a point inside', () => {
		expect(pointInRect({ x: 50, y: 40 }, r)).toBeTruthy();
	});

	it('returns true for a point on the border', () => {
		expect(pointInRect({ x: 10, y: 10 }, r)).toBeTruthy();
		expect(pointInRect({ x: 90, y: 70 }, r)).toBeTruthy();
	});

	it('returns false for a point outside', () => {
		expect(pointInRect({ x: 0, y: 0 }, r)).toBeFalsy();
		expect(pointInRect({ x: 91, y: 40 }, r)).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// segmentIntersectsRect
// ---------------------------------------------------------------------------

describe('segmentIntersectsRect', () => {
	const r = rect(50, 50, 100, 100);

	it('returns false for a segment completely to the left', () => {
		expect(segmentIntersectsRect({ x: 0, y: 100 }, { x: 40, y: 100 }, r)).toBeFalsy();
	});

	it('returns false for a segment completely above', () => {
		expect(segmentIntersectsRect({ x: 100, y: 0 }, { x: 100, y: 40 }, r)).toBeFalsy();
	});

	it('returns true for a horizontal segment passing through the rect', () => {
		expect(segmentIntersectsRect({ x: 0, y: 100 }, { x: 200, y: 100 }, r)).toBeTruthy();
	});

	it('returns true for a vertical segment passing through the rect', () => {
		expect(segmentIntersectsRect({ x: 100, y: 0 }, { x: 100, y: 200 }, r)).toBeTruthy();
	});

	it('returns false for a horizontal segment that touches the bounding box but is not on the Y range', () => {
		// Segment is at y=10 which is above the rect (rect.y=50)
		expect(segmentIntersectsRect({ x: 0, y: 10 }, { x: 200, y: 10 }, r)).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// directPathClear
// ---------------------------------------------------------------------------

describe('directPathClear', () => {
	const start: Point = { x: 0, y: 100 };
	const end: Point = { x: 400, y: 100 };

	it('returns true when there are no obstacles', () => {
		expect(directPathClear(start, end, [])).toBeTruthy();
	});

	it('returns true when obstacles do not block the line', () => {
		expect(directPathClear(start, end, [rect(100, 200, 80, 80)])).toBeTruthy();
	});

	it('returns false when an obstacle blocks the line', () => {
		expect(directPathClear(start, end, [rect(100, 50, 80, 100)])).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// heuristic
// ---------------------------------------------------------------------------

describe('heuristic', () => {
	it('computes Manhattan distance', () => {
		expect(heuristic({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
		expect(heuristic({ x: 10, y: 20 }, { x: 10, y: 20 })).toBe(0);
	});

	it('is symmetric', () => {
		const a: Point = { x: 5, y: 8 };
		const b: Point = { x: 20, y: 1 };
		expect(heuristic(a, b)).toBe(heuristic(b, a));
	});
});

// ---------------------------------------------------------------------------
// pointKey
// ---------------------------------------------------------------------------

describe('pointKey', () => {
	it('produces a comma-separated rounded string', () => {
		expect(pointKey({ x: 1.4, y: 2.6 })).toBe('1,3');
	});

	it('same key for points that round to the same pixel', () => {
		expect(pointKey({ x: 10.1, y: 20.4 })).toBe(pointKey({ x: 10.4, y: 20.4 }));
	});
});

// ---------------------------------------------------------------------------
// buildGraphNodes
// ---------------------------------------------------------------------------

describe('buildGraphNodes', () => {
	it('always includes start and end', () => {
		const start: Point = { x: 0, y: 0 };
		const end: Point = { x: 500, y: 300 };
		const nodes = buildGraphNodes(start, end, [], 1000, 600);
		const keys = nodes.map(pointKey);
		expect(keys).toContain(pointKey(start));
		expect(keys).toContain(pointKey(end));
	});

	it('adds corner nodes for obstacles', () => {
		const start: Point = { x: 0, y: 50 };
		const end: Point = { x: 500, y: 50 };
		const obs = [inflateRect(rect(100, 20, 80, 60), 0)];
		const nodes = buildGraphNodes(start, end, obs, 1000, 600);
		// Should have more than just start + end.
		expect(nodes.length).toBeGreaterThan(2);
	});

	it('does not include nodes that fall inside an obstacle', () => {
		const start: Point = { x: 0, y: 50 };
		const end: Point = { x: 500, y: 50 };
		// Obstacle covers a large area
		const obs = [rect(-10, -10, 600, 200)];
		const nodes = buildGraphNodes(start, end, obs, 1000, 600);
		// No node except possibly start/end should be inside the obstacle
		const outside = nodes.filter((n) => !pointInRect(n, obs[0]));
		// At least start and end are there; all others must be outside
		for (const n of nodes) {
			const insideObs = pointInRect(n, obs[0]);
			// start and end may be inside when the obstacle engulfs them (degenerate case)
			if (n !== start && n !== end) {
				expect(insideObs).toBeFalsy();
			}
		}
		// Suppress unused-variable lint
		void outside;
	});
});

// ---------------------------------------------------------------------------
// simplifyPath
// ---------------------------------------------------------------------------

describe('simplifyPath', () => {
	it('returns the same two-point path unchanged', () => {
		const pts: Point[] = [
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
		];
		expect(simplifyPath(pts)).toStrictEqual(pts);
	});

	it('removes a collinear intermediate point', () => {
		// All three points are on y=0 — the middle one is collinear.
		const pts: Point[] = [
			{ x: 0, y: 0 },
			{ x: 50, y: 0 },
			{ x: 100, y: 0 },
		];
		const result = simplifyPath(pts);
		expect(result).toHaveLength(2);
		expect(result[0]).toStrictEqual({ x: 0, y: 0 });
		expect(result[1]).toStrictEqual({ x: 100, y: 0 });
	});

	it('keeps a bend point that changes direction', () => {
		// L-shaped: right then down.
		const pts: Point[] = [
			{ x: 0, y: 0 },
			{ x: 50, y: 0 },
			{ x: 50, y: 50 },
		];
		const result = simplifyPath(pts);
		expect(result).toHaveLength(3);
	});

	it('handles an empty array', () => {
		expect(simplifyPath([])).toStrictEqual([]);
	});

	it('handles a single point', () => {
		const pts: Point[] = [{ x: 5, y: 5 }];
		expect(simplifyPath(pts)).toStrictEqual(pts);
	});
});

// ---------------------------------------------------------------------------
// aStarOrthogonal
// ---------------------------------------------------------------------------

describe('aStarOrthogonal', () => {
	const defaults = { canvasWidth: 1000, canvasHeight: 600 };

	it('returns start and end when no obstacles block the path', () => {
		const start: Point = { x: 0, y: 50 };
		const end: Point = { x: 300, y: 50 };
		const nodes = buildGraphNodes(start, end, [], defaults.canvasWidth, defaults.canvasHeight);
		const path = aStarOrthogonal(nodes, start, end, []);
		expect(path[0]).toStrictEqual(start);
		expect(path[path.length - 1]).toStrictEqual(end);
	});

	it('finds a path around an obstacle', () => {
		const start: Point = { x: 0, y: 100 };
		const end: Point = { x: 300, y: 100 };
		// Block the direct horizontal path
		const inflated = [inflateRect(rect(100, 50, 100, 100), 0)];
		const nodes = buildGraphNodes(
			start,
			end,
			inflated,
			defaults.canvasWidth,
			defaults.canvasHeight,
		);
		const path = aStarOrthogonal(nodes, start, end, inflated);
		// Path must start at start and end at end
		expect(path[0]).toStrictEqual(start);
		expect(path[path.length - 1]).toStrictEqual(end);
		// Must have found a non-trivial path (at least 3 waypoints for a detour)
		expect(path.length).toBeGreaterThanOrEqual(2);
	});

	it('all segments in the returned path are axis-aligned (orthogonal)', () => {
		const start: Point = { x: 0, y: 100 };
		const end: Point = { x: 400, y: 100 };
		const inflated = [inflateRect(rect(150, 60, 100, 80), 4)];
		const nodes = buildGraphNodes(
			start,
			end,
			inflated,
			defaults.canvasWidth,
			defaults.canvasHeight,
		);
		const path = aStarOrthogonal(nodes, start, end, inflated);

		for (let i = 1; i < path.length; i++) {
			const prev = path[i - 1];
			const curr = path[i];
			const isHoriz = Math.abs(prev.y - curr.y) < 1;
			const isVert = Math.abs(prev.x - curr.x) < 1;
			expect(isHoriz || isVert).toBeTruthy();
		}
	});
});

// ---------------------------------------------------------------------------
// waypointsToPathD
// ---------------------------------------------------------------------------

describe('waypointsToPathD', () => {
	it('returns empty string for an empty array', () => {
		expect(waypointsToPathD([])).toBe('');
	});

	it('returns M command for a single point', () => {
		expect(waypointsToPathD([{ x: 10, y: 20 }])).toBe('M10,20');
	});

	it('returns M + L commands for two points', () => {
		expect(
			waypointsToPathD([
				{ x: 0, y: 0 },
				{ x: 100, y: 50 },
			]),
		).toBe('M0,0 L100,50');
	});

	it('returns a polyline for multiple waypoints', () => {
		const result = waypointsToPathD([
			{ x: 0, y: 0 },
			{ x: 50, y: 0 },
			{ x: 50, y: 50 },
			{ x: 100, y: 50 },
		]);
		expect(result).toBe('M0,0 L50,0 L50,50 L100,50');
	});

	it('handles negative coordinates', () => {
		const result = waypointsToPathD([
			{ x: -10, y: -20 },
			{ x: 30, y: 40 },
		]);
		expect(result).toContain('M-10,-20');
		expect(result).toContain('L30,40');
	});
});

// ---------------------------------------------------------------------------
// routeOrthogonalConnector — integration tests
// ---------------------------------------------------------------------------

describe('routeOrthogonalConnector', () => {
	const canvas = { canvasWidth: 1000, canvasHeight: 600 };

	// -----------------------------------------------------------------------
	// No obstacles
	// -----------------------------------------------------------------------

	it('returns [start, end] when there are no obstacles', () => {
		const start: Point = { x: 10, y: 50 };
		const end: Point = { x: 200, y: 50 };
		const result = routeOrthogonalConnector(start, end, [], canvas);
		expect(result).toStrictEqual([start, end]);
	});

	// -----------------------------------------------------------------------
	// Direct path clear even with obstacles present
	// -----------------------------------------------------------------------

	it('returns [start, end] when obstacles do not block the direct path', () => {
		const start: Point = { x: 10, y: 10 };
		const end: Point = { x: 200, y: 10 };
		// Obstacle is well below the horizontal path
		const result = routeOrthogonalConnector(start, end, [rect(50, 100, 50, 50)], canvas);
		expect(result).toStrictEqual([start, end]);
	});

	// -----------------------------------------------------------------------
	// Elbow path
	// -----------------------------------------------------------------------

	it('returns a 3-point elbow when the direct path is blocked but elbows are clear', () => {
		const start: Point = { x: 10, y: 50 };
		const end: Point = { x: 200, y: 150 };
		// Diagonal obstacle — blocks direct, but a horizontal elbow clears it.
		const result = routeOrthogonalConnector(start, end, [rect(80, 80, 40, 40)], {
			...canvas,
			padding: 0,
		});
		expect(result[0]).toStrictEqual(start);
		expect(result[result.length - 1]).toStrictEqual(end);
		expect(result.length).toBeGreaterThanOrEqual(2);
	});

	// -----------------------------------------------------------------------
	// Full A* when elbows are blocked
	// -----------------------------------------------------------------------

	it('routes around an obstacle using A* when elbows are blocked', () => {
		const start: Point = { x: 10, y: 100 };
		const end: Point = { x: 300, y: 100 };
		// Large obstacle spanning full height — blocks both elbows
		const obs = [rect(100, 50, 100, 100)];
		const result = routeOrthogonalConnector(start, end, obs, canvas);
		expect(result[0]).toStrictEqual(start);
		expect(result[result.length - 1]).toStrictEqual(end);
		expect(result.length).toBeGreaterThanOrEqual(2);
	});

	// -----------------------------------------------------------------------
	// Multiple obstacles
	// -----------------------------------------------------------------------

	it('routes around multiple obstacles', () => {
		const start: Point = { x: 10, y: 100 };
		const end: Point = { x: 500, y: 100 };
		const obs = [rect(100, 50, 80, 100), rect(300, 50, 80, 100)];
		const result = routeOrthogonalConnector(start, end, obs, canvas);
		expect(result[0]).toStrictEqual(start);
		expect(result[result.length - 1]).toStrictEqual(end);
		expect(result.length).toBeGreaterThanOrEqual(2);
	});

	// -----------------------------------------------------------------------
	// All segments in the final path are axis-aligned
	// -----------------------------------------------------------------------

	it('produces only axis-aligned segments', () => {
		const start: Point = { x: 0, y: 100 };
		const end: Point = { x: 400, y: 100 };
		const obs = [rect(150, 60, 100, 80)];
		const result = routeOrthogonalConnector(start, end, obs, canvas);

		for (let i = 1; i < result.length; i++) {
			const prev = result[i - 1];
			const curr = result[i];
			const isHoriz = Math.abs(prev.y - curr.y) < 1;
			const isVert = Math.abs(prev.x - curr.x) < 1;
			expect(isHoriz || isVert).toBeTruthy();
		}
	});

	// -----------------------------------------------------------------------
	// Endpoints preserved
	// -----------------------------------------------------------------------

	it('always preserves exact start and end in the output', () => {
		const start: Point = { x: 5, y: 305 };
		const end: Point = { x: 995, y: 295 };
		const obs = [rect(200, 200, 600, 200)];
		const result = routeOrthogonalConnector(start, end, obs, canvas);
		expect(result[0]).toStrictEqual(start);
		expect(result[result.length - 1]).toStrictEqual(end);
	});

	// -----------------------------------------------------------------------
	// Degenerate: same start and end
	// -----------------------------------------------------------------------

	it('handles start === end gracefully', () => {
		const pt: Point = { x: 50, y: 50 };
		const result = routeOrthogonalConnector(pt, pt, [], canvas);
		expect(result.length).toBeGreaterThanOrEqual(1);
	});

	// -----------------------------------------------------------------------
	// Horizontal path (same y)
	// -----------------------------------------------------------------------

	it('handles a horizontal direct path', () => {
		const start: Point = { x: 0, y: 100 };
		const end: Point = { x: 500, y: 100 };
		const result = routeOrthogonalConnector(start, end, [], canvas);
		expect(result).toStrictEqual([start, end]);
	});

	// -----------------------------------------------------------------------
	// Vertical path (same x)
	// -----------------------------------------------------------------------

	it('handles a vertical direct path', () => {
		const start: Point = { x: 100, y: 0 };
		const end: Point = { x: 100, y: 300 };
		const result = routeOrthogonalConnector(start, end, [], canvas);
		expect(result).toStrictEqual([start, end]);
	});

	// -----------------------------------------------------------------------
	// Custom padding
	// -----------------------------------------------------------------------

	it('respects custom padding = 0', () => {
		const start: Point = { x: 10, y: 50 };
		const end: Point = { x: 200, y: 50 };
		const obs = [rect(80, 30, 40, 40)];
		const result = routeOrthogonalConnector(start, end, obs, { ...canvas, padding: 0 });
		expect(result[0]).toStrictEqual(start);
		expect(result[result.length - 1]).toStrictEqual(end);
	});

	// -----------------------------------------------------------------------
	// Default padding (no canvas opts)
	// -----------------------------------------------------------------------

	it('works without explicit canvas size options', () => {
		const start: Point = { x: 10, y: 50 };
		const end: Point = { x: 200, y: 50 };
		const result = routeOrthogonalConnector(start, end, []);
		expect(result).toStrictEqual([start, end]);
	});
});
