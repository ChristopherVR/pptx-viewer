/**
 * Extruded-box panel-side visibility for the `perspective*` camera family,
 * split out of `visual-3d-panel-sides.ts` to keep that file under the repo's
 * LOC guideline.
 *
 * @module render/visual-3d-panel-sides-perspective
 */

import type { Homography3 } from './visual-3d-camera-homography';
import type { PanelVisibility } from './visual-3d-panel-sides';

const NO_PANELS: PanelVisibility = {
	showTop: false,
	showBottom: false,
	showLeft: false,
	showRight: false,
};

/**
 * Homography-derived GUESS at extruded-box panel visibility for the
 * `perspective*` family: the visible panel is assumed to be the side whose
 * outward normal faces the camera, read off the homography's own
 * perspective/skew terms. `h31`/`h32` (the homography's perspective terms)
 * are the PRIMARY signal; `h21`/`h12` (the skew terms) are a SECONDARY
 * tie-break for near-zero `h31`/`h32` cases.
 *
 * SUPERSEDED for every currently-known `perspective*` preset by
 * {@link MEASURED_PERSPECTIVE_PANEL_SIDES}: a full COM re-measurement
 * (2026-09, all 15 presets, edge-band ink analysis; see that table's doc
 * comment) found this formula wrong for 7 of the 15 - it reliably OVER-
 * predicts an extra side for every `*LeftFacing` preset and both plain
 * single-axis `perspectiveLeft`/`perspectiveRight` (predicts a horizontal
 * panel that never renders, matching neither `perspectiveAbove` nor
 * `perspectiveBelow`'s own vertical analogue, which DO render). This
 * function is kept only as the last-resort fallback in
 * `resolvePanelSides` for a hypothetical future `perspective*` preset with no
 * measured entry yet; every preset that exists today is measured.
 *
 * Convention: a positive `h31`/`xTerm` means the LEFT edge is the one
 * foreshortening less (nearer the camera) so the box's left panel is
 * revealed; positive `h32`/`yTerm` reveals the TOP panel. Both axes share
 * the same sign convention (matches `perspectiveAbove`/`perspectiveBelow`
 * being the exact transpose of `perspectiveLeft`/`perspectiveRight`).
 */
export function panelSidesFromHomography(h: Homography3): PanelVisibility {
	const [, h12, , h21, , , h31, h32] = h;
	const EPS = 0.001;
	const TIEBREAK = 0.01;
	const xTerm = h31 - TIEBREAK * h21;
	const yTerm = h32 - TIEBREAK * h12;
	return {
		showLeft: xTerm > EPS,
		showRight: xTerm < -EPS,
		showTop: yTerm > EPS,
		showBottom: yTerm < -EPS,
	};
}

/**
 * COM-measured panel sides for the WHOLE `perspective*` family (15 presets),
 * replacing {@link panelSidesFromHomography}'s formula for every preset that
 * exists today (that function is kept only as a fallback for a hypothetical
 * future preset with no entry here yet). Ground-truthed 2026-09 (COM
 * `Slide.Export`, a 2in square extruded 36pt, front/extrusion faces in
 * distinct colours, edge-band ink analysis, all 15 presets in one pass; see
 * `visual-3d-panel-sides.ts`'s `MEASURED_ISOMETRIC_PANEL_SIDES` doc comment
 * for the method).
 *
 * This table replaces an earlier 2-entry `PERSPECTIVE_MEASURED_EXCEPTIONS`
 * hack (`HeroicExtremeLeftFacing`/`RightFacing` only): re-measurement found
 * {@link panelSidesFromHomography} wrong for 5 MORE presets beyond those 2,
 * so "measure the family that mostly works, except 2 hand-found exceptions"
 * was no longer an honest description of the data. 7 of the 15 disagree with
 * the formula:
 *
 * - `perspectiveLeft` and `perspectiveRight` (the plain single-axis pair)
 *   both measure NO visible panel at all, unlike their vertical analogues
 *   `perspectiveAbove`/`perspectiveBelow`, which DO show one: the formula's
 *   `h31`/`xTerm` sign predicts a horizontal panel for both from a small but
 *   nonzero perspective term, but real PowerPoint renders neither. This is
 *   the discrepancy `visual-3d-panel-quad.ts` previously flagged for
 *   `perspectiveLeft` alone as unresolved; `perspectiveRight` turns out to
 *   have the exact same problem, so both are fixed together here.
 * - Every `*LeftFacing` preset the formula predicts a SECOND side for
 *   (`perspectiveAboveLeftFacing`, `ContrastingLeftFacing`,
 *   `HeroicLeftFacing`) in fact shows only its primary side: the formula's
 *   small-magnitude secondary-axis term is a real but sub-visible signal at
 *   this depth, not an actually-rendered panel. Their `*RightFacing`
 *   mirrors, and the vertical-only `Above`/`Below`/`Relaxed*`/
 *   `HeroicRightFacing` presets, already matched the formula and are
 *   unchanged.
 */
export const MEASURED_PERSPECTIVE_PANEL_SIDES: Record<string, PanelVisibility> = {
	perspectiveFront: NO_PANELS,
	perspectiveLeft: NO_PANELS,
	perspectiveRight: NO_PANELS,
	perspectiveAbove: { showTop: false, showBottom: true, showLeft: false, showRight: false },
	perspectiveBelow: { showTop: true, showBottom: false, showLeft: false, showRight: false },
	perspectiveAboveLeftFacing: {
		showTop: true,
		showBottom: false,
		showLeft: false,
		showRight: false,
	},
	perspectiveAboveRightFacing: {
		showTop: true,
		showBottom: false,
		showLeft: true,
		showRight: false,
	},
	perspectiveContrastingLeftFacing: {
		showTop: true,
		showBottom: false,
		showLeft: false,
		showRight: false,
	},
	perspectiveContrastingRightFacing: {
		showTop: true,
		showBottom: false,
		showLeft: true,
		showRight: false,
	},
	perspectiveHeroicLeftFacing: {
		showTop: false,
		showBottom: true,
		showLeft: false,
		showRight: false,
	},
	perspectiveHeroicRightFacing: {
		showTop: false,
		showBottom: true,
		showLeft: false,
		showRight: false,
	},
	perspectiveHeroicExtremeLeftFacing: NO_PANELS,
	perspectiveHeroicExtremeRightFacing: {
		showTop: false,
		showBottom: false,
		showLeft: true,
		showRight: false,
	},
	perspectiveRelaxed: { showTop: false, showBottom: true, showLeft: false, showRight: false },
	perspectiveRelaxedModerately: {
		showTop: false,
		showBottom: true,
		showLeft: false,
		showRight: false,
	},
};
