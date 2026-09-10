import { describe, expect, it } from 'vitest';

import {
	BEVEL_PROFILE_HEIGHT_MAP,
	getBevelProfileHeightMap,
} from './visual-3d-bevel-lighting-tables';

/**
 * COM ground truth for the 2026-09 bevel-profile cross-section campaign
 * (`BEVEL_PROFILE_HEIGHT_MAP`'s doc comment): brightness (0-255, Rec.709
 * luminance) sampled along a line from the top edge inward, at 10 of the 40
 * measured offsets, for a mid-grey `matte` square with a 24pt `a:bevelT`,
 * `threePt` rig / `dir="t"`, `orthographicFront` camera. Produced by
 * `scripts/make-bevel-profile-fixture.mjs` +
 * `scripts/measure-bevel-profile-com.ps1` (both scratch tooling,
 * not committed, same convention as `com-acceptance.mjs`); the full
 * 40-point x 2-depth raw table is in the task report. Pinned here so the
 * measured record cannot silently drift out of the codebase the way an
 * unpinned scratch-script output would.
 */
const MEASURED_24PT_CURVES: Record<string, { offsetsIn: number[]; brightness: number[] }> = {
	relaxedInset: {
		offsetsIn: [0.01, 0.06, 0.111, 0.161, 0.211, 0.261, 0.311, 0.362, 0.412, 0.5],
		brightness: [113.0, 135.7, 139.0, 137.0, 60.0, 85.3, 126.3, 133.0, 133.0, 133.0],
	},
	circle: {
		offsetsIn: [0.01, 0.06, 0.111, 0.161, 0.211, 0.261, 0.311, 0.362, 0.412, 0.5],
		brightness: [116.0, 136.0, 139.0, 136.3, 138.0, 138.0, 135.0, 133.0, 133.0, 133.0],
	},
	slope: {
		offsetsIn: [0.01, 0.06, 0.111, 0.161, 0.211, 0.261, 0.311, 0.362, 0.412, 0.5],
		brightness: [114.0, 134.7, 133.3, 133.0, 91.7, 110.0, 96.0, 133.0, 133.0, 133.0],
	},
	cross: {
		offsetsIn: [0.01, 0.06, 0.111, 0.161, 0.211, 0.261, 0.311, 0.362, 0.412, 0.5],
		brightness: [139.0, 133.0, 133.0, 131.7, 133.0, 133.0, 133.0, 133.0, 133.0, 133.0],
	},
	angle: {
		offsetsIn: [0.01, 0.06, 0.111, 0.161, 0.211, 0.261, 0.311, 0.362, 0.412, 0.5],
		brightness: [139.0, 139.0, 139.0, 139.0, 139.0, 139.0, 139.0, 133.0, 133.0, 133.0],
	},
	softRound: {
		offsetsIn: [0.01, 0.06, 0.111, 0.161, 0.211, 0.261, 0.311, 0.362, 0.412, 0.5],
		brightness: [105.0, 77.7, 70.0, 63.3, 92.0, 115.0, 128.7, 133.0, 133.0, 133.0],
	},
	convex: {
		offsetsIn: [0.01, 0.06, 0.111, 0.161, 0.211, 0.261, 0.311, 0.362, 0.412, 0.5],
		brightness: [139.0, 138.0, 137.0, 139.0, 139.0, 134.0, 139.0, 133.0, 133.0, 133.0],
	},
	coolSlant: {
		offsetsIn: [0.01, 0.06, 0.111, 0.161, 0.211, 0.261, 0.311, 0.362, 0.412, 0.5],
		brightness: [121.7, 129.0, 137.3, 139.0, 133.0, 133.0, 133.0, 133.0, 133.0, 133.0],
	},
	divot: {
		offsetsIn: [0.01, 0.06, 0.111, 0.161, 0.211, 0.261, 0.311, 0.362, 0.412, 0.5],
		brightness: [114.0, 133.0, 139.0, 139.0, 133.0, 133.0, 137.0, 133.0, 133.0, 133.0],
	},
	riblet: {
		offsetsIn: [0.01, 0.06, 0.111, 0.161, 0.211, 0.261, 0.311, 0.362, 0.412, 0.5],
		brightness: [119.3, 135.7, 139.0, 138.3, 136.7, 133.0, 136.0, 133.0, 133.0, 133.0],
	},
	hardEdge: {
		offsetsIn: [0.01, 0.06, 0.111, 0.161, 0.211, 0.261, 0.311, 0.362, 0.412, 0.5],
		brightness: [111.7, 135.0, 133.0, 133.0, 102.7, 104.0, 128.3, 133.0, 133.0, 133.0],
	},
	artDeco: {
		offsetsIn: [0.01, 0.06, 0.111, 0.161, 0.211, 0.261, 0.311, 0.362, 0.412, 0.5],
		brightness: [129.7, 137.0, 111.7, 137.3, 137.0, 139.0, 135.0, 133.0, 133.0, 133.0],
	},
};

describe('bevel_profile_height_map measured-curve pin (2026-09 cross-section campaign)', () => {
	it('covers all 12 a:bevelT/@prst profiles', () => {
		expect(Object.keys(MEASURED_24PT_CURVES).sort()).toStrictEqual(
			Object.keys(BEVEL_PROFILE_HEIGHT_MAP).sort(),
		);
	});

	it('every measured curve settles to the same flat-interior brightness (~133)', () => {
		const flatTails = Object.entries(MEASURED_24PT_CURVES).map(
			([profile, curve]) => [profile, curve.brightness.at(-1)] as const,
		);
		for (const [, flatTail] of flatTails) {
			expect(flatTail).toBeCloseTo(133, 0);
		}
	});

	it('relaxedInset/slope/hardEdge show a real bright-bump-then-dark-trough double transition', () => {
		// The finding that overturned the pre-2026-09 "slope/hardEdge are
		// low-relief" assumption: each of these three dips WELL BELOW the
		// flat-interior baseline (133) partway through the ramp, something a
		// single monotonic blur(+erode) height map cannot reproduce (see
		// BEVEL_PROFILE_HEIGHT_MAP's doc comment). Any measured point at least
		// 30 brightness units under the flat baseline confirms the trough.
		const troughs = ['relaxedInset', 'slope', 'hardEdge'].map((profile) =>
			Math.min(...MEASURED_24PT_CURVES[profile].brightness),
		);
		for (const trough of troughs) {
			expect(trough).toBeLessThan(133 - 30);
		}
	});

	it('pins the fitted blurFactor/morphologyFactor/surfaceScaleFactor per profile', () => {
		// Regression pin: a future edit to BEVEL_PROFILE_HEIGHT_MAP should be a
		// deliberate re-fit against fresh COM data, not an accidental drift.
		expect(BEVEL_PROFILE_HEIGHT_MAP).toStrictEqual({
			circle: { blurFactor: 0.35, surfaceScaleFactor: 0.65, measuredUniform: false },
			convex: {
				blurFactor: 0.18,
				morphologyFactor: 0.4,
				surfaceScaleFactor: 0.2,
				measuredUniform: false,
			},
			softRound: {
				blurFactor: 0.25,
				morphologyFactor: 0.4,
				surfaceScaleFactor: 0.65,
				measuredUniform: false,
			},
			relaxedInset: {
				blurFactor: 0.35,
				morphologyFactor: 0.5,
				surfaceScaleFactor: 1.5,
				measuredUniform: false,
			},
			divot: { blurFactor: 0.18, surfaceScaleFactor: 0.5, measuredUniform: false },
			angle: {
				blurFactor: 0.35,
				morphologyFactor: 0.4,
				surfaceScaleFactor: 0.35,
				measuredUniform: false,
			},
			cross: {
				blurFactor: 0.12,
				morphologyFactor: 0.18,
				surfaceScaleFactor: 0.2,
				measuredUniform: false,
			},
			coolSlant: {
				blurFactor: 0.25,
				morphologyFactor: 0.06,
				surfaceScaleFactor: 0.5,
				measuredUniform: false,
			},
			riblet: { blurFactor: 0.25, surfaceScaleFactor: 0.5, measuredUniform: false },
			artDeco: {
				blurFactor: 0.18,
				morphologyFactor: 0.32,
				surfaceScaleFactor: 0.35,
				measuredUniform: false,
			},
			slope: {
				blurFactor: 0.55,
				morphologyFactor: 0.5,
				surfaceScaleFactor: 1.5,
				measuredUniform: true,
			},
			hardEdge: {
				blurFactor: 0.55,
				morphologyFactor: 0.5,
				surfaceScaleFactor: 1.5,
				measuredUniform: true,
			},
		});
	});

	it('getBevelProfileHeightMap looks up every profile from the table', () => {
		for (const profile of Object.keys(BEVEL_PROFILE_HEIGHT_MAP)) {
			expect(getBevelProfileHeightMap(profile)).toBe(BEVEL_PROFILE_HEIGHT_MAP[profile]);
		}
	});
});
