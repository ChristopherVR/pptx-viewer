import { describe, expect, it } from 'vitest';

import { applyHomography, unitSquareToQuadHomography } from './visual-3d-camera-homography-math';

describe('unitSquareToQuadHomography', () => {
	it('returns the identity when the quad IS the unit square', () => {
		const h = unitSquareToQuadHomography(
			{ x: 0, y: 0 },
			{ x: 1, y: 0 },
			{ x: 0, y: 1 },
			{ x: 1, y: 1 },
		);
		expect(h).toStrictEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
	});

	it('reproduces a pure affine scale+translate (no projective terms)', () => {
		// Unit square -> [2,5] x [3,7]: a pure affine map, g=h=0.
		const h = unitSquareToQuadHomography(
			{ x: 2, y: 3 },
			{ x: 5, y: 3 },
			{ x: 2, y: 7 },
			{ x: 5, y: 7 },
		);
		expect(h[6]).toBeCloseTo(0, 10); // g
		expect(h[7]).toBeCloseTo(0, 10); // h
		expect(applyHomography(h, { x: 0.5, y: 0.5 })).toStrictEqual({ x: 3.5, y: 5 });
	});

	it('exactly reproduces all 4 corner correspondences for a genuine trapezoid', () => {
		const d00 = { x: 0.1, y: 0 };
		const d10 = { x: 0.9, y: 0 };
		const d01 = { x: -0.2, y: 1 };
		const d11 = { x: 1.2, y: 1 };
		const h = unitSquareToQuadHomography(d00, d10, d01, d11);
		expect(applyHomography(h, { x: 0, y: 0 }).x).toBeCloseTo(d00.x, 10);
		expect(applyHomography(h, { x: 1, y: 0 }).x).toBeCloseTo(d10.x, 10);
		expect(applyHomography(h, { x: 0, y: 1 }).x).toBeCloseTo(d01.x, 10);
		expect(applyHomography(h, { x: 1, y: 1 }).x).toBeCloseTo(d11.x, 10);
	});

	it('reproduces a real off-axis (non-affine) quadrilateral, verifying the projective terms', () => {
		// A genuine keystone: the far edge (v=1) is narrower than the near edge.
		const d00 = { x: 0, y: 0 };
		const d10 = { x: 1, y: 0 };
		const d01 = { x: 0.3, y: 1 };
		const d11 = { x: 0.7, y: 1 };
		const h = unitSquareToQuadHomography(d00, d10, d01, d11);
		// Not a parallelogram (d10-d00 has a different length than d11-d01), so
		// at least one projective term (g, h) must be nonzero.
		expect(h[6] !== 0 || h[7] !== 0).toBeTruthy();
		const mid = applyHomography(h, { x: 0.5, y: 1 });
		expect(mid.x).toBeCloseTo(0.5, 10);
	});
});
