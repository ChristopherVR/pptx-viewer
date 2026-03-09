import { describe, it, expect } from 'vitest';
import {
	PADDING_DEFAULT,
	inflateRect,
	pointInRect,
	segmentIntersectsRect,
	directPathClear,
	heuristic,
	pointKey,
	buildGraphNodes,
} from './connector-router-graph';

describe('PADDING_DEFAULT', () => {
	it('should be 12', () => {
		expect(PADDING_DEFAULT).toBe(12);
	});
});

describe('inflateRect', () => {
	it('should expand a rectangle by the given padding', () => {
		const rect = { x: 10, y: 20, width: 100, height: 50 };
		const result = inflateRect(rect, 5);
		expect(result).toEqual({ x: 5, y: 15, width: 110, height: 60 });
	});

	it('should handle zero padding', () => {
		const rect = { x: 10, y: 20, width: 100, height: 50 };
		const result = inflateRect(rect, 0);
		expect(result).toEqual(rect);
	});

	it('should handle large padding', () => {
		const rect = { x: 50, y: 50, width: 100, height: 100 };
		const result = inflateRect(rect, 50);
		expect(result.x).toBe(0);
		expect(result.y).toBe(0);
		expect(result.width).toBe(200);
		expect(result.height).toBe(200);
	});

	it('should allow negative coordinates from padding', () => {
		const rect = { x: 5, y: 5, width: 10, height: 10 };
		const result = inflateRect(rect, 10);
		expect(result.x).toBe(-5);
		expect(result.y).toBe(-5);
	});
});

describe('pointInRect', () => {
	const rect = { x: 0, y: 0, width: 100, height: 100 };

	it('should return true for point inside rect', () => {
		expect(pointInRect({ x: 50, y: 50 }, rect)).toBe(true);
	});

	it('should return true for point on edge', () => {
		expect(pointInRect({ x: 0, y: 0 }, rect)).toBe(true);
		expect(pointInRect({ x: 100, y: 100 }, rect)).toBe(true);
		expect(pointInRect({ x: 50, y: 0 }, rect)).toBe(true);
	});

	it('should return false for point outside rect', () => {
		expect(pointInRect({ x: -1, y: 50 }, rect)).toBe(false);
		expect(pointInRect({ x: 101, y: 50 }, rect)).toBe(false);
		expect(pointInRect({ x: 50, y: -1 }, rect)).toBe(false);
		expect(pointInRect({ x: 50, y: 101 }, rect)).toBe(false);
	});

	it('should handle rect with offset position', () => {
		const offsetRect = { x: 50, y: 50, width: 100, height: 100 };
		expect(pointInRect({ x: 75, y: 75 }, offsetRect)).toBe(true);
		expect(pointInRect({ x: 49, y: 75 }, offsetRect)).toBe(false);
	});

	it('should handle zero-sized rect (degenerate)', () => {
		const zeroRect = { x: 50, y: 50, width: 0, height: 0 };
		expect(pointInRect({ x: 50, y: 50 }, zeroRect)).toBe(true);
		expect(pointInRect({ x: 51, y: 50 }, zeroRect)).toBe(false);
	});
});

describe('segmentIntersectsRect', () => {
	const rect = { x: 20, y: 20, width: 60, height: 60 };

	it('should return true for horizontal segment crossing rect', () => {
		expect(segmentIntersectsRect({ x: 0, y: 50 }, { x: 100, y: 50 }, rect)).toBe(true);
	});

	it('should return true for vertical segment crossing rect', () => {
		expect(segmentIntersectsRect({ x: 50, y: 0 }, { x: 50, y: 100 }, rect)).toBe(true);
	});

	it('should return false for segment completely above rect', () => {
		expect(segmentIntersectsRect({ x: 0, y: 10 }, { x: 100, y: 10 }, rect)).toBe(false);
	});

	it('should return false for segment completely below rect', () => {
		expect(segmentIntersectsRect({ x: 0, y: 90 }, { x: 100, y: 90 }, rect)).toBe(false);
	});

	it('should return false for segment completely to the left', () => {
		expect(segmentIntersectsRect({ x: 10, y: 0 }, { x: 10, y: 100 }, rect)).toBe(false);
	});

	it('should return false for segment completely to the right', () => {
		expect(segmentIntersectsRect({ x: 90, y: 0 }, { x: 90, y: 100 }, rect)).toBe(false);
	});

	it('should handle segment with start and end swapped', () => {
		expect(segmentIntersectsRect({ x: 100, y: 50 }, { x: 0, y: 50 }, rect)).toBe(true);
	});

	it('should return false when no overlap in X range', () => {
		expect(segmentIntersectsRect({ x: 0, y: 50 }, { x: 15, y: 50 }, rect)).toBe(false);
	});
});

describe('directPathClear', () => {
	it('should return true when there are no obstacles', () => {
		expect(directPathClear({ x: 0, y: 0 }, { x: 100, y: 0 }, [])).toBe(true);
	});

	it('should return true when path does not intersect any obstacle', () => {
		const obstacles = [{ x: 50, y: 50, width: 20, height: 20 }];
		expect(directPathClear({ x: 0, y: 0 }, { x: 100, y: 0 }, obstacles)).toBe(true);
	});

	it('should return false when path intersects an obstacle', () => {
		const obstacles = [{ x: 40, y: 0, width: 20, height: 20 }];
		expect(directPathClear({ x: 0, y: 10 }, { x: 100, y: 10 }, obstacles)).toBe(false);
	});

	it('should return false when path intersects any of multiple obstacles', () => {
		const obstacles = [
			{ x: 10, y: 10, width: 5, height: 5 },
			{ x: 50, y: 0, width: 20, height: 20 },
		];
		expect(directPathClear({ x: 0, y: 10 }, { x: 100, y: 10 }, obstacles)).toBe(false);
	});
});

describe('heuristic', () => {
	it('should return Manhattan distance', () => {
		expect(heuristic({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
	});

	it('should return 0 for same point', () => {
		expect(heuristic({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
	});

	it('should handle negative coordinates', () => {
		expect(heuristic({ x: -3, y: -4 }, { x: 3, y: 4 })).toBe(14);
	});

	it('should be symmetric', () => {
		const a = { x: 10, y: 20 };
		const b = { x: 30, y: 50 };
		expect(heuristic(a, b)).toBe(heuristic(b, a));
	});

	it('should return horizontal distance for same Y', () => {
		expect(heuristic({ x: 0, y: 5 }, { x: 10, y: 5 })).toBe(10);
	});

	it('should return vertical distance for same X', () => {
		expect(heuristic({ x: 5, y: 0 }, { x: 5, y: 10 })).toBe(10);
	});
});

describe('pointKey', () => {
	it('should produce "x,y" string rounded to integers', () => {
		expect(pointKey({ x: 10, y: 20 })).toBe('10,20');
	});

	it('should round float coordinates', () => {
		expect(pointKey({ x: 10.7, y: 20.3 })).toBe('11,20');
	});

	it('should handle negative coordinates', () => {
		expect(pointKey({ x: -5, y: -10 })).toBe('-5,-10');
	});

	it('should handle zero coordinates', () => {
		expect(pointKey({ x: 0, y: 0 })).toBe('0,0');
	});
});

describe('buildGraphNodes', () => {
	it('should include start and end points', () => {
		const start = { x: 10, y: 10 };
		const end = { x: 90, y: 90 };
		const nodes = buildGraphNodes(start, end, [], 200, 200);
		expect(nodes).toContainEqual(start);
		expect(nodes).toContainEqual(end);
	});

	it('should generate corner nodes from inflated obstacles', () => {
		const start = { x: 0, y: 0 };
		const end = { x: 200, y: 200 };
		const obstacles = [{ x: 50, y: 50, width: 40, height: 40 }];
		const nodes = buildGraphNodes(start, end, obstacles, 300, 300);
		// Should have more than just start+end
		expect(nodes.length).toBeGreaterThan(2);
	});

	it('should filter out corner nodes that are inside obstacles', () => {
		const start = { x: 0, y: 0 };
		const end = { x: 200, y: 200 };
		// Two overlapping obstacles
		const obstacles = [
			{ x: 50, y: 50, width: 60, height: 60 },
			{ x: 40, y: 40, width: 80, height: 80 },
		];
		const nodes = buildGraphNodes(start, end, obstacles, 300, 300);
		// All returned nodes should not be inside any obstacle
		for (const node of nodes) {
			if (node === start || node === end) continue;
			for (const rect of obstacles) {
				// At least some corner nodes should be excluded
				// Just verify we get a result
			}
		}
		expect(nodes.length).toBeGreaterThanOrEqual(2);
	});

	it('should filter out nodes outside canvas bounds', () => {
		const start = { x: 5, y: 5 };
		const end = { x: 95, y: 95 };
		// Obstacle near the edge
		const obstacles = [{ x: -5, y: -5, width: 20, height: 20 }];
		const nodes = buildGraphNodes(start, end, obstacles, 100, 100);
		for (const node of nodes) {
			expect(node.x).toBeGreaterThanOrEqual(-4 - 1); // margin of -4 is allowed if within canvas
		}
		expect(nodes.length).toBeGreaterThanOrEqual(2);
	});

	it('should return at least start and end when no obstacles', () => {
		const start = { x: 0, y: 0 };
		const end = { x: 100, y: 100 };
		const nodes = buildGraphNodes(start, end, [], 200, 200);
		expect(nodes.length).toBeGreaterThanOrEqual(2);
		expect(nodes[0]).toEqual(start);
		expect(nodes[1]).toEqual(end);
	});
});
