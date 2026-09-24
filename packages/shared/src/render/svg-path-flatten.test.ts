import { describe, expect, it } from 'vitest';

import { flattenSvgPath } from './svg-path-flatten';

describe('flattenSvgPath', () => {
	it('flattens a rectangle path (M L L L Z) to its 4 corners', () => {
		const loops = flattenSvgPath('M 0 0 L 100 0 L 100 50 L 0 50 Z');
		expect(loops).toHaveLength(1);
		const pts = loops[0];
		expect(pts[0]).toStrictEqual({ x: 0, y: 0 });
		expect(pts[1]).toStrictEqual({ x: 100, y: 0 });
		expect(pts[2]).toStrictEqual({ x: 100, y: 50 });
		expect(pts[3]).toStrictEqual({ x: 0, y: 50 });
		// Z re-appends the subpath start.
		expect(pts[4]).toStrictEqual({ x: 0, y: 0 });
	});

	it('handles relative commands identically to absolute ones', () => {
		const abs = flattenSvgPath('M 10 10 L 60 10 L 60 40 Z');
		const rel = flattenSvgPath('m 10 10 l 50 0 l 0 30 z');
		expect(rel).toStrictEqual(abs);
	});

	it('flattens H and V shorthand', () => {
		const loops = flattenSvgPath('M 0 0 H 40 V 20 H 0 Z');
		const pts = loops[0];
		expect(pts).toStrictEqual([
			{ x: 0, y: 0 },
			{ x: 40, y: 0 },
			{ x: 40, y: 20 },
			{ x: 0, y: 20 },
			{ x: 0, y: 0 },
		]);
	});

	it('samples a cubic Bezier so the midpoint lands on the curve, not the chord', () => {
		// A quarter-circle-ish cubic from (0,0) to (100,100) via control points
		// that bow the curve well off the straight chord.
		const loops = flattenSvgPath('M 0 0 C 0 100 100 100 100 100', 8);
		const pts = loops[0];
		const mid = pts[Math.floor(pts.length / 2)];
		// The chord midpoint would be (50, 50); the true cubic midpoint bows
		// toward the control points, well above the chord's y at that x.
		expect(mid.y).toBeGreaterThan(60);
	});

	it('samples a full-circle arc (two semicircle A commands) close to a circle', () => {
		const r = 50;
		const d = `M ${-r} 0 A ${r} ${r} 0 1 1 ${r} 0 A ${r} ${r} 0 1 1 ${-r} 0`;
		const loops = flattenSvgPath(d, 32);
		const pts = loops[0];
		expect(pts.length).toBeGreaterThan(20);
		for (const p of pts) {
			const dist = Math.hypot(p.x, p.y);
			expect(dist).toBeGreaterThan(r - 1);
			expect(dist).toBeLessThan(r + 1);
		}
	});

	it('starts a new loop (hole) on each additional M command', () => {
		const loops = flattenSvgPath('M 0 0 L 10 0 L 10 10 Z M 2 2 L 8 2 L 8 8 Z');
		expect(loops).toHaveLength(2);
		expect(loops[0][0]).toStrictEqual({ x: 0, y: 0 });
		expect(loops[1][0]).toStrictEqual({ x: 2, y: 2 });
	});

	it('returns an empty array for an empty or invalid path', () => {
		expect(flattenSvgPath('')).toStrictEqual([]);
	});
});
