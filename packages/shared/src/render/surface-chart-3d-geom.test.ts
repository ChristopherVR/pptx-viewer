import { describe, expect, it } from 'vitest';

import {
	buildSurfaceLabels,
	computeCameraPlacement,
	computeGridExtent,
	MAX_HEIGHT,
	surfaceVertexWorldPosition,
} from './surface-chart-3d-geom';

describe('computeGridExtent', () => {
	it('scales width/depth by 0.5 per grid step with a 1-step floor', () => {
		expect(computeGridExtent(5, 3)).toStrictEqual({ gridWidth: 2, gridDepth: 1 });
	});

	it('clamps a single row/col to one step so extents never collapse to 0', () => {
		expect(computeGridExtent(1, 1)).toStrictEqual({ gridWidth: 0.5, gridDepth: 0.5 });
	});
});

describe('surfaceVertexWorldPosition', () => {
	const heightMap = new Float32Array([0, 0.5, 1, 0.25]); // 2x2 grid, row-major

	it('places (0, 0) at the near-left corner with its own height', () => {
		expect(surfaceVertexWorldPosition(2, 2, 0, 0, heightMap)).toStrictEqual([-0.25, 0, -0.25]);
	});

	it('places (1, 1) at the far-right corner, height scaled by MAX_HEIGHT', () => {
		const [x, y, z] = surfaceVertexWorldPosition(2, 2, 1, 1, heightMap);
		expect(x).toBeCloseTo(0.25);
		expect(y).toBeCloseTo(0.25 * MAX_HEIGHT);
		expect(z).toBeCloseTo(0.25);
	});

	it('matches the corner anchor buildSurfaceLabels uses for the same grid', () => {
		// col varies along x the same way the category-label loop does.
		const [x0] = surfaceVertexWorldPosition(2, 2, 0, 0, heightMap);
		const [x1] = surfaceVertexWorldPosition(2, 2, 0, 1, heightMap);
		const { gridWidth } = computeGridExtent(2, 2);
		expect(x1 - x0).toBeCloseTo(gridWidth);
	});

	it('defaults to height 0 for an out-of-range index', () => {
		const [, y] = surfaceVertexWorldPosition(3, 3, 2, 2, heightMap);
		expect(y).toBe(0);
	});
});

describe('buildSurfaceLabels', () => {
	it('emits category, series, and a single value label', () => {
		const labels = buildSurfaceLabels(3, 2, ['A', 'B', 'C'], ['S1', 'S2']);
		const cat = labels.filter((l) => l.axis === 'category');
		const ser = labels.filter((l) => l.axis === 'series');
		const val = labels.filter((l) => l.axis === 'value');
		expect(cat.map((l) => l.text)).toStrictEqual(['A', 'B', 'C']);
		expect(ser.map((l) => l.text)).toStrictEqual(['S1', 'S2']);
		expect(val).toHaveLength(1);
		expect(val[0].text).toBe('Value');
	});

	it('thins category labels to at most maxCat entries', () => {
		const cats = Array.from({ length: 20 }, (_, i) => `c${i}`);
		const labels = buildSurfaceLabels(20, 1, cats, [], 8, 6);
		const cat = labels.filter((l) => l.axis === 'category');
		expect(cat.length).toBeLessThanOrEqual(8);
		// First label is always kept.
		expect(cat[0].text).toBe('c0');
	});

	it('gives each label a stable, unique key', () => {
		const labels = buildSurfaceLabels(3, 2, ['A', 'B', 'C'], ['S1', 'S2']);
		const keys = labels.map((l) => l.key);
		expect(new Set(keys).size).toBe(keys.length);
	});
});

describe('computeCameraPlacement', () => {
	it('positions the camera at an isometric offset framing the grid when view3D is absent', () => {
		const { position, target } = computeCameraPlacement(5, 5);
		expect(target).toStrictEqual([0, 0.3, 0]);
		// Symmetric x/z offset, lower y -> isometric-like view.
		expect(position[0]).toBeCloseTo(position[2]);
		expect(position[1]).toBeLessThan(position[0]);
		expect(position[0]).toBeGreaterThan(0);
	});

	it('keeps the fixed isometric offset when view3D has neither rotX nor rotY', () => {
		const withoutView3D = computeCameraPlacement(5, 5);
		const withEmptyView3D = computeCameraPlacement(5, 5, {});
		expect(withEmptyView3D).toStrictEqual(withoutView3D);
	});

	it('rotates the camera azimuth when rotY changes, keeping distance from target', () => {
		const front = computeCameraPlacement(5, 5, { rotX: 15, rotY: 0 });
		const side = computeCameraPlacement(5, 5, { rotX: 15, rotY: 90 });
		// rotY=0 looks straight down +Z (no lateral offset); rotY=90 looks down +X.
		expect(front.position[0]).toBeCloseTo(0, 5);
		expect(front.position[2]).toBeGreaterThan(0);
		expect(side.position[2]).toBeCloseTo(0, 5);
		expect(side.position[0]).toBeGreaterThan(0);
		const distFront = Math.hypot(...front.position);
		const distSide = Math.hypot(...side.position);
		expect(distFront).toBeCloseTo(distSide, 5);
	});

	it('raises the camera as rotX (elevation) increases', () => {
		const low = computeCameraPlacement(5, 5, { rotX: 5, rotY: 20 });
		const high = computeCameraPlacement(5, 5, { rotX: 60, rotY: 20 });
		expect(high.position[1]).toBeGreaterThan(low.position[1]);
	});

	it('clamps extreme rotX away from the degenerate vertical axis', () => {
		const top = computeCameraPlacement(5, 5, { rotX: 90, rotY: 20 });
		expect(Number.isFinite(top.position[0])).toBeTruthy();
		expect(Number.isFinite(top.position[2])).toBeTruthy();
		expect(Math.hypot(top.position[0], top.position[2])).toBeGreaterThan(0);
	});

	it('normalises rotY outside [0, 360) to the same position as its wrapped value', () => {
		const wrapped = computeCameraPlacement(5, 5, { rotX: 15, rotY: 380 });
		const equivalent = computeCameraPlacement(5, 5, { rotX: 15, rotY: 20 });
		expect(wrapped.position[0]).toBeCloseTo(equivalent.position[0], 10);
		expect(wrapped.position[2]).toBeCloseTo(equivalent.position[2], 10);
	});
});
