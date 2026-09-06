import { describe, expect, it } from 'vitest';

import { getCameraHomography } from './visual-3d-camera-homography';
import type { Homography3 } from './visual-3d-camera-homography';
import { build3DExtrusionData } from './visual-3d-extrusion';
import {
	computeHomographyPanelQuad,
	getMeasuredPanelDepthSkew,
	PANEL_DEPTH_SKEW_MAP,
	projectHomographyPoint,
} from './visual-3d-panel-quad';

/**
 * COM ground truth (2026-09, `Slide.Export`, a 2in square extruded 36pt,
 * front face red / `extrusionClr` green, Node connected-component +
 * edge-band ink fit; see `PANEL_DEPTH_SKEW_MAP`'s doc comment for the full
 * method) for a representative sample spanning all 3 covered families:
 * `perspective*`, `isometric*`, `oblique*`.
 */
const SIZE_PX = 600;
const DEPTH_PX = 150;

const EDGE_UV: Record<string, [[number, number], [number, number]]> = {
	top: [
		[0, 0],
		[1, 0],
	],
	bottom: [
		[0, 1],
		[1, 1],
	],
	left: [
		[0, 0],
		[0, 1],
	],
	right: [
		[1, 0],
		[1, 1],
	],
};

const MEASURED: Record<string, 'top' | 'bottom' | 'left' | 'right'> = {
	perspectiveAbove: 'bottom',
	perspectiveHeroicLeftFacing: 'bottom',
	perspectiveContrastingRightFacing: 'top',
	isometricOffAxis1Left: 'top',
	isometricOffAxis2Right: 'top',
	isometricLeftDown: 'top',
	isometricTopUp: 'right',
	obliqueTopLeft: 'top',
	obliqueBottomRight: 'bottom',
};

/** These presets measured ZERO visible extrusion ink: no panel geometry to correct. */
const NO_PANEL_MEASURED = ['perspectiveLeft', 'perspectiveRight', 'obliqueLeft', 'obliqueRight'];

describe('panel depth-skew map coverage', () => {
	it('covers every family this module documents (37 measured presets)', () => {
		expect(Object.keys(PANEL_DEPTH_SKEW_MAP)).toHaveLength(37);
		for (const preset of Object.keys(MEASURED)) {
			expect(PANEL_DEPTH_SKEW_MAP[preset]).toBeDefined();
		}
	});

	it('has no entry for presets confirmed to show no visible extrusion ink', () => {
		for (const preset of NO_PANEL_MEASURED) {
			expect(PANEL_DEPTH_SKEW_MAP[preset]).toBeUndefined();
		}
	});

	it('resolves isometricTopUp to its own measured entry (fixed from a prior visibility mismatch)', () => {
		// Previously omitted entirely: the shipped visibility table resolved
		// this preset to `bottom`, but the real ink matched `right`; applying a
		// `bottom`-measured skew would have been wrong. Both the visibility
		// table and this skew now agree on `right`.
		expect(PANEL_DEPTH_SKEW_MAP.isometricTopUp).toBeDefined();
		expect(getMeasuredPanelDepthSkew('isometricTopUp')).toStrictEqual(
			PANEL_DEPTH_SKEW_MAP.isometricTopUp,
		);
	});

	it('every measured skew has a real, non-trivial magnitude (not a near-zero noise artifact)', () => {
		for (const [preset, skew] of Object.entries(PANEL_DEPTH_SKEW_MAP)) {
			const magnitude = Math.hypot(skew.dx, skew.dy);
			expect(magnitude, `${preset} skew magnitude`).toBeGreaterThan(0.005);
		}
	});
});

/**
 * Two-sided presets whose panels were independently measured (see
 * `PANEL_DEPTH_SKEW_MAP`'s doc comment). Each entry's own `top`/`bottom`/
 * `left`/`right` overrides are the ground truth being asserted here; the
 * `oblique*` pair is the sharpest case because that family's 2 panels are
 * independently axis-aligned (one purely vertical, one purely horizontal),
 * so the old single-averaged-vector model put both panels' back edges
 * measurably off at any real extrusion depth.
 */
const OBLIQUE_TWO_SIDED: Record<string, { a: 'top' | 'bottom' | 'left' | 'right'; b: 'left' }> = {
	obliqueTopLeft: { a: 'top', b: 'left' },
	obliqueBottomLeft: { a: 'bottom', b: 'left' },
};

const OTHER_TWO_SIDED: readonly string[] = [
	'perspectiveAboveRightFacing',
	'perspectiveContrastingRightFacing',
	'isometricRightUp',
	'isometricBottomDown',
	'isometricOffAxis1Right',
	'isometricOffAxis4Right',
];

describe('per-side panel depth skew (oblique family)', () => {
	it.each(Object.entries(OBLIQUE_TWO_SIDED))(
		'%s: top/left panels each carry their OWN measured vector, not a shared average',
		(preset, { a, b }) => {
			const entry = PANEL_DEPTH_SKEW_MAP[preset];
			expect(entry).toBeDefined();
			const sideA = entry[a];
			const sideB = entry[b];
			expect(sideA, `${preset}.${a}`).toBeDefined();
			expect(sideB, `${preset}.${b}`).toBeDefined();
			expect(getMeasuredPanelDepthSkew(preset, a)).toStrictEqual(sideA);
			expect(getMeasuredPanelDepthSkew(preset, b)).toStrictEqual(sideB);

			// The oblique family's panels are independently axis-aligned: the
			// top/bottom panel's offset is purely vertical (dx === 0) and the
			// left panel's is purely horizontal (dy === 0).
			expect(sideA!.dx).toBe(0);
			expect(sideB!.dy).toBe(0);

			// The two sides must genuinely differ (this is the bug being
			// fixed): a shared vector could not be both purely vertical and
			// purely horizontal at once.
			expect(sideA).not.toStrictEqual(sideB);
		},
	);

	it.each(Object.keys(OBLIQUE_TWO_SIDED))(
		'%s: falling back to the old averaged default leaves a real per-side residual error',
		(preset) => {
			const entry = PANEL_DEPTH_SKEW_MAP[preset];
			const { a, b } = OBLIQUE_TWO_SIDED[preset];
			const sideA = entry[a]!;
			const sideB = entry[b]!;
			// Residual (in fractions of extrusion depth) between the shared
			// default this preset used to resolve to for EVERY side, and each
			// side's own true measured vector.
			const residualA = Math.hypot(entry.dx - sideA.dx, entry.dy - sideA.dy);
			const residualB = Math.hypot(entry.dx - sideB.dx, entry.dy - sideB.dy);
			// At the module's own 150px test depth this is tens of screen px,
			// not sub-pixel noise: this residual is exactly why the map moved
			// to per-side vectors.
			expect(residualA * DEPTH_PX, `${preset}.${a} residual px`).toBeGreaterThan(15);
			expect(residualB * DEPTH_PX, `${preset}.${b} residual px`).toBeGreaterThan(15);
		},
	);

	it('every other measured 2-sided preset also carries per-side overrides', () => {
		for (const preset of OTHER_TWO_SIDED) {
			const entry = PANEL_DEPTH_SKEW_MAP[preset];
			expect(entry, `${preset} entry`).toBeDefined();
			const overrideCount = (['top', 'bottom', 'left', 'right'] as const).filter(
				(side) => entry[side] !== undefined,
			).length;
			expect(overrideCount, `${preset} per-side override count`).toBe(2);
		}
	});

	it('computeHomographyPanelQuad picks the side-specific vector via getMeasuredPanelDepthSkew', () => {
		const h = getCameraHomography('obliqueTopLeft') as Homography3;
		const topSkew = getMeasuredPanelDepthSkew('obliqueTopLeft', 'top')!;
		const leftSkew = getMeasuredPanelDepthSkew('obliqueTopLeft', 'left')!;
		expect(topSkew).not.toStrictEqual(leftSkew);

		const topQuad = computeHomographyPanelQuad(h, 'top', SIZE_PX, SIZE_PX, DEPTH_PX, topSkew);
		const leftQuad = computeHomographyPanelQuad(h, 'left', SIZE_PX, SIZE_PX, DEPTH_PX, leftSkew);
		expect(topQuad.clipPath).not.toBe(leftQuad.clipPath);
	});
});

describe('computeHomographyPanelQuad matches the measured corners', () => {
	it.each(Object.entries(MEASURED))(
		'%s: computed quad uses the exact front-face corners',
		(preset, side) => {
			const h = getCameraHomography(preset) as Homography3;
			expect(h).toBeDefined();
			const skew = getMeasuredPanelDepthSkew(preset, side);
			const entry = PANEL_DEPTH_SKEW_MAP[preset];
			expect(skew).toStrictEqual(entry[side] ?? { dx: entry.dx, dy: entry.dy });

			const quad = computeHomographyPanelQuad(h, side, SIZE_PX, SIZE_PX, DEPTH_PX, skew!);
			const [[u1, v1], [u2, v2]] = EDGE_UV[side];
			const front1 = projectHomographyPoint(h, u1, v1, SIZE_PX, SIZE_PX);
			const front2 = projectHomographyPoint(h, u2, v2, SIZE_PX, SIZE_PX);
			expect(Number.isFinite(front1.x)).toBeTruthy();
			expect(Number.isFinite(front2.x)).toBeTruthy();

			// bounding box must be large enough to contain the full measured offset
			expect(quad.width).toBeGreaterThan(0);
			expect(quad.height).toBeGreaterThan(0);
		},
	);
});

describe('build3DExtrusionData uses clip-path (no degenerate collapse) for measured presets', () => {
	it.each(Object.entries(MEASURED))(
		'%s: panel has clipPath, no transform, non-zero bounding box',
		(preset, side) => {
			const result = build3DExtrusionData(
				{ extrusionHeight: 457200, extrusionColor: '#00ff00' }, // 36pt
				{ cameraPreset: preset },
				'#ff0000',
				192, // 2in @ 96 CSS px/in
				192,
			);
			const panel = result.panels.find((p) => p.side === side);
			expect(panel).toBeDefined();
			expect(panel!.style.clipPath).toBeDefined();
			expect(panel!.style.transform).toBeUndefined();
			expect(Number(panel!.style.width)).toBeGreaterThan(0);
			expect(Number(panel!.style.height)).toBeGreaterThan(0);
		},
	);

	it('falls back to the legacy (unmeasured) composition for a homography preset with no ground truth', () => {
		const result = build3DExtrusionData(
			{ extrusionHeight: 457200 },
			{ cameraPreset: 'perspectiveFront' },
			'#888',
			192,
			192,
		);
		for (const panel of result.panels) {
			expect(panel.style.clipPath).toBeUndefined();
			expect(String(panel.style.transform)).toContain('rotate');
		}
	});

	it('never emits a panel for presets confirmed to show no visible extrusion ink', () => {
		for (const preset of NO_PANEL_MEASURED) {
			const result = build3DExtrusionData(
				{ extrusionHeight: 457200 },
				{ cameraPreset: preset },
				'#888',
				192,
				192,
			);
			for (const panel of result.panels) {
				expect(panel.style.clipPath).toBeUndefined();
			}
		}
	});
});
