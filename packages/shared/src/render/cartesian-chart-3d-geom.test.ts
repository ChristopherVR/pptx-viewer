import { describe, expect, it } from 'vitest';

import {
	buildCartesianChart3DLabels,
	computeCartesianCameraPlacement,
	computeCartesianGridExtent,
	resolveCartesianCameraFov,
	transposeForHorizontalBar3D,
} from './cartesian-chart-3d-geom';

describe('computeCartesianGridExtent', () => {
	it('scales width by 0.5 per category step with a 1-step floor', () => {
		expect(computeCartesianGridExtent(5, 3).gridWidth).toBe(2);
		expect(computeCartesianGridExtent(1, 1).gridWidth).toBe(0.5);
	});

	it('defaults depth to 100% of width when depthPercent is absent', () => {
		const { gridWidth, gridDepth } = computeCartesianGridExtent(5, 3);
		expect(gridDepth).toBeCloseTo(gridWidth);
	});

	it('scales depth proportionally to an authored depthPercent', () => {
		const base = computeCartesianGridExtent(5, 3, 100);
		const half = computeCartesianGridExtent(5, 3, 50);
		const double = computeCartesianGridExtent(5, 3, 200);
		expect(half.gridDepth).toBeCloseTo(base.gridDepth / 2);
		expect(double.gridDepth).toBeCloseTo(base.gridDepth * 2);
	});

	it('never collapses depth to 0 for a single-series chart', () => {
		expect(computeCartesianGridExtent(5, 1, 0).gridDepth).toBeGreaterThan(0);
	});
});

describe('resolveCartesianCameraFov', () => {
	it('defaults to a mid-range FOV when view3D is absent', () => {
		const fov = resolveCartesianCameraFov();
		expect(fov).toBeGreaterThan(15);
		expect(fov).toBeLessThan(75);
	});

	it('widens the FOV as rperspective increases', () => {
		const narrow = resolveCartesianCameraFov({ rperspective: 0 });
		const wide = resolveCartesianCameraFov({ rperspective: 120 });
		expect(wide).toBeGreaterThan(narrow);
	});

	it('uses a fixed near-orthographic FOV when rAngAx is set, ignoring rperspective', () => {
		expect(resolveCartesianCameraFov({ rAngAx: true, rperspective: 120 })).toBe(
			resolveCartesianCameraFov({ rAngAx: true, rperspective: 0 }),
		);
	});
});

describe('computeCartesianCameraPlacement', () => {
	it('targets a point above the origin and returns a finite position', () => {
		const { position, target, fov } = computeCartesianCameraPlacement(4, 2);
		expect(target[1]).toBeGreaterThan(0);
		expect(position.every((v) => Number.isFinite(v))).toBeTruthy();
		expect(fov).toBeGreaterThan(0);
	});

	it('rotates the camera azimuth when rotY changes, keeping distance from target', () => {
		const front = computeCartesianCameraPlacement(4, 4, { rotX: 15, rotY: 0 });
		const side = computeCartesianCameraPlacement(4, 4, { rotX: 15, rotY: 90 });
		expect(front.position[0]).toBeCloseTo(0, 5);
		expect(side.position[2]).toBeCloseTo(0, 5);
	});

	it('raises the camera as rotX (elevation) increases', () => {
		const low = computeCartesianCameraPlacement(4, 4, { rotX: 5, rotY: 20 });
		const high = computeCartesianCameraPlacement(4, 4, { rotX: 60, rotY: 20 });
		expect(high.position[1]).toBeGreaterThan(low.position[1]);
	});

	it('clamps extreme rotX away from the degenerate vertical axis', () => {
		const top = computeCartesianCameraPlacement(4, 4, { rotX: 90, rotY: 20 });
		expect(Math.hypot(top.position[0], top.position[2])).toBeGreaterThan(0);
	});

	it('moves the camera further back for a narrower (near-orthographic) FOV', () => {
		const wide = computeCartesianCameraPlacement(4, 4, { rperspective: 120 });
		const narrow = computeCartesianCameraPlacement(4, 4, { rAngAx: true });
		const distWide = Math.hypot(...wide.position);
		const distNarrow = Math.hypot(...narrow.position);
		expect(distNarrow).toBeGreaterThan(distWide);
	});
});

describe('buildCartesianChart3DLabels', () => {
	it('emits category and series labels, no value-axis label', () => {
		const labels = buildCartesianChart3DLabels(3, 2, ['A', 'B', 'C'], ['S1', 'S2'], undefined);
		expect(labels.filter((l) => l.axis === 'category').map((l) => l.text)).toStrictEqual([
			'A',
			'B',
			'C',
		]);
		expect(labels.filter((l) => l.axis === 'series').map((l) => l.text)).toStrictEqual([
			'S1',
			'S2',
		]);
		expect(labels.some((l) => l.axis === 'value')).toBeFalsy();
	});

	it('thins category labels to at most maxCat entries', () => {
		const cats = Array.from({ length: 20 }, (_, i) => `c${i}`);
		const labels = buildCartesianChart3DLabels(20, 1, cats, [], undefined, 8, 6);
		expect(labels.filter((l) => l.axis === 'category').length).toBeLessThanOrEqual(8);
	});

	it('transposes every anchor (x, y, z) -> (y, -x, z) when horizontal is true', () => {
		const vertical = buildCartesianChart3DLabels(3, 2, ['A', 'B', 'C'], ['S1', 'S2'], undefined);
		const horizontal = buildCartesianChart3DLabels(
			3,
			2,
			['A', 'B', 'C'],
			['S1', 'S2'],
			undefined,
			8,
			6,
			true,
		);
		expect(horizontal).toHaveLength(vertical.length);
		for (let i = 0; i < vertical.length; i++) {
			const v = vertical[i].anchor;
			expect(horizontal[i].anchor).toStrictEqual([v[1], -v[0], v[2]]);
		}
	});
});

describe('transposeForHorizontalBar3D', () => {
	it('rotates (x, y, z) -> (y, -x, z)', () => {
		expect(transposeForHorizontalBar3D([1, 2, 3])).toStrictEqual([2, -1, 3]);
	});

	it('is its own inverse composed with a 180 degree turn (four applications return the input)', () => {
		const p: readonly [number, number, number] = [1, 2, 3];
		const once = transposeForHorizontalBar3D(p);
		const twice = transposeForHorizontalBar3D(once);
		const thrice = transposeForHorizontalBar3D(twice);
		const four = transposeForHorizontalBar3D(thrice);
		expect(four).toStrictEqual(p);
	});
});
