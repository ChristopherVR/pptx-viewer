/**
 * Generic "unit square -> quadrilateral" projective homography solver
 * (framework-agnostic, no OOXML-specific knowledge).
 *
 * Split out of `visual-3d-camera-parametric.ts` so that module's own math
 * (the actual camera model) is not tangled with this general-purpose closed
 * form, and so it can be unit-tested in isolation against hand-computed
 * cases. This is the standard "map a square to an arbitrary convex
 * quadrilateral" projective transform (P. Heckbert, "Fundamentals of Texture
 * Mapping and Image Warping", UC Berkeley MS thesis, 1989, §3): given the
 * four destination points the unit square's corners `(0,0) (1,0) (0,1)
 * (1,1)` map to, it returns the unique 3x3 homography (`h33` normalised to
 * 1) reproducing exactly those four correspondences - the same
 * {@link Homography3} shape `visual-3d-camera-homography`'s COM-measured
 * preset table already uses, so its `homographyToMatrix3d` embedding is
 * reused unchanged for a homography built by this module too.
 *
 * @module render/visual-3d-camera-homography-math
 */

import type { Homography3 } from './visual-3d-camera-homography';

/** A 2D point. */
export interface Point2 {
	x: number;
	y: number;
}

/**
 * Solve the projective homography mapping the unit square's corners
 * `(0,0)->d00`, `(1,0)->d10`, `(0,1)->d01`, `(1,1)->d11`. Degenerates
 * gracefully to the identity when all four destinations equal their source
 * (avoids a division by zero the affine special case would otherwise need to
 * guard separately).
 */
export function unitSquareToQuadHomography(
	d00: Point2,
	d10: Point2,
	d01: Point2,
	d11: Point2,
): Homography3 {
	const dx1 = d10.x - d11.x;
	const dx2 = d01.x - d11.x;
	const dx3 = d00.x - d10.x + d11.x - d01.x;
	const dy1 = d10.y - d11.y;
	const dy2 = d01.y - d11.y;
	const dy3 = d00.y - d10.y + d11.y - d01.y;

	const denom = dx1 * dy2 - dx2 * dy1;
	let g = 0;
	let h = 0;
	if (denom !== 0) {
		// `|| 0` folds a `-0` result to `+0` (e.g. the trivial identity case),
		// which matters only for exact-equality assertions in tests.
		g = (dx3 * dy2 - dx2 * dy3) / denom || 0;
		h = (dx1 * dy3 - dx3 * dy1) / denom || 0;
	}

	const a = d10.x - d00.x + g * d10.x;
	const b = d01.x - d00.x + h * d01.x;
	const c = d00.x;
	const d = d10.y - d00.y + g * d10.y;
	const e = d01.y - d00.y + h * d01.y;
	const f = d00.y;

	return [a, b, c, d, e, f, g, h, 1];
}

/** Apply a {@link Homography3} to a single point (for tests / sanity checks). */
export function applyHomography(h: Homography3, p: Point2): Point2 {
	const [a, b, c, d, e, f, g, hh, i] = h;
	const w = g * p.x + hh * p.y + i;
	return { x: (a * p.x + b * p.y + c) / w, y: (d * p.x + e * p.y + f) / w };
}
