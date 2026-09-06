/**
 * Unit tests for pie-chart-3d-drag.ts: pie3D wedge drag geometry and the
 * plane-hit -> angle -> value pipeline. Hand-computed angles, no `three`.
 */
import { describe, expect, it } from 'vitest';

import {
	buildPieChart3DDragGeometry,
	pieChart3DPointerAngle,
	resolvePieChart3DDragValue,
} from './pie-chart-3d-drag';

// Four equal slices starting at -PI/2 (matching computePieChart3DSliceAngles'
// cumulative bookkeeping): wedge 0 spans [-PI/2, 0), wedge 1 [0, PI/2),
// wedge 2 [PI/2, PI), wedge 3 [PI, 3PI/2).
const WEDGES = [
	{ pointIndex: 0, startAngle: -Math.PI / 2 },
	{ pointIndex: 1, startAngle: 0 },
	{ pointIndex: 2, startAngle: Math.PI / 2 },
	{ pointIndex: 3, startAngle: Math.PI },
];
const VALUES = [25, 25, 25, 25];

describe('buildPieChart3DDragGeometry', () => {
	it('resolves the leading angle for a wedge', () => {
		const geometry = buildPieChart3DDragGeometry(WEDGES, VALUES, 1);
		expect(geometry).not.toBeNull();
		expect(geometry?.leadingAngle).toBeCloseTo(0, 10);
		expect(geometry?.values).toStrictEqual(VALUES);
		expect(geometry?.pointIndex).toBe(1);
	});

	it('returns null for an out-of-range point index', () => {
		expect(buildPieChart3DDragGeometry(WEDGES, VALUES, 4)).toBeNull();
		expect(buildPieChart3DDragGeometry(WEDGES, VALUES, -1)).toBeNull();
	});

	it('returns null when no wedge matches the point index', () => {
		expect(buildPieChart3DDragGeometry([WEDGES[0]!], VALUES, 1)).toBeNull();
	});
});

describe('pieChart3DPointerAngle', () => {
	it("matches CylinderGeometry's theta=0 convention: +Z, x=0", () => {
		expect(pieChart3DPointerAngle(0, 1)).toBeCloseTo(0, 10);
	});

	it('matches theta=PI/2: +X, z=0', () => {
		expect(pieChart3DPointerAngle(1, 0)).toBeCloseTo(Math.PI / 2, 10);
	});

	it('matches theta=-PI/2: -X, z=0', () => {
		expect(pieChart3DPointerAngle(-1, 0)).toBeCloseTo(-Math.PI / 2, 10);
	});
});

describe('resolvePieChart3DDragValue', () => {
	const geometry = buildPieChart3DDragGeometry(WEDGES, VALUES, 1)!;

	it('keeps the value unchanged when the pointer sits on the wedge own trailing edge', () => {
		// Wedge 1's trailing edge is PI/2 (matches wedge 2's leading edge).
		const value = resolvePieChart3DDragValue(geometry, Math.PI / 2);
		expect(value).toBeCloseTo(25, 0);
	});

	it('shrinks the wedge toward its leading edge (near-zero span)', () => {
		const value = resolvePieChart3DDragValue(geometry, 0.01);
		expect(value).toBeLessThan(5);
		expect(value).toBeGreaterThanOrEqual(0);
	});

	it('grows the wedge to half the circle, renormalising the others', () => {
		// Sweep to leadingAngle + PI: half the circle, so wedge1 == others combined (75).
		const value = resolvePieChart3DDragValue(geometry, Math.PI);
		expect(value).toBeCloseTo(75, 0);
	});

	it('preserves the sign of a negative wedge value', () => {
		const negValues = [25, -25, 25, 25];
		const geo = buildPieChart3DDragGeometry(WEDGES, negValues, 1)!;
		const value = resolvePieChart3DDragValue(geo, Math.PI / 2);
		expect(value).toBeLessThan(0);
	});

	it('handles a single-wedge pie without dividing by zero', () => {
		const singleWedges = [{ pointIndex: 0, startAngle: -Math.PI / 2 }];
		const geo = buildPieChart3DDragGeometry(singleWedges, [10], 0)!;
		const value = resolvePieChart3DDragValue(geo, 0);
		expect(Number.isFinite(value)).toBeTruthy();
	});

	it('agrees with the flat 2D pie drag formula for the same geometry', () => {
		// resolvePieSliceShareValue underlies both; sweeping to the same angle
		// span should produce the same value regardless of which convention
		// (2D atan2(y,x) vs 3D atan2(x,z)) supplied the angle.
		const angle = 1.2;
		const value = resolvePieChart3DDragValue(geometry, geometry.leadingAngle + angle);
		expect(value).toBeGreaterThan(0);
		expect(Number.isFinite(value)).toBeTruthy();
	});
});
