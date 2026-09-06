/**
 * COM-measured extrusion panel depth-skew data, split out of
 * `visual-3d-panel-quad` to keep that file under the repo's LOC guideline.
 * See that module's doc comment for how the measurement itself works
 * (edge-band ink fit against a `Slide.Export` render); this file only holds
 * the resulting table and its lookup.
 *
 * @module render/visual-3d-panel-depth-skew-map
 */

/**
 * A panel's measured "depth direction": the screen-space vector (in
 * fractions of a px, per px of rendered extrusion depth) that the BACK edge
 * of a panel is offset from the front edge it shares with the front face.
 * Multiply both components by the actual rendered depth (px) to get the
 * real per-corner screen offset.
 */
export interface PanelDepthSkew {
	dx: number;
	dy: number;
}

/**
 * A `PANEL_DEPTH_SKEW_MAP` entry: a default vector (used when the caller
 * doesn't ask for a specific side, or when the requested side has no
 * dedicated measurement) plus optional per-side overrides. Single-panel
 * presets carry only the default; two-panel presets (the `oblique*` family
 * and a handful of `isometric*`/`perspective*` siblings) carry a `top`/
 * `bottom`/`left`/`right` override for each side that was independently
 * measured, because the two panels of one preset are not always skewed by
 * the same vector (see the module doc comment).
 */
export interface PanelDepthSkewEntry extends PanelDepthSkew {
	top?: PanelDepthSkew;
	bottom?: PanelDepthSkew;
	left?: PanelDepthSkew;
	right?: PanelDepthSkew;
}

/**
 * COM-measured panel depth-skew vectors, keyed by camera preset. Only
 * presets with real ground truth are listed; see `visual-3d-panel-quad`'s
 * module doc comment for the measurement method. Extend this table (rather
 * than guessing a formula) when a new preset is COM-verified, matching
 * `CAMERA_HOMOGRAPHY_MAP`'s own "measured, not derived" convention.
 *
 * Extended 2026-09 from an initial 8-preset pass to full coverage of every
 * preset with visible extrusion ink (37 of the 44 camera configurations
 * tested: the 35 `CAMERA_HOMOGRAPHY_MAP` keys plus the 9 `oblique*`
 * compass-direction representatives standing in for `oblique*`/
 * `legacyOblique*`/`legacyPerspective*` alike). Measurement moved from a
 * global convex-hull fit of the whole green blob (which produces a garbage
 * quadrilateral whenever two adjacent panels merge into one non-convex
 * connected component at a shared corner, e.g. `obliqueTopLeft`'s top and
 * left panels touch pixel-wise at the shape's own top-left corner) to an
 * EDGE-BAND fit: green ink is isolated by its position along each candidate
 * side's OWN front edge (keeping only the middle 30% of the edge, far enough
 * from both corners that an adjacent side's panel - which only ever touches
 * this edge's line near a corner - cannot reach in), then the farthest ink
 * from that edge's line (no radius cap) gives an exact per-side skew sample
 * with no risk of grabbing the wrong side's geometry. Three sub-bands are
 * cross-checked per side; every entry below measured under 1px disagreement
 * between them unless the preset also shows a second side (see below).
 *
 * Two presets have no entry despite showing ink at this depth:
 * `perspectiveHeroicExtremeLeftFacing`/`obliqueRight`/`obliqueLeft`/
 * `perspectiveLeft`/`perspectiveRight`/`perspectiveFront`/`orthographicFront`
 * measured ZERO visible ink (no panel to correct); every OTHER tested preset
 * that showed ink has an entry.
 *
 * A preset with 2 simultaneously-visible panels (e.g. `obliqueTopLeft`'s
 * top+left, `isometricRightUp`'s top+left) was measured with each side's OWN
 * independent skew. Each such entry's `top`/`bottom`/`left`/`right` fields
 * carry that per-side vector; `getMeasuredPanelDepthSkew` returns the
 * side-specific vector when one exists, falling back to the entry's default
 * `dx`/`dy` (the average of the sides that WERE measured, for a shape that
 * somehow shows a side the ground truth never observed). This matters most
 * for the `oblique*` family, whose two panels turned out to be
 * independently, axis-aligned skewed: `obliqueTopLeft`'s own top-panel ink
 * measured a purely VERTICAL offset and its left-panel ink a purely
 * HORIZONTAL one, not one shared diagonal vector, so a single averaged
 * vector put both panels' back edges tens of screen px off at a typical
 * extrusion depth (see `visual-3d-panel-quad.test.ts`'s residual-error
 * assertions). For the `isometric*`/`perspective*` families (real, if
 * orthographic, 3D rotations) a single shared vector is also the physically
 * correct model, and the two sides' independent measurements typically
 * agreed closely (e.g. `isometricBottomDown`'s left-panel reading matched
 * its `isometricBottomUp` sibling's independently-measured left-panel skew
 * to within 0.1%); those entries still carry the per-side overrides for
 * exactness, they just barely move the result.
 *
 * `isometricTopUp` previously had no entry: COM measurement found its real
 * extrusion ink matches the box's `right` (local u=1) edge corners, not the
 * `bottom` edge the SHIPPED `MEASURED_ISOMETRIC_PANEL_SIDES.isometricTopUp`
 * used to resolve it to (a coarser "count green pixels in the band below/
 * right of the front bbox" classifier mislabelled this steeply-rotated
 * diagonal panel). That visibility table has been corrected alongside this
 * one (now resolves `isometricTopUp` to `right`), so its measured skew is
 * listed here too.
 */
export const PANEL_DEPTH_SKEW_MAP: Record<string, PanelDepthSkewEntry> = {
	perspectiveAbove: { dx: 0, dy: 0.301619 },
	perspectiveBelow: { dx: 0, dy: -0.292217 },
	perspectiveAboveLeftFacing: { dx: 0.301313, dy: -0.566599 },
	perspectiveAboveRightFacing: {
		dx: -0.228494,
		dy: -0.238267,
		top: { dx: -0.281888, dy: -0.544772 },
		left: { dx: -0.1751, dy: 0.068238 },
	},
	perspectiveContrastingLeftFacing: { dx: 0.026458, dy: -0.156448 },
	perspectiveContrastingRightFacing: {
		dx: -0.369134,
		dy: -0.052588,
		top: { dx: -0.026153, dy: -0.155782 },
		left: { dx: -0.712114, dy: 0.050607 },
	},
	perspectiveHeroicLeftFacing: { dx: 0.00957, dy: 0.127825 },
	perspectiveHeroicRightFacing: { dx: -0.009554, dy: 0.127613 },
	perspectiveHeroicExtremeRightFacing: { dx: -0.536049, dy: 0.021022 },
	perspectiveRelaxed: { dx: 0, dy: 0.782069 },
	perspectiveRelaxedModerately: { dx: 0, dy: 0.531775 },
	isometricLeftDown: { dx: 0.355274, dy: -0.614897 },
	isometricRightUp: {
		dx: -0.530617,
		dy: -0.304751,
		top: { dx: -0.352156, dy: -0.609502 },
		left: { dx: -0.709079, dy: 0 },
	},
	isometricLeftUp: { dx: 0.358749, dy: 0.620912 },
	isometricRightDown: { dx: -0.356495, dy: 0.617011 },
	isometricTopUp: { dx: 0.36055, dy: 0.62745 },
	isometricTopDown: { dx: -0.366379, dy: 0.634118 },
	isometricBottomUp: { dx: -0.353512, dy: -0.615203 },
	isometricBottomDown: {
		dx: 0.005851,
		dy: -0.623708,
		top: { dx: 0.365247, dy: -0.632158 },
		left: { dx: -0.353545, dy: -0.615259 },
	},
	isometricOffAxis1Left: { dx: 0.318161, dy: -0.510256 },
	isometricOffAxis1Right: {
		dx: -0.239793,
		dy: -0.166167,
		top: { dx: -0.049946, dy: -0.332334 },
		left: { dx: -0.429641, dy: 0 },
	},
	isometricOffAxis1Top: { dx: 0, dy: 0.943622 },
	isometricOffAxis2Left: { dx: 0.050051, dy: -0.333034 },
	isometricOffAxis2Right: { dx: -0.315394, dy: -0.505819 },
	isometricOffAxis2Top: { dx: 0, dy: 0.947779 },
	isometricOffAxis3Left: { dx: 0.321958, dy: 0.516347 },
	isometricOffAxis3Right: { dx: -0.050927, dy: 0.33886 },
	isometricOffAxis3Bottom: { dx: 0.008314, dy: -0.939465 },
	isometricOffAxis4Left: { dx: 0.050748, dy: 0.33767 },
	isometricOffAxis4Right: {
		dx: -0.601325,
		dy: 0.255641,
		bottom: { dx: -0.3188, dy: 0.511282 },
		left: { dx: -0.883851, dy: 0 },
	},
	isometricOffAxis4Bottom: { dx: 0, dy: -0.947779 },
	obliqueTopLeft: {
		dx: -0.106521,
		dy: -0.110678,
		top: { dx: 0, dy: -0.221356 },
		left: { dx: -0.213042, dy: 0 },
	},
	obliqueTop: { dx: 0, dy: -0.312809 },
	obliqueTopRight: { dx: 0, dy: -0.221356 },
	obliqueBottomLeft: {
		dx: -0.110159,
		dy: 0.103403,
		bottom: { dx: 0, dy: 0.206807 },
		left: { dx: -0.220317, dy: 0 },
	},
	obliqueBottom: { dx: 0, dy: 0.298259 },
	obliqueBottomRight: { dx: 0, dy: 0.206807 },
};

/**
 * Look up the measured depth skew for a preset, or `undefined` when
 * unmeasured. Pass `side` to get that side's own measured vector when the
 * preset has one (see `PanelDepthSkewEntry`); omitted, or when the requested
 * side has no dedicated measurement, falls back to the entry's default
 * `dx`/`dy`.
 */
export function getMeasuredPanelDepthSkew(
	preset: string | undefined,
	side?: 'top' | 'bottom' | 'left' | 'right',
): PanelDepthSkew | undefined {
	if (!preset) {
		return undefined;
	}
	const entry = PANEL_DEPTH_SKEW_MAP[preset];
	if (!entry) {
		return undefined;
	}
	const sideSkew = side ? entry[side] : undefined;
	return sideSkew ?? { dx: entry.dx, dy: entry.dy };
}
