import { describe, expect, it } from 'vitest';

import { CAMERA_HOMOGRAPHY_MAP } from './visual-3d-camera-homography';
import {
	MEASURED_ISOMETRIC_PANEL_SIDES,
	OBLIQUE_DIRECTION_PANEL_SIDES,
	panelSidesFromHomography,
	resolvePanelSides,
} from './visual-3d-panel-sides';
import { MEASURED_PERSPECTIVE_PANEL_SIDES } from './visual-3d-panel-sides-perspective';

const NONE = { showTop: false, showBottom: false, showLeft: false, showRight: false };

// COM-measured 2026-09 (`Slide.Export`, a 2in square extruded 36pt, front/
// extrusion faces in distinct colours, all 35 CAMERA_HOMOGRAPHY_MAP presets
// plus orthographicFront and the 8 oblique compass directions in one pass,
// edge-band ink analysis). Table: preset -> measured {top,bottom,left,right}.
// See `visual-3d-panel-sides-perspective.ts` and `visual-3d-panel-sides.ts`'s
// module doc comments for the full writeup.
describe('panelSidesFromHomography (raw formula, superseded for known presets)', () => {
	it('shows no panel for a face-on view (perspectiveFront measured zero on every side)', () => {
		expect(panelSidesFromHomography(CAMERA_HOMOGRAPHY_MAP.perspectiveFront)).toStrictEqual({
			showTop: false,
			showBottom: false,
			showLeft: false,
			showRight: false,
		});
	});

	it('over-predicts a right panel for perspectiveHeroicLeftFacing (fixed by the measured table)', () => {
		// The raw formula still predicts bottom+right; measurement (see
		// MEASURED_PERSPECTIVE_PANEL_SIDES) shows bottom only. resolvePanelSides
		// uses the measured value, not this formula, for every known preset.
		const sides = panelSidesFromHomography(CAMERA_HOMOGRAPHY_MAP.perspectiveHeroicLeftFacing);
		expect(sides.showBottom).toBeTruthy();
		expect(sides.showRight).toBeTruthy();
	});

	it('matches measured sides for the two-axis AboveRightFacing/ContrastingRightFacing family', () => {
		const aboveRight = panelSidesFromHomography(CAMERA_HOMOGRAPHY_MAP.perspectiveAboveRightFacing);
		expect(aboveRight).toStrictEqual({
			showTop: true,
			showBottom: false,
			showLeft: true,
			showRight: false,
		});
	});
});

describe('measured perspective panel sides', () => {
	it('covers all 15 perspective presets', () => {
		expect(Object.keys(MEASURED_PERSPECTIVE_PANEL_SIDES)).toHaveLength(15);
	});

	it('fixes the perspectiveLeft/perspectiveRight discrepancy: the formula predicts a panel, measurement shows none', () => {
		const leftFormula = panelSidesFromHomography(CAMERA_HOMOGRAPHY_MAP.perspectiveLeft);
		const rightFormula = panelSidesFromHomography(CAMERA_HOMOGRAPHY_MAP.perspectiveRight);
		expect(leftFormula.showRight).toBeTruthy();
		expect(rightFormula.showLeft).toBeTruthy();
		expect(MEASURED_PERSPECTIVE_PANEL_SIDES.perspectiveLeft).toStrictEqual(NONE);
		expect(MEASURED_PERSPECTIVE_PANEL_SIDES.perspectiveRight).toStrictEqual(NONE);
	});

	it('shows only the primary side for every *LeftFacing preset the formula over-predicts a second side for', () => {
		expect(MEASURED_PERSPECTIVE_PANEL_SIDES.perspectiveAboveLeftFacing).toStrictEqual({
			showTop: true,
			showBottom: false,
			showLeft: false,
			showRight: false,
		});
		expect(MEASURED_PERSPECTIVE_PANEL_SIDES.perspectiveContrastingLeftFacing).toStrictEqual({
			showTop: true,
			showBottom: false,
			showLeft: false,
			showRight: false,
		});
		expect(MEASURED_PERSPECTIVE_PANEL_SIDES.perspectiveHeroicLeftFacing).toStrictEqual({
			showTop: false,
			showBottom: true,
			showLeft: false,
			showRight: false,
		});
	});

	it('matches measured sides for the single-axis perspectiveAbove/Below pair', () => {
		expect(MEASURED_PERSPECTIVE_PANEL_SIDES.perspectiveAbove.showBottom).toBeTruthy();
		expect(MEASURED_PERSPECTIVE_PANEL_SIDES.perspectiveBelow.showTop).toBeTruthy();
	});

	it('overrides the formula for the 2 measured HeroicExtreme*Facing exceptions', () => {
		const formulaGuess = panelSidesFromHomography(
			CAMERA_HOMOGRAPHY_MAP.perspectiveHeroicExtremeLeftFacing,
		);
		expect(formulaGuess).not.toStrictEqual(NONE);
		expect(MEASURED_PERSPECTIVE_PANEL_SIDES.perspectiveHeroicExtremeLeftFacing).toStrictEqual(NONE);
		expect(MEASURED_PERSPECTIVE_PANEL_SIDES.perspectiveHeroicExtremeRightFacing).toStrictEqual({
			showTop: false,
			showBottom: false,
			showLeft: true,
			showRight: false,
		});
	});
});

describe('measured isometric panel sides', () => {
	it('covers all 20 isometric presets', () => {
		expect(Object.keys(MEASURED_ISOMETRIC_PANEL_SIDES)).toHaveLength(20);
	});

	it('resolves isometricTopUp to a RIGHT panel, not bottom (edge-fit correction)', () => {
		// The prior coarse "band" classifier mislabelled this steeply-rotated
		// diagonal panel as `bottom`; the edge-fit method matches its ink to the
		// box's own `right` edge corners instead.
		expect(MEASURED_ISOMETRIC_PANEL_SIDES.isometricTopUp).toStrictEqual({
			showTop: false,
			showBottom: false,
			showLeft: false,
			showRight: true,
		});
	});

	it('gives isometricLeftUp and isometricRightUp opposite sides despite an identical homography', () => {
		// Both share the exact same front-face homography (see the module doc
		// comment); only the measured table can tell them apart.
		expect(CAMERA_HOMOGRAPHY_MAP.isometricLeftUp).toStrictEqual(
			CAMERA_HOMOGRAPHY_MAP.isometricRightUp,
		);
		expect(MEASURED_ISOMETRIC_PANEL_SIDES.isometricLeftUp).not.toStrictEqual(
			MEASURED_ISOMETRIC_PANEL_SIDES.isometricRightUp,
		);
	});

	it('shows only ONE side for presets the coarser classifier over-counted a second side for', () => {
		expect(MEASURED_ISOMETRIC_PANEL_SIDES.isometricLeftDown).toStrictEqual({
			showTop: true,
			showBottom: false,
			showLeft: false,
			showRight: false,
		});
		expect(MEASURED_ISOMETRIC_PANEL_SIDES.isometricOffAxis1Left).toStrictEqual({
			showTop: true,
			showBottom: false,
			showLeft: false,
			showRight: false,
		});
	});

	it('shows only ONE vertical side for the pure single-axis Top/Bottom presets, never a left/right sliver', () => {
		expect(MEASURED_ISOMETRIC_PANEL_SIDES.isometricTopDown).toStrictEqual({
			showTop: false,
			showBottom: true,
			showLeft: false,
			showRight: false,
		});
		expect(MEASURED_ISOMETRIC_PANEL_SIDES.isometricBottomUp).toStrictEqual({
			showTop: false,
			showBottom: false,
			showLeft: true,
			showRight: false,
		});
	});

	it('shows two adjacent panels for a genuine merged-corner preset', () => {
		expect(MEASURED_ISOMETRIC_PANEL_SIDES.isometricRightUp).toStrictEqual({
			showTop: true,
			showBottom: false,
			showLeft: true,
			showRight: false,
		});
		expect(MEASURED_ISOMETRIC_PANEL_SIDES.isometricBottomDown).toStrictEqual({
			showTop: true,
			showBottom: false,
			showLeft: true,
			showRight: false,
		});
	});
});

describe('oblique direction panel sides', () => {
	it('shows no panel for the purely horizontal Left/Right directions', () => {
		expect(OBLIQUE_DIRECTION_PANEL_SIDES.Left).toStrictEqual({
			showTop: false,
			showBottom: false,
			showLeft: false,
			showRight: false,
		});
		expect(OBLIQUE_DIRECTION_PANEL_SIDES.Right).toStrictEqual({
			showTop: false,
			showBottom: false,
			showLeft: false,
			showRight: false,
		});
	});

	it('shows the named corner for a diagonal direction', () => {
		expect(OBLIQUE_DIRECTION_PANEL_SIDES.TopLeft).toStrictEqual({
			showTop: true,
			showBottom: false,
			showLeft: true,
			showRight: false,
		});
	});
});

describe('resolvePanelSides', () => {
	it('returns undefined for an unrecognised preset with no homography', () => {
		expect(resolvePanelSides('notAPreset', undefined)).toBeUndefined();
	});

	it('returns undefined when no preset name is given', () => {
		expect(resolvePanelSides(undefined, CAMERA_HOMOGRAPHY_MAP.perspectiveFront)).toBeUndefined();
	});

	it('prefers the measured isometric lookup over any homography-derived guess', () => {
		const sides = resolvePanelSides(
			'isometricOffAxis1Left',
			CAMERA_HOMOGRAPHY_MAP.isometricOffAxis1Left,
		);
		expect(sides).toStrictEqual(MEASURED_ISOMETRIC_PANEL_SIDES.isometricOffAxis1Left);
	});

	it('resolves the oblique family by its compass suffix across all 3 legacy names', () => {
		const expected = OBLIQUE_DIRECTION_PANEL_SIDES.TopLeft;
		expect(resolvePanelSides('obliqueTopLeft', undefined)).toStrictEqual(expected);
		expect(resolvePanelSides('legacyObliqueTopLeft', undefined)).toStrictEqual(expected);
		expect(resolvePanelSides('legacyPerspectiveTopLeft', undefined)).toStrictEqual(expected);
	});

	it('resolves orthographicFront and legacyObliqueFront/legacyPerspectiveFront to the Front entry', () => {
		expect(resolvePanelSides('orthographicFront', undefined)).toStrictEqual(
			OBLIQUE_DIRECTION_PANEL_SIDES.Front,
		);
		expect(resolvePanelSides('legacyObliqueFront', undefined)).toStrictEqual(
			OBLIQUE_DIRECTION_PANEL_SIDES.Front,
		);
	});

	it('uses the measured table, not the raw formula, for the whole perspective family', () => {
		const sides = resolvePanelSides(
			'perspectiveHeroicLeftFacing',
			CAMERA_HOMOGRAPHY_MAP.perspectiveHeroicLeftFacing,
		);
		expect(sides).toStrictEqual(MEASURED_PERSPECTIVE_PANEL_SIDES.perspectiveHeroicLeftFacing);
		expect(sides).not.toStrictEqual(
			panelSidesFromHomography(CAMERA_HOMOGRAPHY_MAP.perspectiveHeroicLeftFacing),
		);
	});

	it('fixes perspectiveLeft to show no panel (previously a formula/measurement discrepancy)', () => {
		expect(
			resolvePanelSides('perspectiveLeft', CAMERA_HOMOGRAPHY_MAP.perspectiveLeft),
		).toStrictEqual(NONE);
		expect(
			resolvePanelSides('perspectiveRight', CAMERA_HOMOGRAPHY_MAP.perspectiveRight),
		).toStrictEqual(NONE);
	});

	it('overrides the formula for the 2 measured HeroicExtreme*Facing exceptions', () => {
		// The formula's raw sign/magnitude would predict a panel for both
		// (see MEASURED_PERSPECTIVE_PANEL_SIDES's doc comment); measurement
		// showed the LeftFacing member shows none at all, so the override must
		// win.
		const formulaGuess = panelSidesFromHomography(
			CAMERA_HOMOGRAPHY_MAP.perspectiveHeroicExtremeLeftFacing,
		);
		expect(formulaGuess).not.toStrictEqual(NONE);
		expect(
			resolvePanelSides(
				'perspectiveHeroicExtremeLeftFacing',
				CAMERA_HOMOGRAPHY_MAP.perspectiveHeroicExtremeLeftFacing,
			),
		).toStrictEqual(NONE);
		expect(
			resolvePanelSides(
				'perspectiveHeroicExtremeRightFacing',
				CAMERA_HOMOGRAPHY_MAP.perspectiveHeroicExtremeRightFacing,
			),
		).toStrictEqual({ showTop: false, showBottom: false, showLeft: true, showRight: false });
	});
});
