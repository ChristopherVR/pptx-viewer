/**
 * COM-measured exact off-axis camera homographies (framework-agnostic).
 *
 * `visual-3d-camera`'s `rotateX`/`rotateY` + centred `perspective()` model
 * cannot reproduce a genuine off-axis vanishing point (see that module's doc
 * comment): a real camera translated to the side while re-aimed at the shape
 * projects a flat plane through a full 2D projective transform (an 8-DOF
 * homography), not a 3-axis Euler rotation viewed through a centred lens.
 *
 * Ground-truthed 2026-09 via real PowerPoint COM (`Slide.Export`, 96dpi): a
 * flat (`Depth = 0`, no `a:sp3d`) 2in square was rendered under every
 * `perspective*`, `isometric*`, `oblique*`, `legacyOblique*`,
 * `legacyPerspective*` and `orthographicFront` preset; the rendered
 * quadrilateral's 4 corners were extracted via a convex-hull fit over each
 * scanline's boundary pixels (robust to any rotation/roll, unlike a fixed
 * "top-left is the min x+y pixel" assumption, which breaks under a Z roll -
 * `isometricTopUp`'s 45 degree roll turns the square into an on-screen
 * diamond, where the min-(x+y) pixel is an EDGE MIDPOINT, not a vertex).
 *
 * Two unexpected, load-bearing findings came out of that measurement:
 *
 * 1. **`oblique*`/`legacyOblique*`/`legacyPerspective*` do not rotate the
 *    front face at all.** A flat shape (no extrusion) rendered pixel-identical
 *    to `orthographicFront` under every preset in these three families, and a
 *    2nd COM check with a real 36pt extrusion showed the same: the front face
 *    stayed a perfect undistorted square while only the EXTRUDED SIDE PANELS
 *    picked up an oblique/perspective skew. These are legacy WordArt-era
 *    "extrusion direction" cameras, not shape-rotating ones. The previous
 *    `CAMERA_PRESET_MAP` entries (non-zero `rotateX`/`rotateY` +
 *    `perspectiveRefPx`) were simply wrong for the flat-shape case; this
 *    module's identity entries for those 27 presets fix that.
 * 2. **The single-axis `perspective*` family (`Left`/`Right`/`Above`/`Below`)
 *    is NOT a keystone/trapezoid.** The measured quad's opposite edges stayed
 *    parallel (a pure anisotropic scale + small offset), unlike the two-axis
 *    `*Facing`/`Contrasting*`/`Heroic*` presets, which are genuine skewed
 *    quadrilaterals. A rotateX/rotateY model always keystones; only a real
 *    homography can represent "scale, no skew" for one family and "skew" for
 *    another from the same primitive.
 *
 * Each entry is a **unit-square homography**: the 3x3 matrix (row-major, 9
 * numbers, `h33` normalised to 1) that maps the unit square's corners
 * `(0,0) (1,0) (0,1) (1,1)` to their measured destinations, ALSO expressed as
 * fractions of the same square's side, relative to the square's own
 * (un-rotated) top-left corner. This is size-invariant by construction
 * (verified against a 2nd extruded-shape measurement at a different
 * effective size for `perspectiveLeft`, matching within measurement noise);
 * {@link homographyToMatrix3d} re-scales it to an element's actual
 * width/height at render time.
 *
 * Identity entries (front face measured undistorted) are covered by
 * {@link IDENTITY_HOMOGRAPHY_PRESETS} rather than 27 duplicated `[1,0,0,0,1,
 * 0,0,0,1]` table rows.
 *
 * @module render/visual-3d-camera-homography
 */

/** A row-major 3x3 homography, `h33` normalised to 1: `[h11,h12,h13,h21,h22,h23,h31,h32,h33]`. */
export type Homography3 = readonly [
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
];

const IDENTITY_H: Homography3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/**
 * Presets COM-measured to leave a flat shape's front face completely
 * undistorted: `orthographicFront` (trivially, a control), and the
 * `oblique*`/`legacyOblique*`/`legacyPerspective*` families (only the
 * extrusion's side panels are affected by these; see the module doc comment).
 */
export const IDENTITY_HOMOGRAPHY_PRESETS: ReadonlySet<string> = new Set([
	'orthographicFront',
	'obliqueTopLeft',
	'obliqueTop',
	'obliqueTopRight',
	'obliqueLeft',
	'obliqueRight',
	'obliqueBottomLeft',
	'obliqueBottom',
	'obliqueBottomRight',
	'legacyObliqueTopLeft',
	'legacyObliqueTop',
	'legacyObliqueTopRight',
	'legacyObliqueLeft',
	'legacyObliqueFront',
	'legacyObliqueRight',
	'legacyObliqueBottomLeft',
	'legacyObliqueBottom',
	'legacyObliqueBottomRight',
	'legacyPerspectiveTopLeft',
	'legacyPerspectiveTop',
	'legacyPerspectiveTopRight',
	'legacyPerspectiveLeft',
	'legacyPerspectiveFront',
	'legacyPerspectiveRight',
	'legacyPerspectiveBottomLeft',
	'legacyPerspectiveBottom',
	'legacyPerspectiveBottomRight',
]);

/** COM-measured unit-square homographies for the `perspective*` and `isometric*` families. */
export const CAMERA_HOMOGRAPHY_MAP: Record<string, Homography3> = {
	perspectiveFront: [0.994792, 0, 0, 0, 0.994792, 0, 0, 0, 1],
	perspectiveLeft: [0.892334, 0, 0.041667, -0.020406, 0.973958, 0.010417, -0.041026, 0, 1],
	perspectiveRight: [0.973067, 0, 0.020833, 0.021279, 1.015625, -0.010417, 0.042781, 0, 1],
	perspectiveAbove: [0.973958, -0.020406, 0.010417, 0, 0.892334, 0.041667, 0, -0.041026, 1],
	perspectiveBelow: [1.015625, 0.021279, -0.010417, 0, 0.973067, 0.020833, 0, 0.042781, 1],
	perspectiveAboveLeftFacing: [
		0.869627, -0.21598, 0.182292, 0.468594, 0.771501, -0.114583, -0.028998, 0.07802, 1,
	],
	perspectiveAboveRightFacing: [
		0.894712, 0.297239, -0.083333, -0.463383, 0.824633, 0.348958, -0.00138, 0.109998, 1,
	],
	perspectiveContrastingLeftFacing: [
		0.647947, -0.046552, 0.182292, 0.115554, 0.939599, -0.057292, -0.067802, 0.002385, 1,
	],
	perspectiveContrastingRightFacing: [
		0.79386, 0.081257, 0.098958, -0.125455, 1.078861, 0.0625, 0.098853, 0.048523, 1,
	],
	perspectiveHeroicLeftFacing: [
		0.889139, 0.029147, 0.010417, -0.102887, 0.911493, 0.067708, -0.035113, -0.050472, 1,
	],
	perspectiveHeroicRightFacing: [
		0.954715, -0.051639, 0.03125, 0.073026, 0.943092, -0.005208, 0.001615, -0.021339, 1,
	],
	perspectiveHeroicExtremeLeftFacing: [
		0.677858, -0.031224, 0.135417, 0.039521, 0.916892, -0.026042, -0.137299, 0.000253, 1,
	],
	perspectiveHeroicExtremeRightFacing: [
		0.944779, 0.042286, 0.046875, -0.045675, 1.070036, 0.015625, 0.153925, 0.00699, 1,
	],
	perspectiveRelaxed: [0.947917, -0.049622, 0.026042, 0, 0.551928, 0.197917, 0, -0.094527, 1],
	perspectiveRelaxedModerately: [
		0.963542, -0.034993, 0.015625, 0, 0.752853, 0.104167, 0, -0.070352, 1,
	],
	isometricLeftDown: [0.703125, 0, 0.145833, 0.40625, 0.817708, -0.114583, 0, 0, 1],
	isometricRightUp: [0.703125, 0, 0.145833, -0.40625, 0.817708, 0.291667, 0, 0, 1],
	isometricLeftUp: [0.703125, 0, 0.145833, -0.40625, 0.817708, 0.291667, 0, 0, 1],
	isometricRightDown: [0.703125, 0, 0.145833, 0.40625, 0.817708, -0.114583, 0, 0, 1],
	isometricTopUp: [0.703125, -0.697917, 0.494792, 0.40625, 0.401042, 0.09375, 0, 0, 1],
	isometricTopDown: [0.703125, -0.697917, 0.494792, 0.40625, 0.401042, 0.09375, 0, 0, 1],
	isometricBottomUp: [0.703125, -0.697917, 0.494792, 0.40625, 0.401042, 0.09375, 0, 0, 1],
	isometricBottomDown: [0.703125, -0.697917, 0.494792, 0.40625, 0.401042, 0.09375, 0, 0, 1],
	isometricOffAxis1Left: [0.442708, 0, 0.276042, 0.276042, 0.947917, -0.114583, 0, 0, 1],
	isometricOffAxis1Right: [0.901042, 0, 0.046875, -0.135417, 0.953125, 0.088542, 0, 0, 1],
	isometricOffAxis1Top: [
		0.90095, 0.45194, -0.166667, -0.13337, 0.2861, 0.427083, 0.007018, 0.014305, 1,
	],
	isometricOffAxis2Left: [0.901042, 0, 0.046875, 0.135417, 0.953125, -0.046875, 0, 0, 1],
	isometricOffAxis2Right: [0.442708, 0, 0.276042, -0.276042, 0.947917, 0.161458, 0, 0, 1],
	isometricOffAxis2Top: [
		0.893304, -0.436716, 0.270833, 0.136402, 0.273373, 0.291667, 0.002306, -0.004701, 1,
	],
	isometricOffAxis3Left: [0.442708, 0, 0.276042, -0.276042, 0.947917, 0.161458, 0, 0, 1],
	isometricOffAxis3Right: [0.901042, 0, 0.046875, 0.135417, 0.953125, -0.046875, 0, 0, 1],
	isometricOffAxis3Bottom: [
		0.893304, -0.436716, 0.270833, 0.136402, 0.273373, 0.291667, 0.002306, -0.004701, 1,
	],
	isometricOffAxis4Left: [0.901042, 0, 0.046875, -0.135417, 0.953125, 0.088542, 0, 0, 1],
	isometricOffAxis4Right: [0.442708, 0, 0.276042, 0.276042, 0.947917, -0.114583, 0, 0, 1],
	isometricOffAxis4Bottom: [
		0.90095, 0.45194, -0.166667, -0.13337, 0.2861, 0.427083, 0.007018, 0.014305, 1,
	],
};

/**
 * Look up the COM-measured unit-square homography for a camera preset, or
 * `undefined` when there is no ground truth for it (an unrecognised/future
 * preset name; the caller should fall back to the legacy `rotateX`/`rotateY`
 * model in that case).
 */
export function getCameraHomography(preset: string | undefined): Homography3 | undefined {
	if (!preset) {
		return undefined;
	}
	if (IDENTITY_HOMOGRAPHY_PRESETS.has(preset)) {
		return IDENTITY_H;
	}
	return CAMERA_HOMOGRAPHY_MAP[preset];
}

/**
 * Whether a homography (from {@link getCameraHomography}) is the identity:
 * callers use this to skip emitting a no-op `matrix3d(...)` entirely (no
 * `transform` at all, matching the pre-homography "flat, no camera effect"
 * shape exactly) rather than a functionally-equivalent but needlessly present
 * identity matrix.
 */
export function isIdentityHomography(h: Homography3): boolean {
	return h === IDENTITY_H;
}

/**
 * Re-scale a unit-square homography to an element's actual on-screen
 * width/height and embed it as a CSS `matrix3d(...)` string.
 *
 * The homography is stored normalised to the unit square on BOTH the source
 * and destination sides (COM-verified size-invariant, see the module doc
 * comment); for an element of size (W, H) the general (possibly
 * non-square) rescale is `H' = diag(W,H,1) . H_unit . diag(1/W,1/H,1)`,
 * applied entry-wise below rather than via matrix multiplication.
 *
 * The 3x3 -> CSS 4x4 embedding (z-row/column identity, everything else zero)
 * reproduces the exact 2D projective divide on the element's z=0 plane:
 * `matrix3d(h11,h21,0,h31, h12,h22,0,h32, 0,0,1,0, h13,h23,0,h33)`. Must be
 * paired with `transform-origin: 0 0` (the homography already encodes
 * whatever translation the measured camera produces relative to the
 * element's own un-rotated top-left; a non-zero transform-origin would
 * double-apply it).
 */
export function homographyToMatrix3d(hUnit: Homography3, width: number, height: number): string {
	const w = width || 1;
	const h = height || 1;
	const [h11, h12, h13, h21, h22, h23, h31, h32, h33] = hUnit;

	const a11 = h11;
	const a12 = h12 * (w / h);
	const a13 = h13 * w;
	const a21 = h21 * (h / w);
	const a22 = h22;
	const a23 = h23 * h;
	const a31 = h31 / w;
	const a32 = h32 / h;
	const a33 = h33;

	const m = [a11, a21, 0, a31, a12, a22, 0, a32, 0, 0, 1, 0, a13, a23, 0, a33];
	return `matrix3d(${m.map((n) => Number(n.toFixed(6))).join(', ')})`;
}
