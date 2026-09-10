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

	// COM-measured (27-point lat x lon x rev grid, see the module doc
	// comment): a combined two-axis pose is an AFFINE SHEAR (a parallelogram,
	// opposite edges equal length and parallel), not a projective keystone -
	// the cross term lives entirely in `y` and depends only on `x`, so it
	// adds the SAME offset to both endpoints of any vertical edge and cancels
	// out of that edge's length. This replaced an earlier (WRONG, pre-27-
	// point-grid) assumption that a combined pose keystones the left/right
	// edge lengths apart; the grid disproved that shape of correction, not
	// just its magnitude.
	it('a combined (two-axis) pose is an affine shear: opposite edges stay equal length and parallel, but it is not a keystone', () => {
		const h = computeParametricCameraHomography({
			latRad: (20 * Math.PI) / 180,
			lonRad: (20 * Math.PI) / 180,
			revRad: 0,
			fovRad,
		});
		const tl = applyHomography(h, { x: 0, y: 0 });
		const tr = applyHomography(h, { x: 1, y: 0 });
		const bl = applyHomography(h, { x: 0, y: 1 });
		const br = applyHomography(h, { x: 1, y: 1 });
		const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
			Math.hypot(a.x - b.x, a.y - b.y);
		// Parallelogram: opposite edges equal length...
		expect(dist(tl, tr)).toBeCloseTo(dist(bl, br), 10);
		expect(dist(tl, bl)).toBeCloseTo(dist(tr, br), 10);
		// ...and parallel (top edge vector == bottom edge vector).
		expect(tr.x - tl.x).toBeCloseTo(br.x - bl.x, 10);
		expect(tr.y - tl.y).toBeCloseTo(br.y - bl.y, 10);
		// It IS a genuine shear, not just a scaled rectangle: `x` depends only
		// on the source `x` (never `y`), so the left/right edges stay exactly
		// vertical (bl.x === tl.x), but the top/bottom edges tilt (tr.y !==
		// tl.y) once both axes are nonzero - the cross term lives entirely in
		// `y`.
		expect(bl.x).toBeCloseTo(tl.x, 10);
		expect(Math.abs(tr.y - tl.y)).toBeGreaterThan(0.001);
	});
});

// COM-measured pinned corners: real PowerPoint `Slide.Export` results
// (144px/in, flat 2in `prst="orthographicFront"` + `a:rot` squares) from the
// 27-point lat x lon x rev grid campaign documented in the module's doc
// comment (scripts: gen-fixture.mjs -> measure.ps1 -> solve-corners.mjs ->
// fit-model.mjs, scratch/one-off, not committed). Destination fractions are
// relative to the square's own un-rotated top-left corner, matching
// `computeParametricCameraHomography`'s convention. Tolerance 0.03 (3%) is
// comfortably above the campaign's measured per-cell noise (avg 0.61%, worst
// 2.10%, all attributable to antialiasing-boundary noise at a "rev=25"
// non-axis-aligned roll angle - see the module doc comment's raw table) and
// comfortably below the ~25-29% error the REPLACED damped-pinhole model left
// on the combined cases, so this is a real regression guard, not just a
// self-consistency check against the implementation's own formula.
describe('computeParametricCameraHomography matches real PowerPoint COM measurement', () => {
	const DEG = Math.PI / 180;
	const expectCornersClose = (
		h: ReturnType<typeof computeParametricCameraHomography>,
		measured: {
			tl: [number, number];
			tr: [number, number];
			bl: [number, number];
			br: [number, number];
		},
		tolerance = 0.03,
	): void => {
		const cases: [readonly [number, number], readonly [number, number]][] = [
			[[0, 0], measured.tl],
			[[1, 0], measured.tr],
			[[0, 1], measured.bl],
			[[1, 1], measured.br],
		];
		for (const [[u, v], [mx, my]] of cases) {
			const p = applyHomography(h, { x: u, y: v });
			expect(Math.hypot(p.x - mx, p.y - my)).toBeLessThan(tolerance);
		}
	};

	it('identity (lat=lon=rev=0)', () => {
		const h = computeParametricCameraHomography({ latRad: 0, lonRad: 0, revRad: 0, fovRad });
		expectCornersClose(h, { tl: [0, 0], tr: [1, 0], bl: [0, 1], br: [1, 1] });
	});

	it('lon=25deg only (single-axis yaw)', () => {
		const h = computeParametricCameraHomography({ latRad: 0, lonRad: 25 * DEG, revRad: 0, fovRad });
		expectCornersClose(h, {
			tl: [0.0451, -0.0035],
			tr: [0.9514, -0.0035],
			bl: [0.0451, 1],
			br: [0.9514, 1],
		});
	});

	it('lat=25deg only (single-axis pitch)', () => {
		const h = computeParametricCameraHomography({ latRad: 25 * DEG, lonRad: 0, revRad: 0, fovRad });
		expectCornersClose(h, {
			tl: [-0.0035, 0.0451],
			tr: [0.9965, 0.0451],
			bl: [-0.0035, 0.9514],
			br: [0.9965, 0.9514],
		});
	});

	it('rev=45deg only (roll)', () => {
		const h = computeParametricCameraHomography({ latRad: 0, lonRad: 0, revRad: 45 * DEG, fovRad });
		expectCornersClose(h, {
			tl: [-0.2049, 0.5],
			tr: [0.4965, -0.2049],
			bl: [0.5, 1.2014],
			br: [1.2014, 0.4965],
		});
	});

	// The original open-limitation case (`lat=35.26deg lon=45deg rev=45deg`):
	// the REPLACED damped-pinhole secondary term missed this by ~25-29%
	// relative corner error; the cross-term model lands within measurement
	// noise.
	it('lat=35.26deg lon=45deg rev=45deg (the combined case the fix targets)', () => {
		const h = computeParametricCameraHomography({
			latRad: 35.26 * DEG,
			lonRad: 45 * DEG,
			revRad: 45 * DEG,
			fovRad,
		});
		expectCornersClose(h, {
			tl: [-0.1806, 0.316],
			tr: [0.6042, 0.1042],
			bl: [0.3924, 0.8924],
			br: [1.1806, 0.6806],
		});
	});

	it('lat=35.26deg lon=45deg rev=0 (combined, no roll)', () => {
		const h = computeParametricCameraHomography({
			latRad: 35.26 * DEG,
			lonRad: 45 * DEG,
			revRad: 0,
			fovRad,
		});
		expectCornersClose(h, {
			tl: [0.1458, -0.1146],
			tr: [0.8507, 0.2951],
			bl: [0.1458, 0.7014],
			br: [0.8507, 1.1111],
		});
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
