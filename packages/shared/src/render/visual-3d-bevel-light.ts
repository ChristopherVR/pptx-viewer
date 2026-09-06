/**
 * `a:lightRig/@dir` -> top-bevel highlight/shadow direction (framework-agnostic).
 *
 * COM-measured 2026-09 (real PowerPoint, `Slide.Export`, a mid-grey 2in
 * square with a wide `a:bevelT` circle profile, `Depth = 0`): sampling
 * brightness at the top/right/bottom/left edge bands under each of the 8
 * `a:lightRig/@dir` values shows the highlight snaps to exactly ONE of the 4
 * cardinal edges, never a blend of two:
 *
 * ```
 * dir   top right bottom left  (brightness, mid-grey centre = 138)
 * t     163   92    105   120
 * tr    163  113     90   100  <- same dominant edge (top) as `t`
 * r     121  159     97   105
 * br    101  159    117    91  <- same dominant edge (right) as `r`
 * b     113  120    165    93
 * bl     96   99    165   114  <- same dominant edge (bottom) as `b`
 * l      95  106    124   160
 * tl    115   90    103   160  <- same dominant edge (left) as `l`
 * ```
 *
 * Each diagonal (`tr`/`br`/`bl`/`tl`) reproduces the SAME dominant edge as
 * the cardinal direction it follows going clockwise (`t`->`tr`, `r`->`br`,
 * `b`->`bl`, `l`->`tl`), i.e. the dominant edge is the compass direction at
 * `floor(angle / 90) * 90`, not a diagonal blend the way the pre-existing
 * (direction-blind) implementation's hardcoded top-left diagonal highlight
 * implied.
 *
 * A second, larger campaign (2026-09) re-ran this exact brightness scan for
 * ALL 12 `a:bevelT/@prst` profiles (`relaxedInset`, `circle`, `slope`,
 * `cross`, `angle`, `softRound`, `convex`, `coolSlant`, `divot`, `riblet`,
 * `hardEdge`, `artDeco`) x all 8 directions at a wide (24pt) depth, plus a
 * 6pt-vs-24pt depth check for 3 representative profiles:
 *
 * - 9 of the 12 profiles (every one above except `softRound`, `slope` and
 *   `hardEdge`) reproduced the exact same cardinal-snap pattern as `circle`,
 *   confirming {@link getBevelHighlightDirection}'s direction mapping
 *   generalises across profile SHAPE, not just `circle`.
 * - `softRound` measured the OPPOSITE cardinal edge as its highlight for
 *   every one of the 8 directions (e.g. `dir="t"` lit up the BOTTOM edge,
 *   not the top): {@link isBevelProfileInverted} flags this so
 *   `visual-3d.ts`'s `getBevelShadow` negates the resolved vector for this
 *   one profile. Physically plausible: a "soft round" transition can read as
 *   a rounded INSET (a shallow groove catching shadow from the light side)
 *   rather than `circle`'s rounded OUTSET (a dome catching highlight),
 *   inverting which edge faces the light.
 * - `slope` and `hardEdge` measured UNIFORM brightness (no directional signal
 *   at all) at the same 0.15in-from-edge sample point every other profile
 *   used, and a follow-up fine-grained radial scan (offsets from 0.01in to
 *   0.3in) found only a universal, direction-INDEPENDENT darkening right at
 *   the crisp fold (both the "highlight" and "opposite" edges darkened by a
 *   similar amount within the first ~0.05in for BOTH profiles), consistent
 *   with a real single-flat-facet self-shadowed seam rather than a smooth
 *   directional gradient. No sampling depth tested recovered a clean
 *   cardinal-snap signal for these two, so their direction handling is left
 *   unverified/inconclusive rather than encoding a guess from noisy data;
 *   they still render with the shared cardinal-snap direction (a reasonable
 *   approximation, just not independently confirmed the way the other 10
 *   profiles now are).
 * - The highlight/shadow band's on-screen WIDTH scales with the bevel's
 *   actual size (confirmed for `circle`, `angle` and `softRound` at 6pt vs.
 *   24pt: the 6pt bevel's directional signal collapsed to background within
 *   ~0.1in of the edge, the 24pt bevel's extended to ~0.3in, roughly
 *   matching the 4x depth ratio). This was already the existing behaviour
 *   (`visual-3d.ts`'s `getBevelShadow` derives its inset-shadow offsets from
 *   the shape's ACTUAL `bevelTopWidth`/`Height` in px, not a fixed
 *   constant), so no code change was needed for this finding; it is now
 *   COM-confirmed rather than assumed.
 *
 * @module render/visual-3d-bevel-light
 */

/** Compass angle (degrees, clockwise from `t` = 0) for each `a:lightRig/@dir` token. */
const DIRECTION_ANGLE: Record<string, number> = {
	t: 0,
	tr: 45,
	r: 90,
	br: 135,
	b: 180,
	bl: 225,
	l: 270,
	tl: 315,
};

/** A highlight direction as a unit-ish (dx, dy) vector in CSS inset-shadow offset space. */
export interface BevelLightVector {
	dx: number;
	dy: number;
}

/** The 4 cardinal highlight directions, keyed by the `floor(angle / 90) * 90` bucket. */
const CARDINAL_VECTORS: Record<number, BevelLightVector> = {
	0: { dx: 0, dy: -1 }, // t
	90: { dx: 1, dy: 0 }, // r
	180: { dx: 0, dy: 1 }, // b
	270: { dx: -1, dy: 0 }, // l
};

/**
 * Resolve the TOP bevel's highlight direction from `a:lightRig/@dir`.
 * Falls back to the pre-existing top-left diagonal default when the
 * direction is missing/unrecognised, so an authored deck with no light rig
 * (or an unmapped direction) keeps rendering exactly as before this module
 * existed.
 */
export function getBevelHighlightDirection(
	lightRigDirection: string | undefined,
): BevelLightVector {
	if (!lightRigDirection) {
		return { dx: -1, dy: -1 };
	}
	const angle = DIRECTION_ANGLE[lightRigDirection];
	if (angle === undefined) {
		return { dx: -1, dy: -1 };
	}
	const bucket = Math.floor(angle / 90) * 90;
	return CARDINAL_VECTORS[bucket] ?? { dx: -1, dy: -1 };
}

/**
 * Whether a `a:bevelT/@prst` profile measured an INVERTED highlight/shadow
 * relative to the shared cardinal-snap direction (see the module doc
 * comment): true only for `softRound`, which lit up the edge OPPOSITE the
 * light-rig direction in every one of the 8 directions tested.
 */
export function isBevelProfileInverted(bevelType: string): boolean {
	return bevelType === 'softRound';
}
