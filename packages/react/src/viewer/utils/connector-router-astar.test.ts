import { describe, it, expect } from 'vitest';
import { aStarOrthogonal, simplifyPath } from './connector-router-astar';
import type { RouterPoint, RouterRect } from './connector-router-types';

describe('simplifyPath', () => {
	it('should return original path when 2 or fewer points', () => {
		const p: RouterPoint[] = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
		expect(simplifyPath(p)).toEqual(p);
	});

	it('should return original path for single point', () => {
		const p: RouterPoint[] = [{ x: 5, y: 5 }];
		expect(simplifyPath(p)).toEqual(p);
	});

	it('should return empty array for empty input', () => {
		expect(simplifyPath([])).toEqual([]);
	});

	it('should keep start and end points', () => {
		const points: RouterPoint[] = [
			{ x: 0, y: 0 },
			{ x: 50, y: 0 },
			{ x: 100, y: 0 },
		];
		const result = simplifyPath(points);
		expect(result[0]).toEqual({ x: 0, y: 0 });
		expect(result[result.length - 1]).toEqual({ x: 100, y: 0 });
	});

	it('should keep points where direction changes', () => {
		const points: RouterPoint[] = [
			{ x: 0, y: 0 },
			{ x: 50, y: 0 },   // horizontal
			{ x: 50, y: 50 },  // vertical turn
			{ x: 100, y: 50 }, // horizontal again
		];
		const result = simplifyPath(points);
		// The middle point at (50,0) -> (50,50) is a direction change, should be kept
		expect(result.length).toBeGreaterThanOrEqual(3);
	});

	it('should not produce fewer than 2 points for valid input', () => {
		const points: RouterPoint[] = [
			{ x: 0, y: 0 },
			{ x: 50, y: 0 },
			{ x: 100, y: 0 },
			{ x: 150, y: 0 },
		];
		const result = simplifyPath(points);
		expect(result.length).toBeGreaterThanOrEqual(2);
		expect(result[0]).toEqual({ x: 0, y: 0 });
		expect(result[result.length - 1]).toEqual({ x: 150, y: 0 });
	});

	it('should handle L-shaped path', () => {
		const points: RouterPoint[] = [
			{ x: 0, y: 0 },
			{ x: 0, y: 50 },
			{ x: 50, y: 50 },
		];
		const result = simplifyPath(points);
		expect(result.length).toBeGreaterThanOrEqual(2);
	});

	it('should handle zigzag path', () => {
		const points: RouterPoint[] = [
			{ x: 0, y: 0 },
			{ x: 50, y: 0 },
			{ x: 50, y: 50 },
			{ x: 100, y: 50 },
			{ x: 100, y: 100 },
		];
		const result = simplifyPath(points);
		// Should keep all corners where direction changes
		expect(result.length).toBeGreaterThanOrEqual(4);
	});
});

describe('aStarOrthogonal', () => {
	it('should return start and end for direct horizontal path with no obstacles', () => {
		const start: RouterPoint = { x: 0, y: 50 };
		const end: RouterPoint = { x: 100, y: 50 };
		const nodes = [start, end];
		const result = aStarOrthogonal(nodes, start, end, []);
		expect(result.length).toBeGreaterThanOrEqual(2);
		expect(result[0]).toEqual(start);
		expect(result[result.length - 1]).toEqual(end);
	});

	it('should return start and end for direct vertical path with no obstacles', () => {
		const start: RouterPoint = { x: 50, y: 0 };
		const end: RouterPoint = { x: 50, y: 100 };
		const nodes = [start, end];
		const result = aStarOrthogonal(nodes, start, end, []);
		expect(result.length).toBeGreaterThanOrEqual(2);
		expect(result[0]).toEqual(start);
		expect(result[result.length - 1]).toEqual(end);
	});

	it('should find a path around a single obstacle', () => {
		const start: RouterPoint = { x: 0, y: 50 };
		const end: RouterPoint = { x: 200, y: 50 };
		const obstacle: RouterRect = { x: 80, y: 30, width: 40, height: 40 };
		// Add corner nodes to give A* options
		const nodes: RouterPoint[] = [
			start,
			end,
			{ x: 75, y: 25 },
			{ x: 125, y: 25 },
			{ x: 75, y: 75 },
			{ x: 125, y: 75 },
		];
		const result = aStarOrthogonal(nodes, start, end, [obstacle]);
		expect(result.length).toBeGreaterThanOrEqual(2);
		expect(result[0]).toEqual(start);
		expect(result[result.length - 1]).toEqual(end);
	});

	it('should return fallback [start, end] when no path found', () => {
		const start: RouterPoint = { x: 0, y: 0 };
		const end: RouterPoint = { x: 100, y: 100 };
		// No intermediate nodes, and not axis-aligned, so A* will likely fail to connect
		const nodes = [start, end];
		// Big obstacle blocking everything
		const obstacle: RouterRect = { x: -10, y: -10, width: 200, height: 200 };
		const result = aStarOrthogonal(nodes, start, end, [obstacle]);
		expect(result.length).toBeGreaterThanOrEqual(2);
		// Should at least have start and end
		expect(result[0]).toEqual(start);
		expect(result[result.length - 1]).toEqual(end);
	});

	it('should handle same start and end point', () => {
		const point: RouterPoint = { x: 50, y: 50 };
		const nodes = [point];
		const result = aStarOrthogonal(nodes, point, point, []);
		expect(result.length).toBeGreaterThanOrEqual(1);
	});
});
