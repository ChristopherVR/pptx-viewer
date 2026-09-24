import { describe, expect, it } from 'vitest';

import { getSmartArtBevelProfile } from './smartart-3d-bevel-profile';
import { cleanRing, offsetRing, ringSignedArea, toCcwRing } from './smartart-3d-ring';
import { resolveSmartArt3DSolid } from './smartart-3d-solid';
import { buildSmartArt3DSolidGeometry } from './smartart-3d-solid-geometry';

// A 100x50 rect, clockwise (y-up) with a closing duplicate, like a flattened SVG path.
const RECT = [
	{ x: -50, y: 25 },
	{ x: 50, y: 25 },
	{ x: 50, y: -25 },
	{ x: -50, y: -25 },
	{ x: -50, y: 25 },
];

describe('smartart-3d ring helpers', () => {
	it('drops the closing duplicate and turns a ring counter-clockwise', () => {
		expect(cleanRing(RECT)).toHaveLength(4);
		const ring = toCcwRing(RECT);
		expect(ringSignedArea(ring)).toBeGreaterThan(0);
		expect(ringSignedArea(ring)).toBeCloseTo(5000, 6);
	});

	it('offsets inward for a positive distance and outward for a negative one', () => {
		const ring = toCcwRing(RECT);
		expect(ringSignedArea(offsetRing(ring, 5))).toBeCloseTo(90 * 40, 6);
		expect(ringSignedArea(offsetRing(ring, -5))).toBeCloseTo(110 * 60, 6);
	});
});

describe('getSmartArtBevelProfile', () => {
	it('runs from the outline (0,0) to the face (1,1) for every preset', () => {
		for (const name of ['circle', 'relaxedInset', 'angle', 'coolSlant', 'softRound', 'artDeco']) {
			const profile = getSmartArtBevelProfile(name);
			expect(profile[0]).toStrictEqual({ s: 0, t: 0 });
			expect(profile[profile.length - 1].s).toBeCloseTo(1, 6);
			expect(profile[profile.length - 1].t).toBeCloseTo(1, 6);
		}
	});

	it('falls back to circle for unknown tokens', () => {
		expect(getSmartArtBevelProfile('nope')).toStrictEqual(getSmartArtBevelProfile('circle'));
		expect(getSmartArtBevelProfile(undefined)).toStrictEqual(getSmartArtBevelProfile('circle'));
	});

	it('dips below the base for relaxedInset (its dark groove)', () => {
		expect(Math.min(...getSmartArtBevelProfile('relaxedInset').map((p) => p.t))).toBeLessThan(0);
	});
});

describe('resolveSmartArt3DSolid', () => {
	it('is undefined when the sp3d changes nothing', () => {
		expect(resolveSmartArt3DSolid(undefined, 50)).toBeUndefined();
		expect(resolveSmartArt3DSolid({ presetMaterial: 'metal' }, 50)).toBeUndefined();
	});

	it('uses the ECMA-376 6pt default for a bevel without w/h and clamps over-wide bevels', () => {
		const solid = resolveSmartArt3DSolid({ bevelTopType: 'angle' }, 50)!;
		expect(solid.bevelTop).toStrictEqual({ width: 8, height: 8, profile: 'angle' });
		const clamped = resolveSmartArt3DSolid({ bevelTopWidth: 952500 }, 10)!;
		expect(clamped.bevelTop?.width).toBeCloseTo(9, 6);
	});

	it('drops a `none` bevel and defaults the material to warmMatte', () => {
		const solid = resolveSmartArt3DSolid({ bevelTopType: 'none', extrusionHeight: 95250 }, 50)!;
		expect(solid.bevelTop).toBeUndefined();
		expect(solid.extrusion).toBeCloseTo(10, 6);
		expect(solid.material).toBe('warmMatte');
	});
});

describe('buildSmartArt3DSolidGeometry', () => {
	it('insets the front cap by the bevel width and tilts the top band toward +y', () => {
		const geometry = buildSmartArt3DSolidGeometry(RECT, [], {
			bevelTop: { width: 5, height: 4, profile: 'angle' },
			extrusion: 0,
			contourWidth: 0,
			material: 'matte',
		});
		expect(ringSignedArea(geometry.frontCap.ring)).toBeCloseTo(90 * 40, 6);
		expect(geometry.frontCap.z).toBe(0);
		// The bevel relief alone gives the solid thickness, so it is closed at the back.
		expect(geometry.backCap?.z).toBeCloseTo(-4, 6);
		// Band vertices on the top edge (y = 25, the outline) with the top edge's own normal.
		const { positions, normals } = geometry.body;
		let found = false;
		for (let i = 0; i < positions.length; i += 3) {
			if (Math.abs(positions[i + 1] - 25) < 1e-6 && Math.abs(normals[i]) < 1e-6) {
				expect(normals[i + 1]).toBeGreaterThan(0);
				expect(normals[i + 2]).toBeGreaterThan(0);
				expect(positions[i + 2]).toBeCloseTo(-4, 6);
				found = true;
			}
		}
		expect(found).toBeTruthy();
	});

	it('adds walls, a back cap and contour rims for an extruded, contoured solid', () => {
		const geometry = buildSmartArt3DSolidGeometry(RECT, [], {
			extrusion: 40,
			contourWidth: 4,
			material: 'matte',
		});
		expect(geometry.sides.positions.length).toBeGreaterThan(0);
		expect(geometry.backCap?.z).toBeCloseTo(-40, 6);
		expect(geometry.contourCaps).toHaveLength(2);
		expect(ringSignedArea(geometry.contourCaps[0].ring)).toBeCloseTo(108 * 58, 6);
		expect(geometry.contourCaps[0].holes).toHaveLength(1);
	});
});
