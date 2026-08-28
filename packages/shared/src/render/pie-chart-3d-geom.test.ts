import { describe, expect, it } from 'vitest';

import {
	computePieChart3DCameraPlacement,
	computePieChart3DSliceAngles,
	computePieChart3DThickness,
	PIE_RADIUS,
} from './pie-chart-3d-geom';

describe('computePieChart3DThickness', () => {
	it('defaults to the base thickness ratio when hPercent is absent', () => {
		expect(computePieChart3DThickness()).toBeCloseTo(PIE_RADIUS * 0.3);
	});

	it('scales thickness proportionally to hPercent', () => {
		const base = computePieChart3DThickness({ hPercent: 100 });
		const half = computePieChart3DThickness({ hPercent: 50 });
		const double = computePieChart3DThickness({ hPercent: 200 });
		expect(half).toBeCloseTo(base / 2);
		expect(double).toBeCloseTo(base * 2);
	});

	it('clamps an extreme hPercent instead of collapsing or exploding', () => {
		expect(computePieChart3DThickness({ hPercent: 0 })).toBeGreaterThan(0);
		expect(computePieChart3DThickness({ hPercent: 5000 })).toBeLessThan(PIE_RADIUS * 3.1);
	});
});

describe('computePieChart3DCameraPlacement', () => {
	it('targets a point above the origin and returns a finite position', () => {
		const { position, target, fov } = computePieChart3DCameraPlacement();
		expect(target[1]).toBeGreaterThanOrEqual(0);
		expect(position.every((v) => Number.isFinite(v))).toBeTruthy();
		expect(fov).toBeGreaterThan(0);
	});

	it('rotates the camera azimuth when rotY changes', () => {
		const front = computePieChart3DCameraPlacement({ rotX: 15, rotY: 0 });
		const side = computePieChart3DCameraPlacement({ rotX: 15, rotY: 90 });
		expect(front.position[0]).toBeCloseTo(0, 5);
		expect(side.position[2]).toBeCloseTo(0, 5);
	});

	it('raises the camera as rotX (elevation) increases', () => {
		const low = computePieChart3DCameraPlacement({ rotX: 5, rotY: 20 });
		const high = computePieChart3DCameraPlacement({ rotX: 60, rotY: 20 });
		expect(high.position[1]).toBeGreaterThan(low.position[1]);
	});
});

describe('computePieChart3DSliceAngles', () => {
	it('splits a full circle proportionally to values', () => {
		const angles = computePieChart3DSliceAngles([1, 1, 2], undefined, undefined, PIE_RADIUS);
		expect(angles).toHaveLength(3);
		expect(angles[0].thetaLength).toBeCloseTo(Math.PI / 2);
		expect(angles[1].thetaLength).toBeCloseTo(Math.PI / 2);
		expect(angles[2].thetaLength).toBeCloseTo(Math.PI);
		const total = angles.reduce((s, a) => s + a.thetaLength, 0);
		expect(total).toBeCloseTo(Math.PI * 2);
	});

	it('starts the first slice at -PI/2 (12 oclock) by default', () => {
		const angles = computePieChart3DSliceAngles([1, 1], undefined, undefined, PIE_RADIUS);
		expect(angles[0].startAngle).toBeCloseTo(-Math.PI / 2);
	});

	it('rotates the start angle by firstSliceAngleDeg', () => {
		const angles = computePieChart3DSliceAngles([1, 1], undefined, 90, PIE_RADIUS);
		expect(angles[0].startAngle).toBeCloseTo(-Math.PI / 2 + Math.PI / 2);
	});

	it('chains slices end-to-end with no gaps', () => {
		const angles = computePieChart3DSliceAngles([1, 2, 3], undefined, undefined, PIE_RADIUS);
		for (let i = 1; i < angles.length; i++) {
			const prevEnd = angles[i - 1].startAngle + angles[i - 1].thetaLength;
			expect(angles[i].startAngle).toBeCloseTo(prevEnd);
		}
	});

	it('applies no explosion offset by default', () => {
		const angles = computePieChart3DSliceAngles([1, 1], undefined, undefined, PIE_RADIUS);
		for (const a of angles) {
			expect(a.explodeOffset).toStrictEqual([0, 0]);
		}
	});

	it('pulls an exploded slice outward along its bisector, scaled by outerRadius', () => {
		const angles = computePieChart3DSliceAngles([1, 1, 1, 1], [0, 0, 50, 0], undefined, 2);
		const exploded = angles[2];
		const [ox, oz] = exploded.explodeOffset;
		const dist = Math.hypot(ox, oz);
		expect(dist).toBeCloseTo(2 * 0.5);
	});

	it('treats values by magnitude (negative values still get a positive sweep)', () => {
		const angles = computePieChart3DSliceAngles([-1, 1], undefined, undefined, PIE_RADIUS);
		expect(angles[0].thetaLength).toBeCloseTo(Math.PI);
		expect(angles[1].thetaLength).toBeCloseTo(Math.PI);
	});

	it('collapses every slice to a zero sweep when every value is 0, matching computePieSlices', () => {
		const angles = computePieChart3DSliceAngles([0, 0], undefined, undefined, PIE_RADIUS);
		expect(angles[0].thetaLength).toBe(0);
		expect(angles[1].thetaLength).toBe(0);
	});
});
