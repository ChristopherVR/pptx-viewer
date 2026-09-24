import { describe, expect, it } from 'vitest';

import { ellipseOutline, rectOutline } from './smartart-3d-primitive-outline';

describe('rectOutline', () => {
	it('returns 5 points (closed) for a square-cornered rect', () => {
		const pts = rectOutline(0, 0, 100, 50, 0);
		expect(pts).toStrictEqual([
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 100, y: 50 },
			{ x: 0, y: 50 },
			{ x: 0, y: 0 },
		]);
	});

	it('stays within the rect bounds when rounded', () => {
		const pts = rectOutline(10, 10, 100, 60, 12);
		for (const p of pts) {
			expect(p.x).toBeGreaterThanOrEqual(10 - 1e-9);
			expect(p.x).toBeLessThanOrEqual(110 + 1e-9);
			expect(p.y).toBeGreaterThanOrEqual(10 - 1e-9);
			expect(p.y).toBeLessThanOrEqual(70 + 1e-9);
		}
	});

	it('clamps a corner radius larger than half the smaller side', () => {
		const pts = rectOutline(0, 0, 20, 100, 500);
		for (const p of pts) {
			expect(p.x).toBeGreaterThanOrEqual(-1e-9);
			expect(p.x).toBeLessThanOrEqual(20 + 1e-9);
		}
	});
});

describe('ellipseOutline', () => {
	it('produces points on the ellipse boundary', () => {
		const pts = ellipseOutline(50, 25, 40, 20, 16);
		for (const p of pts) {
			const nx = (p.x - 50) / 40;
			const ny = (p.y - 25) / 20;
			expect(nx * nx + ny * ny).toBeCloseTo(1, 5);
		}
	});

	it('closes the loop (first and last points equal)', () => {
		const pts = ellipseOutline(0, 0, 10, 10, 8);
		expect(pts[0].x).toBeCloseTo(pts[pts.length - 1].x, 9);
		expect(pts[0].y).toBeCloseTo(pts[pts.length - 1].y, 9);
	});
});
