import { describe, expect, it } from 'vitest';

import {
	buildSurfaceLabels,
	computeCameraPlacement,
	computeGridExtent,
} from './surface-chart-3d-geom';

describe('computeGridExtent', () => {
	it('scales width/depth by 0.5 per grid step with a 1-step floor', () => {
		expect(computeGridExtent(5, 3)).toStrictEqual({ gridWidth: 2, gridDepth: 1 });
	});

	it('clamps a single row/col to one step so extents never collapse to 0', () => {
		expect(computeGridExtent(1, 1)).toStrictEqual({ gridWidth: 0.5, gridDepth: 0.5 });
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
	it('positions the camera at an isometric offset framing the grid', () => {
		const { position, target } = computeCameraPlacement(5, 5);
		expect(target).toStrictEqual([0, 0.3, 0]);
		// Symmetric x/z offset, lower y -> isometric-like view.
		expect(position[0]).toBeCloseTo(position[2]);
		expect(position[1]).toBeLessThan(position[0]);
		expect(position[0]).toBeGreaterThan(0);
	});
});
