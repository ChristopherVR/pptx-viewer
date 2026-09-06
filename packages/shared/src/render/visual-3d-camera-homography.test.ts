import { describe, expect, it } from 'vitest';

import {
	CAMERA_HOMOGRAPHY_MAP,
	getCameraHomography,
	homographyToMatrix3d,
	IDENTITY_HOMOGRAPHY_PRESETS,
	isIdentityHomography,
} from './visual-3d-camera-homography';

describe('getCameraHomography', () => {
	it('returns undefined for no preset / unknown preset', () => {
		expect(getCameraHomography(undefined)).toBeUndefined();
		expect(getCameraHomography('notARealPreset')).toBeUndefined();
	});

	it('returns the identity matrix for orthographicFront and every oblique*/legacyOblique*/legacyPerspective* preset', () => {
		// COM-measured 2026-09 (see the module doc comment): a flat shape's
		// front face renders pixel-identical to orthographicFront under every
		// preset in these families.
		for (const preset of IDENTITY_HOMOGRAPHY_PRESETS) {
			const h = getCameraHomography(preset);
			expect(h).toStrictEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
			expect(isIdentityHomography(h!)).toBeTruthy();
		}
		expect(IDENTITY_HOMOGRAPHY_PRESETS.has('orthographicFront')).toBeTruthy();
		expect(IDENTITY_HOMOGRAPHY_PRESETS.has('obliqueTopLeft')).toBeTruthy();
		expect(IDENTITY_HOMOGRAPHY_PRESETS.has('legacyPerspectiveTopLeft')).toBeTruthy();
	});

	it('returns a measured non-identity homography for every perspective*/isometric* preset', () => {
		for (const [preset, h] of Object.entries(CAMERA_HOMOGRAPHY_MAP)) {
			expect(getCameraHomography(preset)).toBe(h);
			expect(isIdentityHomography(h)).toBeFalsy();
			// h33 is always normalised to 1 (DLT convention used by the
			// measurement pipeline).
			expect(h[8]).toBe(1);
		}
	});

	it('perspectiveFront is a near-identity uniform scale (straight-on camera at a finite distance)', () => {
		const h = getCameraHomography('perspectiveFront')!;
		expect(h[0]).toBeCloseTo(0.994792, 5); // h11 (x scale)
		expect(h[4]).toBeCloseTo(0.994792, 5); // h22 (y scale)
		expect(h[1]).toBe(0); // no skew
		expect(h[3]).toBe(0);
		expect(h[6]).toBe(0); // no perspective divide term: matches a straight-on view
		expect(h[7]).toBe(0);
	});

	it('perspectiveLeft/perspectiveRight are near-mirror images (opposite off-axis camera offset)', () => {
		const left = getCameraHomography('perspectiveLeft')!;
		const right = getCameraHomography('perspectiveRight')!;
		// COM-measured: the single-axis perspective family scales/offsets but
		// does NOT keystone (opposite edges of the measured quad stayed
		// parallel) -- h12/h21 (the skew terms) both measured at/near 0.
		expect(left[1]).toBe(0);
		expect(right[1]).toBe(0);
		expect(left[6]).toBeCloseTo(-right[6], 2);
	});

	it('most isometric presets have exactly-zero perspective-divide terms (pure affine, parallel projection)', () => {
		// The 4 "OffAxis*Top"/"OffAxis*Bottom" variants (a near edge-on view)
		// carry a small (<1.5%) non-zero h31/h32 residual from the convex-hull
		// fit at that extreme angle rather than a genuine perspective divide;
		// every other isometric preset measured exactly 0.
		for (const preset of Object.keys(CAMERA_HOMOGRAPHY_MAP)) {
			if (!preset.startsWith('isometric') || /Top$|Bottom$/u.test(preset)) {
				continue;
			}
			const h = getCameraHomography(preset)!;
			expect(h[6]).toBe(0); // h31
			expect(h[7]).toBe(0); // h32
		}
	});

	it('isometricTopUp/TopDown/BottomUp/BottomDown share an identical front-face homography', () => {
		// COM-measured 2026-09: a flat (unextruded) shape gives NO signal to
		// distinguish which side of a box you'd be looking at, since there is
		// no box; only the (unmeasurable from a flat shape) back/side panels
		// would differ. See `visual-3d-camera`'s `cameraFlatFace` doc comment.
		const topUp = getCameraHomography('isometricTopUp');
		const topDown = getCameraHomography('isometricTopDown');
		const bottomUp = getCameraHomography('isometricBottomUp');
		const bottomDown = getCameraHomography('isometricBottomDown');
		expect(topUp).toStrictEqual(topDown);
		expect(topUp).toStrictEqual(bottomUp);
		expect(topUp).toStrictEqual(bottomDown);
	});
});

describe('homographyToMatrix3d', () => {
	it('embeds the identity homography as a true identity matrix3d', () => {
		const result = homographyToMatrix3d([1, 0, 0, 0, 1, 0, 0, 0, 1], 200, 100);
		expect(result).toBe('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)');
	});

	it('re-scales the translation terms by the element size (aspect-corrected)', () => {
		// perspectiveLeft's unit h13/h23 offset (0.041667, 0.010417) should
		// scale by width/height respectively once embedded for a real element.
		const h = getCameraHomography('perspectiveLeft')!;
		const result = homographyToMatrix3d(h, 200, 100);
		// column-4 (translation) entries are at matrix3d(...) positions 13,14
		// (1-indexed h13*, h23 after width/height scale): 0.041667*200=8.3334,
		// 0.010417*100=1.0417.
		expect(result).toContain('8.3334');
		expect(result).toContain('1.0417');
	});

	it('produces a 16-value matrix3d(...) string with the z row/column identity', () => {
		const h = getCameraHomography('perspectiveHeroicExtremeLeftFacing')!;
		const result = homographyToMatrix3d(h, 100, 100);
		const values = result.replace('matrix3d(', '').replace(')', '').split(', ').map(Number);
		expect(values).toHaveLength(16);
		// 3rd column (indices 8-11, 0-based) is the z-passthrough identity.
		expect(values.slice(8, 12)).toStrictEqual([0, 0, 1, 0]);
	});
});
