import { describe, it, expect } from 'vitest';

import { parseMotionPathPoints } from './animation-motion-path';

describe('parseMotionPathPoints', () => {
	it('parses a simple M/L polyline into scaled percentage points', () => {
		const points = parseMotionPathPoints('M 0,0 L 0.5,0.5');
		expect(points).toStrictEqual([
			{ x: 0, y: 0 },
			{ x: 50, y: 50 },
		]);
	});

	it('treats extra coordinate pairs after M as implicit linetos', () => {
		const points = parseMotionPathPoints('M 0,0 1,0 1,1');
		expect(points).toStrictEqual([
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 100, y: 100 },
		]);
	});

	it('samples a cubic-bezier segment instead of using control points as waypoints', () => {
		const points = parseMotionPathPoints('M 0,0 C 0,1 1,1 1,0');
		// Start + 8 bezier samples = 9 points.
		expect(points).toHaveLength(9);
		// The control points (0,1) and (1,1) must NOT appear literally; the curve
		// bulges below its endpoints but never reaches y = 100.
		const maxY = Math.max(...points.map((p) => p.y));
		expect(maxY).toBeGreaterThan(0);
		expect(maxY).toBeLessThan(100);
		// Endpoints are exact.
		expect(points[0]).toStrictEqual({ x: 0, y: 0 });
		expect(points[8].x).toBeCloseTo(100, 5);
		expect(points[8].y).toBeCloseTo(0, 5);
	});

	it('produces a monotonically smooth x-progression across a bezier', () => {
		const points = parseMotionPathPoints('M 0,0 C 0.25,0 0.75,1 1,1');
		for (let i = 1; i < points.length; i++) {
			expect(points[i].x).toBeGreaterThanOrEqual(points[i - 1].x - 1e-9);
		}
	});

	it('supports relative (lower-case) commands', () => {
		const points = parseMotionPathPoints('m 0,0 l 0.5,0 l 0,0.5');
		expect(points).toStrictEqual([
			{ x: 0, y: 0 },
			{ x: 50, y: 0 },
			{ x: 50, y: 50 },
		]);
	});

	it('ignores Z and returns an empty array for an unparseable path', () => {
		expect(parseMotionPathPoints('')).toStrictEqual([]);
		const closed = parseMotionPathPoints('M 0,0 L 1,0 Z');
		expect(closed).toStrictEqual([
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
		]);
	});
});
