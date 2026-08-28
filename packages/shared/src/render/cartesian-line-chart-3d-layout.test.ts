import { describe, expect, it } from 'vitest';

import type { CartesianLine3DPoint } from './cartesian-line-chart-3d-layout';
import {
	buildAreaRibbonTriangles,
	layoutCartesianLine3DSeries,
} from './cartesian-line-chart-3d-layout';
import type { ValueRange } from './chart-view-model';

const RANGE: ValueRange = { min: 0, max: 100, span: 100 };

function point(seriesIndex: number, categoryIndex: number, value: number): CartesianLine3DPoint {
	return { seriesIndex, categoryIndex, value, color: `#${seriesIndex}${categoryIndex}0000` };
}

describe('layoutCartesianLine3DSeries', () => {
	it('groups points into one path per series, sorted by category', () => {
		const points = [point(0, 1, 20), point(0, 0, 10), point(1, 0, 5)];
		const paths = layoutCartesianLine3DSeries(points, 2, 2, RANGE, undefined);
		expect(paths).toHaveLength(2);
		expect(paths[0].seriesIndex).toBe(0);
		expect(paths[0].vertices.map((v) => v.categoryIndex)).toStrictEqual([0, 1]);
		expect(paths[1].seriesIndex).toBe(1);
	});

	it('gives every series its own Z (depth) plane', () => {
		const points = [point(0, 0, 10), point(0, 1, 10), point(1, 0, 10), point(1, 1, 10)];
		const paths = layoutCartesianLine3DSeries(points, 2, 2, RANGE, undefined);
		const s0Z = new Set(paths[0].vertices.map((v) => v.position[2]));
		const s1Z = new Set(paths[1].vertices.map((v) => v.position[2]));
		expect(s0Z.size).toBe(1);
		expect(s1Z.size).toBe(1);
		expect([...s0Z][0]).not.toBeCloseTo([...s1Z][0]);
		expect(paths[0].depthZ).toBeCloseTo([...s0Z][0]);
	});

	it('positions category vertices along X in ascending order, matching the axis-label anchor formula', () => {
		const points = [point(0, 0, 10), point(0, 1, 10), point(0, 2, 10)];
		const paths = layoutCartesianLine3DSeries(points, 3, 1, RANGE, undefined);
		const xs = paths[0].vertices.map((v) => v.position[0]);
		expect(xs[0]).toBeLessThan(xs[1]);
		expect(xs[1]).toBeLessThan(xs[2]);
		// Symmetric around 0 for an evenly spaced 3-category axis.
		expect(xs[0]).toBeCloseTo(-xs[2]);
		expect(xs[1]).toBeCloseTo(0);
	});

	it('a single-category series places its one vertex at the grid X anchor (matches buildCartesianChart3DLabels)', () => {
		const points = [point(0, 0, 10)];
		const paths = layoutCartesianLine3DSeries(points, 1, 1, RANGE, undefined);
		// Same formula as buildCartesianChart3DLabels: -gridWidth/2 + (0/max(cols-1,1))*gridWidth.
		expect(paths[0].vertices[0].position[0]).toBe(-0.25);
	});

	it('taller values get a taller Y', () => {
		const points = [point(0, 0, 10), point(0, 1, 90)];
		const paths = layoutCartesianLine3DSeries(points, 2, 1, RANGE, undefined);
		expect(paths[0].vertices[1].position[1]).toBeGreaterThan(paths[0].vertices[0].position[1]);
	});

	it('never stacks: each series keeps its own authored value regardless of overlap', () => {
		const points = [point(0, 0, 80), point(1, 0, 80)];
		const paths = layoutCartesianLine3DSeries(points, 1, 2, RANGE, undefined);
		expect(paths[0].vertices[0].value).toBe(80);
		expect(paths[1].vertices[0].value).toBe(80);
		// Same Y (same value) but different Z (different plane).
		expect(paths[0].vertices[0].position[1]).toBeCloseTo(paths[1].vertices[0].position[1]);
		expect(paths[0].vertices[0].position[2]).not.toBeCloseTo(paths[1].vertices[0].position[2]);
	});

	it('resolves baselineY from the value range (value = 0 -> baseline)', () => {
		const points = [point(0, 0, 50)];
		const negRange: ValueRange = { min: -50, max: 50, span: 100 };
		const paths = layoutCartesianLine3DSeries(points, 1, 1, negRange, undefined);
		// value 0 sits at the midpoint of MAX_VALUE_HEIGHT for a symmetric range,
		// strictly below the plotted point's own (positive-value) height.
		expect(paths[0].baselineY).toBeGreaterThan(0);
		expect(paths[0].baselineY).toBeCloseTo(0.75);
		expect(paths[0].baselineY).toBeLessThan(paths[0].vertices[0].position[1]);
	});

	it('a series with no points is absent from the result', () => {
		const points = [point(0, 0, 10)];
		const paths = layoutCartesianLine3DSeries(points, 1, 2, RANGE, undefined);
		expect(paths).toHaveLength(1);
		expect(paths[0].seriesIndex).toBe(0);
	});

	it('depth plane spacing widens with depthPercent', () => {
		const points = [point(0, 0, 10), point(1, 0, 10)];
		const narrow = layoutCartesianLine3DSeries(points, 2, 2, RANGE, 20);
		const wide = layoutCartesianLine3DSeries(points, 2, 2, RANGE, 200);
		const narrowGap = Math.abs(narrow[1].depthZ - narrow[0].depthZ);
		const wideGap = Math.abs(wide[1].depthZ - wide[0].depthZ);
		expect(wideGap).toBeGreaterThan(narrowGap);
	});
});

describe('buildAreaRibbonTriangles', () => {
	it('returns an empty array for a single-vertex path (no segment to fill)', () => {
		const paths = layoutCartesianLine3DSeries([point(0, 0, 10)], 1, 1, RANGE, undefined);
		expect(buildAreaRibbonTriangles(paths[0])).toStrictEqual([]);
	});

	it('emits 2 triangles (18 numbers) per segment', () => {
		const points = [point(0, 0, 10), point(0, 1, 20), point(0, 2, 30)];
		const paths = layoutCartesianLine3DSeries(points, 3, 1, RANGE, undefined);
		const triangles = buildAreaRibbonTriangles(paths[0]);
		// 2 segments (3 vertices) x 2 triangles x 3 vertices x 3 components.
		expect(triangles).toHaveLength(2 * 2 * 3 * 3);
	});

	it('every ribbon vertex is either at a path vertex Y or at the baseline Y', () => {
		const points = [point(0, 0, 10), point(0, 1, 20)];
		const paths = layoutCartesianLine3DSeries(points, 2, 1, RANGE, undefined);
		const triangles = buildAreaRibbonTriangles(paths[0]);
		const ys = new Set<number>();
		for (let i = 1; i < triangles.length; i += 3) {
			ys.add(Math.round(triangles[i] * 1000) / 1000);
		}
		const expected = new Set(
			[paths[0].baselineY, ...paths[0].vertices.map((v) => v.position[1])].map(
				(n) => Math.round(n * 1000) / 1000,
			),
		);
		expect([...ys].every((y) => expected.has(y))).toBeTruthy();
	});
});
