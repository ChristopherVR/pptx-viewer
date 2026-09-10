import { describe, expect, it } from 'vitest';

import { applyHomography } from './visual-3d-camera-homography-math';
import {
	computeParametricCameraHomography,
	sixtyThousandthsDegToRad,
} from './visual-3d-camera-parametric';

const DEFAULT_FOV_DEG = 60;
const fovRad = (DEFAULT_FOV_DEG * Math.PI) / 180;

describe('computeParametricCameraHomography', () => {
	it('reproduces the exact identity for lat=lon=rev=0 (matches orthographicFront)', () => {
		const h = computeParametricCameraHomography({ latRad: 0, lonRad: 0, revRad: 0, fovRad });
		for (const [u, v] of [
			[0, 0],
			[1, 0],
			[0, 1],
			[1, 1],
		] as const) {
			const p = applyHomography(h, { x: u, y: v });
			expect(p.x).toBeCloseTo(u, 10);
			expect(p.y).toBeCloseTo(v, 10);
		}
	});

	it('a pure yaw (lon != 0) keeps the transform symmetric top-to-bottom (no lat/rev applied)', () => {
		const h = computeParametricCameraHomography({
			latRad: 0,
			lonRad: (25 * Math.PI) / 180,
			revRad: 0,
			fovRad,
		});
		const topLeft = applyHomography(h, { x: 0, y: 0 });
		const bottomLeft = applyHomography(h, { x: 0, y: 1 });
		// A pure yaw only skews left/right, not top/bottom: both left corners
		// keep the same x.
		expect(topLeft.x).toBeCloseTo(bottomLeft.x, 6);
	});

	it('a pure pitch (lat != 0) keeps the transform symmetric left-to-right', () => {
		const h = computeParametricCameraHomography({
			latRad: (25 * Math.PI) / 180,
			lonRad: 0,
			revRad: 0,
			fovRad,
		});
		const topLeft = applyHomography(h, { x: 0, y: 0 });
		const topRight = applyHomography(h, { x: 1, y: 0 });
		expect(topLeft.y).toBeCloseTo(topRight.y, 6);
	});

	it('a pure roll (rev != 0) rotates the whole square rigidly about its own centre', () => {
		const h = computeParametricCameraHomography({
			latRad: 0,
			lonRad: 0,
			revRad: (45 * Math.PI) / 180,
			fovRad,
		});
		// A rigid rotation preserves all 4 side lengths and both diagonals.
		const corners = [
			[0, 0],
			[1, 0],
			[1, 1],
			[0, 1],
		].map(([u, v]) => applyHomography(h, { x: u, y: v }));
		const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
			Math.hypot(a.x - b.x, a.y - b.y);
		for (let i = 0; i < 4; i++) {
			expect(dist(corners[i], corners[(i + 1) % 4])).toBeCloseTo(1, 6);
		}
		expect(dist(corners[0], corners[2])).toBeCloseTo(Math.SQRT2, 6);
	});

	// COM-measured (see the module doc comment): a pure single-axis `a:rot`
	// produces a SYMMETRIC scale with NO keystone at all (left and right
	// vertical edges stay the SAME length; only the overall width shrinks),
	// unlike a naive pinhole projection (which would predict a left/right
	// length asymmetry). This is the behaviour the primary cosine term is
	// built to reproduce exactly.
	it('a pure yaw shrinks width by cos(lon) with NO left/right edge-length asymmetry', () => {
		const lonDeg = 25;
		const h = computeParametricCameraHomography({
			latRad: 0,
			lonRad: (lonDeg * Math.PI) / 180,
			revRad: 0,
			fovRad,
		});
		const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
			Math.hypot(a.x - b.x, a.y - b.y);
		const left = dist(applyHomography(h, { x: 0, y: 0 }), applyHomography(h, { x: 0, y: 1 }));
		const right = dist(applyHomography(h, { x: 1, y: 0 }), applyHomography(h, { x: 1, y: 1 }));
		expect(left).toBeCloseTo(right, 10);
		const top = dist(applyHomography(h, { x: 0, y: 0 }), applyHomography(h, { x: 1, y: 0 }));
		expect(top).toBeCloseTo(Math.cos((lonDeg * Math.PI) / 180), 10);
	});

	it('a combined (two-axis) pose adds a genuine skew a pure single-axis pose does not have', () => {
		// Both lat and lon nonzero: the secondary term activates, breaking the
		// left/right symmetry the single-axis case above keeps exactly.
		const h = computeParametricCameraHomography({
			latRad: (20 * Math.PI) / 180,
			lonRad: (20 * Math.PI) / 180,
			revRad: 0,
			fovRad,
		});
		const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
			Math.hypot(a.x - b.x, a.y - b.y);
		const left = dist(applyHomography(h, { x: 0, y: 0 }), applyHomography(h, { x: 0, y: 1 }));
		const right = dist(applyHomography(h, { x: 1, y: 0 }), applyHomography(h, { x: 1, y: 1 }));
		expect(Math.abs(left - right)).toBeGreaterThan(0.001);
	});
});

describe('sixtyThousandthsDegToRad', () => {
	it('converts 60000ths-of-a-degree to radians', () => {
		expect(sixtyThousandthsDegToRad(60000 * 90)).toBeCloseTo(Math.PI / 2, 10);
	});

	it('treats undefined/0 as 0', () => {
		expect(sixtyThousandthsDegToRad(undefined)).toBe(0);
		expect(sixtyThousandthsDegToRad(0)).toBe(0);
	});
});
