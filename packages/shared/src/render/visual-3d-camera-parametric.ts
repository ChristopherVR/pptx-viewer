/**
 * Parametric camera homography for an explicit `a:camera/a:rot` override
 * (framework-agnostic).
 *
 * Closes the third of the three open "3-D shapes and scenes" limitations
 * (`docs/guide/limitations.md`): `getCameraTransform` (`visual-3d-camera.ts`)
 * used the COM-measured exact `matrix3d` homography (`visual-3d-camera-
 * homography.ts`) ONLY for a recognised `a:camera/@prst` preset with no
 * override, falling back to a hand-tuned `rotateX`/`rotateY` + centred CSS
 * `perspective()` approximation whenever `a:camera/a:rot` (lat/lon/rev) or an
 * explicit `@fov`/`@zoom` was present - an approximation already known (see
 * that module's doc comment) to be unable to reproduce a genuine off-axis
 * vanishing point.
 *
 * This module builds the SAME kind of exact homography the preset table
 * stores, but as a general FUNCTION of camera parameters instead of a fixed
 * lookup, so an explicit override reuses the identical machinery with
 * different inputs rather than a structurally different model:
 *
 * 1. The shape's flat picture plane is a unit square in its own local XY
 *    plane (`z=0`), corners at `(-0.5,-0.5) .. (0.5,0.5)`.
 * 2. Each corner is projected by {@link projectCorner}: an ORTHOGRAPHIC
 *    (parallel, no perspective divide) rotation-composition transform - see
 *    that function's own doc comment for the exact formula and its
 *    derivation.
 * 3. `lat=lon=rev=0` reproduces an EXACT identity homography - the same
 *    trivial case `orthographicFront` is COM-measured to produce - by
 *    construction (`cos(0)=1`, every other term vanishes).
 * 4. `rev` (roll about the view axis) commutes with the projection: rolling
 *    the camera about its own aim axis is exactly a 2D rotation of the
 *    already-projected image, applied here as a post-projection step rather
 *    than a third 3D rotation matrix.
 * 5. The 4 projected corners feed `unitSquareToQuadHomography`
 *    (`visual-3d-camera-homography-math.ts`), the SAME closed-form solver
 *    used nowhere else in this codebase but built specifically to slot into
 *    `visual-3d-camera-homography`'s existing `homographyToMatrix3d`
 *    embedding unchanged.
 *
 * ## COM validation, round 2: the 27-point lat x lon x rev grid (2026-09)
 *
 * The first campaign (single COM measurement per case, see history) found
 * the primary per-axis cosine scale exact for any single-axis `a:rot`, but a
 * damped pinhole-perspective "secondary term" (weighted by
 * `sin(lat)*sin(lon)`, FOV-dependent) under-predicted a genuinely combined
 * pose (`lat=35.26deg lon=45deg rev=45deg`) by ~25-29% relative corner error,
 * repeatably across two independent measurements. That secondary term is
 * REPLACED here, not patched: a fresh 27-point grid (`lat in {0, 25,
 * 35.26deg}` x `lon in {0, 25, 45deg}` x `rev in {0, 25, 45deg}`, including
 * both prior points exactly) was rendered via real PowerPoint COM
 * (`Slide.Export`, 144px/in, flat 2in `prst="orthographicFront"` + `a:rot`
 * squares) and each cell's 4 corners extracted by convex-hull fit (the
 * boundary/hull/quad-simplification method `visual-3d-camera-homography.ts`
 * already validated, NOT the fragile "4 extreme pixels" shortcut the first
 * campaign used, which silently mis-ordered corners for any near-45deg `rev`
 * by matching against UNDISTORTED reference positions - a large rotation's
 * true nearest axis-aligned corner is not its physical origin; fixed by
 * matching against a cosine-scale-plus-rev PRIOR position instead).
 *
 * Fitting the 27 measured cells against every hypothesis in the task brief
 * (Euler order lon-then-lat vs lat-then-lon vs the old damped-pinhole model;
 * orthographic vs a true perspective divide at the override's own FOV;
 * rotation about the shape centre - confirmed by near-zero centroid shift
 * uncorrelated with a cell's distance from the canvas centre, ruling out a
 * slide-centre pivot) found an EXACT closed form: keep `x` as the
 * already-validated pure cosine scale (COM-confirmed independent of `lat`:
 * the same `lon=45deg` cells produced identical `x` at `lat=25deg` and
 * `lat=35.26deg`), and add a rotation-composition cross term to `y` ONLY,
 * with a NEGATIVE sign relative to the naive `Ry(lon).Rx(lat)` composition
 * this module's first attempt used:
 *
 * ```
 * x = X * cos(lon)
 * y = Y * cos(lat) - X * sin(lat) * sin(lon)
 * ```
 *
 * Across all 27 grid cells (script: `gen-fixture.mjs` -> `measure.ps1` ->
 * `solve-corners.mjs` -> `fit-model.mjs`, scratch/one-off, not committed):
 * average max-corner error 0.61%, median well under 1%, worst 3 cells (all
 * `rev=25deg`, an "ugly" non-axis-aligned roll angle that maximises
 * antialiasing-boundary noise at a 288px-side element, not a systematic
 * lat/lon pattern) at 2.10% / 1.96% / 1.70% - see the raw per-cell table
 * below. This lands the combined case in the SAME ~1% band as the
 * single-axis cases, closing the ~25-29% gap the first campaign left open,
 * with NO fov/zoom dependency at all: the model is purely orthographic, so
 * `ParametricCameraParams.fovRad` is now unused by {@link projectCorner}
 * (kept in the type for API stability; `@fov`/`@zoom` were not
 * independently varied by this campaign, only held at their
 * `orthographicFront` default, so this does not claim they have no effect
 * under some other combination this grid did not cover).
 *
 * Raw per-cell max-corner error (fraction of the square's own side, sorted
 * worst-first; `lat=35.26` is the isometric angle `atan(1/sqrt(2))`, reusing
 * the first campaign's own combined-case angle set):
 *
 * ```
 * lat25_lon0_rev25      2.098%   lat25_lon0_rev0       0.390%
 * lat0_lon45_rev25      1.959%   lat25_lon0_rev45      0.362%
 * lat35.26_lon45_rev25  1.696%   lat35.26_lon0_rev45   0.353%
 * lat0_lon25_rev25      0.776%   lat0_lon25_rev45      0.349%
 * lat25_lon25_rev25     0.756%   lat35.26_lon0_rev25   0.347%
 * lat25_lon25_rev45     0.735%   lat35.26_lon45_rev45  0.347%
 * lat0_lon0_rev45       0.669%   lat25_lon45_rev0      0.342%
 * lat35.26_lon25_rev45  0.654%   lat25_lon25_rev0      0.323%
 * lat35.26_lon25_rev25  0.585%   lat35.26_lon45_rev0   0.312%
 * lat0_lon0_rev0        0.491%   lat35.26_lon25_rev0   0.304%
 * lat0_lon45_rev0       0.450%   lat25_lon45_rev25     0.292%
 * lat25_lon45_rev45     0.420%   lat0_lon0_rev25       0.259%
 * lat0_lon45_rev45      0.404%
 * lat35.26_lon0_rev0    0.402%   (avg 0.610%, max 2.098%)
 * ```
 *
 * `lon`'s sign was independently isolated and COM-checked in the first
 * campaign (a positive `lon` measured a symmetric width shrink, matching
 * this module) and is unaffected by the cross-term replacement (`x` is
 * unchanged). `lat`'s sign is not independently observable from a
 * single-axis case (`cos` is even) but IS observable jointly with `lon` via
 * the cross term; the 27-point grid's fit (rather than an isolated
 * combined-case check) is itself the confirmation this module's `lat` sign
 * convention is correct across the whole grid, not just one pose. `rev`'s
 * sign was independently isolated in the first campaign (a real `rev=45deg
 * only` measurement matched this module's predicted corner-to-extreme
 * mapping for a positive `rev`) and is reused unchanged here: it is still
 * applied as a simple post-projection 2D roll, and the fit above already
 * exercises every `rev` level jointly with every `lat`/`lon` combination
 * without needing a different composition order.
 *
 * @module render/visual-3d-camera-parametric
 */

import type { Homography3 } from './visual-3d-camera-homography';
import type { Point2 } from './visual-3d-camera-homography-math';
import { unitSquareToQuadHomography } from './visual-3d-camera-homography-math';

function rotate2d(p: Point2, angle: number): Point2 {
	if (angle === 0) {
		return p;
	}
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

/** Explicit camera parameters (radians for angles, already zoom-adjusted FOV). */
export interface ParametricCameraParams {
	/** Pitch (`a:camera/a:rot/@lat`), radians. */
	latRad: number;
	/** Yaw (`a:camera/a:rot/@lon`), radians. */
	lonRad: number;
	/** Roll (`a:camera/a:rot/@rev`), radians. */
	revRad: number;
	/**
	 * Field of view, radians (zoom already folded in; see `applyZoomToFov`).
	 * UNUSED by {@link projectCorner} (see the module doc comment: the
	 * 27-point COM grid fit an orthographic model with no perspective
	 * dependency); kept so callers that already resolve a `@fov`/`@zoom`
	 * override do not need to change, and in case a future campaign finds a
	 * pose or FOV/zoom combination this one did not cover where it matters.
	 */
	fovRad: number;
}

/**
 * Project one local unit-square corner `(x, y)` (already centred, y-up)
 * through the camera.
 *
 * `x` is a pure per-axis cosine foreshortening (`x = X*cos(lon)`), COM-
 * confirmed independent of `lat` (see the module doc comment): the 27-point
 * grid's `lon=45deg` cells produced the identical `x` at both `lat=25deg`
 * and `lat=35.26deg`. `y` gets the SAME cosine scale on its own axis
 * (`Y*cos(lat)`) plus a rotation-composition cross term, `-X*sin(lat)*
 * sin(lon)`, that is exactly 0 whenever EITHER axis is 0 (so both the
 * identity and every single-axis case reproduce their already-COM-validated
 * result unchanged) and otherwise fits the 27-point grid to within ~1% on
 * average (see the module doc comment for the full per-cell table). This is
 * a purely ORTHOGRAPHIC transform (no perspective divide, no `fov`
 * dependency): a genuine pinhole projection was one of the hypotheses tested
 * against the grid and fit measurably worse than this cross term.
 */
function projectCorner(localX: number, localY: number, params: ParametricCameraParams): Point2 {
	const x = localX * Math.cos(params.lonRad);
	const y =
		localY * Math.cos(params.latRad) - localX * Math.sin(params.latRad) * Math.sin(params.lonRad);
	return rotate2d({ x, y }, params.revRad);
}

/**
 * Compute the unit-square homography (same convention as `visual-3d-camera-
 * homography`'s measured table: destination expressed as fractions of the
 * square's own side, relative to its own un-rotated top-left corner) for an
 * explicit camera pose. Reproduces the exact identity for
 * `latRad=lonRad=revRad=0` by construction (see the module doc comment).
 */
export function computeParametricCameraHomography(params: ParametricCameraParams): Homography3 {
	// Source (u,v) in [0,1]^2 -> local (x, y-up) centred at the origin: v=0
	// (top row) is local y=+0.5, matching the destination convention where
	// (0,0) is the top-left corner.
	const toLocal = (u: number, v: number): [number, number] => [u - 0.5, 0.5 - v];
	const toDest = (u: number, v: number): Point2 => {
		const [lx, ly] = toLocal(u, v);
		const projected = projectCorner(lx, ly, params);
		return { x: 0.5 + projected.x, y: 0.5 - projected.y };
	};

	return unitSquareToQuadHomography(toDest(0, 0), toDest(1, 0), toDest(0, 1), toDest(1, 1));
}

/** `1/60000`th-degree camera rotation field -> radians, or 0 when unset. */
export function sixtyThousandthsDegToRad(value: number | undefined): number {
	return value ? (value / 60000) * (Math.PI / 180) : 0;
}
