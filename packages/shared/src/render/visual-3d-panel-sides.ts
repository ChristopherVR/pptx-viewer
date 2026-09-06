/**
 * Extruded-box panel-side visibility for a camera preset (framework-agnostic).
 *
 * Split out of `visual-3d-camera-homography.ts` to keep that file under the
 * repo's LOC guideline; consumed by `visual-3d-camera`'s `getCameraTransform`
 * and, transitively, `visual-3d-extrusion`'s `build3DExtrusionData`.
 *
 * @module render/visual-3d-panel-sides
 */

import type { Homography3 } from './visual-3d-camera-homography';
import {
	MEASURED_PERSPECTIVE_PANEL_SIDES,
	panelSidesFromHomography,
} from './visual-3d-panel-sides-perspective';

/** Which sides of an extruded box's side panels are visible on screen. */
export interface PanelVisibility {
	showTop: boolean;
	showBottom: boolean;
	showLeft: boolean;
	showRight: boolean;
}

const NO_PANELS: PanelVisibility = {
	showTop: false,
	showBottom: false,
	showLeft: false,
	showRight: false,
};

export { panelSidesFromHomography, MEASURED_PERSPECTIVE_PANEL_SIDES };

/**
 * COM-measured extruded-box panel sides for the `isometric*` family (20
 * presets), which {@link panelSidesFromHomography} structurally CANNOT
 * derive: every preset in this family shares an IDENTICAL front-face
 * homography with at least one sibling (e.g. `isometricLeftUp` and
 * `isometricRightUp` resolve to the exact same matrix; `isometricTopUp`,
 * `isometricTopDown`, `isometricBottomUp` and `isometricBottomDown` all
 * share one), because a flat, unextruded front face genuinely renders
 * pixel-identical under both (only the box's unseen back/side geometry
 * differs). No function of the homography alone can recover which of two
 * siblings a name refers to, so this table is measured directly per preset
 * name instead.
 *
 * Re-ground-truthed 2026-09 (COM `Slide.Export`, a 2in square extruded 36pt,
 * front/extrusion faces in distinct colours, all 20 `isometric*` presets in
 * one pass, edge-band ink analysis: each side's visible ink is isolated by
 * position along its OWN front edge rather than a coarse "count green pixels
 * in the band below/right of the front bbox" classifier, which the ORIGINAL
 * 2026-09 pass used and which mislabelled several presets - see
 * `PANEL_DEPTH_SKEW_MAP`'s doc comment for the corner-fit method this reuses).
 * Two corrections the coarse classifier could not have caught:
 *
 * - `isometricTopUp` (and by extension every OTHER pure single-axis preset
 *   this table lists as a *single* side) shows a genuinely diagonal panel
 *   whose ink falls mostly in the "below front bbox" band even though it
 *   structurally hangs off the box's `right` edge, not `bottom`: the
 *   corner-fit method (which identifies a side by matching the panel's own
 *   shared edge with the front face, not by counting pixels in a directional
 *   band) reclassifies it to `right`. This was a previously-flagged, then
 *   unresolved discrepancy (see `PANEL_DEPTH_SKEW_MAP`'s prior doc comment);
 *   it is now fixed by construction, and `PANEL_DEPTH_SKEW_MAP.isometricTopUp`
 *   carries the matching measured skew for the `right` edge it now resolves
 *   to (a skew for `bottom` would have been actively wrong here).
 * - Roughly half of this table's ORIGINAL single-`Left`/`Right`-paired-with-
 *   `Top`/`Bottom` entries (`isometricLeftDown`, `RightUp`'s sibling
 *   `LeftUp`, `RightDown`, and every plain `OffAxis{1,2,3,4}Left`/`Right`)
 *   actually show only ONE panel, not two: the coarse band classifier's
 *   "count pixels in the band beyond the front bbox" over-counted a second,
 *   fainter panel that is not actually there (or belongs to the other
 *   preset in a shared-homography pair). The edge-fit method confirms each
 *   side independently against its own analytic front-edge corners, so a
 *   phantom second side no longer survives.
 */
export const MEASURED_ISOMETRIC_PANEL_SIDES: Record<string, PanelVisibility> = {
	isometricLeftDown: { showTop: true, showBottom: false, showLeft: false, showRight: false },
	isometricRightUp: { showTop: true, showBottom: false, showLeft: true, showRight: false },
	isometricLeftUp: { showTop: false, showBottom: true, showLeft: false, showRight: false },
	isometricRightDown: { showTop: false, showBottom: true, showLeft: false, showRight: false },
	isometricTopUp: { showTop: false, showBottom: false, showLeft: false, showRight: true },
	isometricTopDown: { showTop: false, showBottom: true, showLeft: false, showRight: false },
	isometricBottomUp: { showTop: false, showBottom: false, showLeft: true, showRight: false },
	isometricBottomDown: { showTop: true, showBottom: false, showLeft: true, showRight: false },
	isometricOffAxis1Left: { showTop: true, showBottom: false, showLeft: false, showRight: false },
	isometricOffAxis1Right: { showTop: true, showBottom: false, showLeft: true, showRight: false },
	isometricOffAxis1Top: { showTop: false, showBottom: true, showLeft: false, showRight: false },
	isometricOffAxis2Left: { showTop: true, showBottom: false, showLeft: false, showRight: false },
	isometricOffAxis2Right: { showTop: true, showBottom: false, showLeft: false, showRight: false },
	isometricOffAxis2Top: { showTop: false, showBottom: true, showLeft: false, showRight: false },
	isometricOffAxis3Left: { showTop: false, showBottom: true, showLeft: false, showRight: false },
	isometricOffAxis3Right: { showTop: false, showBottom: true, showLeft: false, showRight: false },
	isometricOffAxis3Bottom: { showTop: true, showBottom: false, showLeft: false, showRight: false },
	isometricOffAxis4Left: { showTop: false, showBottom: true, showLeft: false, showRight: false },
	isometricOffAxis4Right: { showTop: false, showBottom: true, showLeft: true, showRight: false },
	isometricOffAxis4Bottom: { showTop: true, showBottom: false, showLeft: false, showRight: false },
};

/**
 * COM-measured extruded-box panel sides for the `oblique*`/`legacyOblique*`/
 * `legacyPerspective*`/`orthographicFront` family, keyed by the compass
 * suffix shared across all 3 legacy families (`getObliqueDirectionSuffix`
 * extracts it from the actual preset name). This family's front-face
 * homography is the trivial IDENTITY for every member (see
 * `IDENTITY_HOMOGRAPHY_PRESETS`), carrying no per-preset signal at all, so -
 * exactly like the isometric family above - panel visibility must be
 * measured rather than derived. Ground-truthed 2026-09 (COM `Slide.Export`,
 * `oblique<Direction>` extruded 36pt, all 8 compass directions plus
 * `orthographicFront`); `legacyOblique*`/`legacyPerspective*` are not
 * independently re-measured but share `oblique*`'s exact `rotateX`/
 * `rotateY` sign per direction word (only magnitude/`perspectiveRefPx`
 * differs), so the same table is reused for all 3 families by direction
 * name.
 *
 * Two directions (`Left`, `Right`) measured NO visible panel at all: a
 * purely horizontal extrusion-direction camera in this legacy family, like
 * the modern `perspectiveLeft`/`Right`, reveals no side panel PowerPoint
 * considers worth rendering.
 */
export const OBLIQUE_DIRECTION_PANEL_SIDES: Record<string, PanelVisibility> = {
	Front: NO_PANELS,
	TopLeft: { showTop: true, showBottom: false, showLeft: true, showRight: false },
	Top: { showTop: true, showBottom: false, showLeft: false, showRight: false },
	TopRight: { showTop: true, showBottom: false, showLeft: false, showRight: false },
	Left: NO_PANELS,
	Right: NO_PANELS,
	BottomLeft: { showTop: false, showBottom: true, showLeft: false, showRight: false },
	Bottom: { showTop: false, showBottom: true, showLeft: false, showRight: false },
	BottomRight: { showTop: false, showBottom: true, showLeft: false, showRight: false },
};

/**
 * Extract the shared compass suffix (`TopLeft`, `Top`, ..., `Front`) from an
 * `oblique*`/`legacyOblique*`/`legacyPerspective*`/`orthographicFront`
 * preset name, for looking up {@link OBLIQUE_DIRECTION_PANEL_SIDES}.
 */
function getObliqueDirectionSuffix(preset: string): string | undefined {
	if (preset === 'orthographicFront') {
		return 'Front';
	}
	for (const prefix of ['legacyPerspective', 'legacyOblique', 'oblique']) {
		if (preset.startsWith(prefix)) {
			const suffix = preset.slice(prefix.length);
			return suffix.length > 0 ? suffix : 'Front';
		}
	}
	return undefined;
}

/**
 * Resolve extruded-box panel visibility for a camera preset: the measured
 * per-preset lookup for every family (isometric, perspective, oblique/legacy),
 * otherwise the general homography-derived formula (kept only for a
 * hypothetical future preset with no measured entry), otherwise `undefined`
 * (an unrecognised preset, or an explicit `a:camera/a:rot` override in play:
 * the caller falls back to its own rotateX/rotateY threshold heuristic in
 * that case, unchanged).
 */
export function resolvePanelSides(
	preset: string | undefined,
	homography: Homography3 | undefined,
): PanelVisibility | undefined {
	if (!preset) {
		return undefined;
	}
	const isometricSides = MEASURED_ISOMETRIC_PANEL_SIDES[preset];
	if (isometricSides) {
		return isometricSides;
	}
	const obliqueSuffix = getObliqueDirectionSuffix(preset);
	if (obliqueSuffix !== undefined) {
		return OBLIQUE_DIRECTION_PANEL_SIDES[obliqueSuffix];
	}
	const perspectiveSides = MEASURED_PERSPECTIVE_PANEL_SIDES[preset];
	if (perspectiveSides) {
		return perspectiveSides;
	}
	if (homography) {
		return panelSidesFromHomography(homography);
	}
	return undefined;
}

/**
 * Resolve which extrusion side panels a caller (`build3DExtrusionData`)
 * should actually render, combining {@link resolvePanelSides}'s
 * preset-specific ground truth with two fallbacks: the legacy rotateX/
 * rotateY threshold heuristic when there is no preset-specific ground truth
 * at all (no scene3d, an explicit `a:camera/a:rot` override, or an
 * unrecognised preset), and a deliberate "show all four" depth-perception
 * default for a genuinely face-on view (no preset, or one COM-measured to
 * reveal no panel at all, e.g. `perspectiveFront`/`orthographicFront`) -
 * an extrusion with literally no visible side reads as broken, not
 * flat-on, in the UI.
 */
export function resolveExtrusionPanelVisibility(
	panelSides: PanelVisibility | undefined,
	rotateX: number,
	rotateY: number,
): PanelVisibility {
	// - looking from above (rotateX < 0) reveals the bottom panel;
	// - looking from below (rotateX > 0) reveals the top panel;
	// - looking from the left (rotateY > 0) reveals the right panel;
	// - looking from the right (rotateY < 0) reveals the left panel.
	const resolved = panelSides ?? {
		showBottom: rotateX <= 2,
		showTop: rotateX >= -2,
		showRight: rotateY <= 5,
		showLeft: rotateY >= -5,
	};
	if (!resolved.showTop && !resolved.showBottom && !resolved.showLeft && !resolved.showRight) {
		return { showTop: true, showBottom: true, showLeft: true, showRight: true };
	}
	return resolved;
}
