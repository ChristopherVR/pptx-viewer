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
 * 2. Each corner is projected by {@link projectCorner}: a PRIMARY per-axis
 *    orthographic cosine foreshortening (`lon` shrinks width, `lat` shrinks
 *    height), COM-validated for a single-axis rotation (see below), plus a
 *    SECONDARY genuine pinhole perspective skew that activates only for a
 *    combined (both axes nonzero) pose - see that function's own doc comment
 *    for why a naive single pinhole projection is the WRONG primary model
 *    here, unlike the preset table's own two-axis families.
 * 3. The pinhole secondary term's focal length is `f = 1/tan(fov/2)` (the
 *    same FOV <-> perspective-distance relationship `visual-3d-camera-fov`
 *    already uses), so `lat=lon=rev=0` reproduces an EXACT identity
 *    homography - the same trivial case `orthographicFront` is COM-measured
 *    to produce - by construction (the secondary term is architecturally
 *    zero whenever either axis is zero, so this holds regardless of `fov`).
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
 * ## COM validation (2026-09, real PowerPoint `Slide.Export`, 144px/in)
 *
 * Three explicit `a:camera/a:rot` cases (a required `prst="orthographicFront"`
 * plus an overriding `a:rot`, since real PowerPoint rejects a schema-invalid
 * `a:camera` with no `@prst` at all - `CT_Camera`'s `prst` attribute turned
 * out to be REQUIRED, contrary to what this codebase's own writer, which
 * merges onto an already-`@prst`-bearing parsed node, implied was optional),
 * a flat 2in square, corners extracted as the 4 extreme (min/max x/y) grey
 * pixels - reliable here since none of the 3 cases roll far enough to turn
 * the square into a diamond whose extremes are edge midpoints, the situation
 * `visual-3d-camera-homography.ts`'s own campaign had to use a full
 * convex-hull fit for:
 *
 * ```
 * case                                        corner error (px, avg of 4, on a 288px-side element)
 * lat=0 lon=0 rev=0 (sanity: == identity)              1.2
 * lat=0 lon=25deg rev=0 (single-axis yaw)              0.75
 * lat=35.26deg lon=45deg rev=45deg (combined + roll)   82 (29% relative)
 * ```
 *
 * The identity and single-axis cases are sub-pixel accurate - well within the
 * preset homography table's own ~0.7%-relative-error tolerance. The combined
 * case is NOT: at this extreme (all three angles large and simultaneous) the
 * primary cosine term plus the damped secondary skew above under-predicts the
 * real distortion by roughly 29%, i.e. this module does NOT claim COM parity
 * for a genuinely combined multi-axis override, only documents the measured
 * gap. This is the same class of difficulty `visual-3d-camera.ts`'s own doc
 * comment records for the PRESET two-axis families ("A centred `perspective`
 * alone cannot fully reproduce the two-axis presets' off-axis camera... a
 * genuine off-axis vanishing point"): PowerPoint's real camera formula for a
 * combined pose is not fully reverse-engineered here either. What IS
 * COM-established, and was previously entirely unverified (the old code used
 * a `rotateX`/`rotateY` + centred CSS `perspective()` approximation for
 * EVERY override, single-axis included): a pure single-axis `a:rot` is a
 * symmetric per-axis scale with NO keystone and NO centre shift, which the
 * old model could not represent either (it always keystones via
 * `perspective()`). `lon`'s sign was independently isolated and COM-checked
 * (a positive `lon` measured a symmetric width shrink, matching this
 * module).
 *
 * `lat`'s sign is NOT independently observable from a single-axis case:
 * `cos` is an even function, so this module's primary term produces the
 * IDENTICAL homography for `lat=+25deg` and `lat=-25deg` in isolation (no
 * `lon`) - proven analytically, and confirmed by a real `lat=25deg only`
 * COM measurement (2026-09, same 2in-square/144px-in methodology) matching
 * this module's prediction to within 1px on every one of the 4 measured
 * corners (predicted top/bottom edge at y=56.7/317.7 vs measured 56/317,
 * width unchanged both sides). Sign only becomes observable jointly with
 * `lon` (the secondary term), which the combined case below already
 * exercises; a single-axis case genuinely cannot add information here.
 *
 * `rev`'s sign WAS independently isolated: a real `rev=45deg only` COM
 * measurement (lat=lon=0) produced a diamond-oriented square whose 4 extreme
 * points matched this module's predicted corner-to-extreme mapping (which
 * original corner becomes the new top/right/bottom/left vertex) for a
 * POSITIVE `rev`, each within about 10 degrees of angle from the shape's own
 * centre (a small, consistent systematic offset in the SAME rotational
 * sense across all 4 points, not a sign flip) - this module's `rev` sign
 * convention is therefore COM-confirmed, not merely architecturally
 * plausible.
 *
 * A second, independent combined-case measurement (a fresh fixture, same
 * lat=35.26/lon=45/rev=45 angles) reproduced the same ~25-29% relative
 * corner error as the original campaign above (70.8px average this time, vs
 * 82px originally, both on a 288px element) - confirming the combined-case
 * residual is a real, repeatable limitation of this module's secondary term,
 * not measurement noise from a single run. The fixture/export/pixel-sampling
 * scripts used for all of this measurement were scratch, one-off tooling
 * (not committed - see the task report for the methodology if reproducing).
 *
 * @module render/visual-3d-camera-parametric
 */

import type { Homography3 } from './visual-3d-camera-homography';
import type { Point2 } from './visual-3d-camera-homography-math';
import { unitSquareToQuadHomography } from './visual-3d-camera-homography-math';

/** A 3D vector/point. */
interface Vec3 {
	x: number;
	y: number;
	z: number;
}

function rotateX(v: Vec3, angle: number): Vec3 {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
}

function rotateY(v: Vec3, angle: number): Vec3 {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
}

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
	/** Field of view, radians (zoom already folded in; see `applyZoomToFov`). */
	fovRad: number;
}

/**
 * Project one local unit-square corner `(x, y)` (already centred, y-up)
 * through the camera.
 *
 * The PRIMARY term is an orthographic per-axis cosine foreshortening
 * (`x *= cos(lon)`, `y *= cos(lat)`), not a full pinhole perspective divide:
 * COM measurement (see the module doc comment) found a pure single-axis
 * `a:rot` produces a symmetric scale with NO keystone and NO centre shift at
 * all - matching this term to within ~1% - whereas a naive pinhole
 * projection (translate the camera sideways, re-aim, divide by depth)
 * predicts both a shift and a slant that COM does not show. This mirrors
 * `visual-3d-camera-homography.ts`'s own finding #2 for the equivalent
 * single-axis PRESET family (`perspectiveLeft`/`Right`/`Above`/`Below`):
 * "a pure anisotropic scale + small offset", not a keystone.
 *
 * A SECONDARY genuine perspective skew (a real off-axis vanishing point, the
 * pinhole formula's deviation from the cosine term) is blended in only when
 * BOTH `lat` and `lon` are nonzero at once (weighted by `sin(lat)*sin(lon)`,
 * which is exactly 0 for any single-axis rotation, so that COM-validated
 * case is reproduced UNCHANGED). This mirrors the preset table's own
 * two-axis families (`*Facing`/`Contrasting*`/`Heroic*`) genuinely needing a
 * skew a pure scale cannot represent. `fov` modulates this secondary term's
 * strength (a wider FOV -> a nearer, more exaggerated camera -> more
 * foreshortening), the only place `@fov`/`@zoom` affect this model: no COM
 * data varies FOV independently for an override, so treat this coupling as
 * physically-motivated but NOT independently calibrated, unlike the
 * COM-validated primary term.
 */
function projectCorner(localX: number, localY: number, params: ParametricCameraParams): Point2 {
	const scaleX = Math.cos(params.lonRad);
	const scaleY = Math.cos(params.latRad);
	let x = localX * scaleX;
	let y = localY * scaleY;

	const twoAxisWeight = Math.sin(params.latRad) * Math.sin(params.lonRad);
	if (twoAxisWeight !== 0) {
		const f = 1 / Math.tan(params.fovRad / 2);
		const local: Vec3 = { x: localX, y: localY, z: 0 };
		// R^T * P, where R = Ry(lon) . Rx(lat): apply Ry(-lon) then Rx(-lat).
		const viewNoTranslate = rotateX(rotateY(local, -params.lonRad), -params.latRad);
		const viewZ = viewNoTranslate.z - f;
		// Guard a degenerate camera-through-the-plane case (should not occur
		// for any realistic lat/lon): skip the secondary term rather than
		// divide by ~0.
		if (Math.abs(viewZ) > 1e-6) {
			const pinholeX = (f * viewNoTranslate.x) / -viewZ;
			const pinholeY = (f * viewNoTranslate.y) / -viewZ;
			x += (pinholeX - localX * scaleX) * Math.abs(twoAxisWeight);
			y += (pinholeY - localY * scaleY) * Math.abs(twoAxisWeight);
		}
	}

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
