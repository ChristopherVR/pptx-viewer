/**
 * Preset geometry must land inside the shape box it is evaluated for.
 *
 * Two defects found while auditing the evaluator behind issue #132:
 *
 *  1. `<a:path w="…" h="…">` declares the coordinate space a path's commands are
 *     authored in. The evaluator never read it, so the three presets traced from
 *     the legacy 21600x21600 drawing grid (`lightningBolt`, `irregularSeal1`,
 *     `irregularSeal2`) emitted raw 21600-unit coordinates into a shape a couple
 *     of hundred pixels wide - roughly 216x outside their own box, i.e. nothing
 *     visible at all.
 *  2. `hexagon` used its `shd2` guide directly as the half-height instead of the
 *     spec's `sin shd2 3600000`, putting the top and bottom vertices ~7.7% of the
 *     height outside the box at every size, and derived its text rect from an
 *     ad-hoc guide that returned a right edge left of its left edge.
 */
import { describe, it, expect } from 'vitest';

import { PRESET_SHAPE_GEOMETRY_TABLE } from './preset-shape-definitions-table';
import { evaluatePresetShape } from './preset-shape-evaluator';

/** Extremes of the on-curve points of an evaluated path. */
function bounds(svgPath: string): { minX: number; maxX: number; minY: number; maxY: number } {
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (const token of svgPath.match(/[MLCQZA][^MLCQZA]*/gu) ?? []) {
		const command = token[0];
		const nums = (token.slice(1).match(/-?[\d.]+(?:e-?\d+)?/giu) ?? []).map(Number);
		if (command === 'Z') {
			continue;
		}
		// Only the trailing (x, y) of an arc is an on-curve point.
		const pairs: number[][] =
			command === 'A'
				? nums.flatMap((_, i) => (i % 7 === 0 ? [[nums[i + 5], nums[i + 6]]] : []))
				: nums.flatMap((_, i) => (i % 2 === 0 ? [[nums[i], nums[i + 1]]] : []));
		for (const [x, y] of pairs) {
			if (!Number.isFinite(x) || !Number.isFinite(y)) {
				continue;
			}
			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x);
			minY = Math.min(minY, y);
			maxY = Math.max(maxY, y);
		}
	}
	return { minX, maxX, minY, maxY };
}

describe('preset paths that declare their own coordinate space', () => {
	const pathSpacePresets = ['lightningBolt', 'irregularSeal1', 'irregularSeal2'] as const;

	it.each(pathSpacePresets)('%s is scaled into the shape box', (name) => {
		const result = evaluatePresetShape(name, 200, 100);
		expect(result?.svgPath).toBeTruthy();
		const box = bounds(String(result?.svgPath));
		// Before the fix these ran 0..21600 on both axes.
		expect(box.minX).toBeGreaterThanOrEqual(-0.5);
		expect(box.maxX).toBeLessThanOrEqual(200.5);
		expect(box.minY).toBeGreaterThanOrEqual(-0.5);
		expect(box.maxY).toBeLessThanOrEqual(100.5);
	});

	it.each(pathSpacePresets)('%s tracks the shape size', (name) => {
		const small = bounds(String(evaluatePresetShape(name, 100, 100)?.svgPath));
		const wide = bounds(String(evaluatePresetShape(name, 400, 100)?.svgPath));
		expect(wide.maxX / small.maxX).toBeCloseTo(4, 1);
		expect(wide.maxY).toBeCloseTo(small.maxY, 1);
	});

	it('places the irregular seal text rect inside the shape', () => {
		// `<a:rect>` is a sibling of `<a:pathLst>`, so it is read in SHAPE units
		// even for a path that declares its own space. Left as bare 21600-unit
		// literals it landed thousands of pixels away.
		const rect = evaluatePresetShape('irregularSeal1', 200, 100)?.textRect;
		expect(rect).toBeDefined();
		expect(rect!.l).toBeGreaterThan(0);
		expect(rect!.r).toBeLessThan(200);
		expect(rect!.t).toBeGreaterThan(0);
		expect(rect!.b).toBeLessThan(100);
		expect(rect!.r).toBeGreaterThan(rect!.l);
		expect(rect!.b).toBeGreaterThan(rect!.t);
	});

	it('leaves a shape whose commands are already in box units alone', () => {
		// `heart`'s gdLst pre-divides the ECMA 21600 constants by w/h, so its path
		// is already in shape units; scaling it again collapsed it to a ~1px smear.
		const box = bounds(String(evaluatePresetShape('heart', 200, 100)?.svgPath));
		expect(box.maxY).toBeCloseTo(100, 1);
		expect(box.maxX).toBeGreaterThan(50);
	});
});

describe('hexagon', () => {
	it('puts its top and bottom vertices on the box edges', () => {
		for (const [w, h] of [
			[200, 100],
			[100, 100],
			[100, 200],
		]) {
			const box = bounds(String(evaluatePresetShape('hexagon', w, h)?.svgPath));
			expect(box.minY, `${w}x${h}`).toBeCloseTo(0, 2);
			expect(box.maxY, `${w}x${h}`).toBeCloseTo(h, 2);
			expect(box.minX, `${w}x${h}`).toBeCloseTo(0, 2);
			expect(box.maxX, `${w}x${h}`).toBeCloseTo(w, 2);
		}
	});

	it('widens its slanted ends with the adjustment', () => {
		const shallow = String(evaluatePresetShape('hexagon', 200, 100, { adj: 10000 })?.svgPath);
		const deep = String(evaluatePresetShape('hexagon', 200, 100, { adj: 45000 })?.svgPath);
		const firstVertexX = (path: string) => Number(/L ([\d.]+) /u.exec(path)?.[1]);
		expect(firstVertexX(deep)).toBeGreaterThan(firstVertexX(shallow));
	});

	it('derives a text rect that is actually a rectangle', () => {
		const rect = evaluatePresetShape('hexagon', 200, 100)?.textRect;
		expect(rect).toBeDefined();
		// The ad-hoc guide produced r < l (an inside-out rect).
		expect(rect!.r).toBeGreaterThan(rect!.l);
		expect(rect!.l).toBeCloseTo(25, 1);
		expect(rect!.r).toBeCloseTo(175, 1);
	});
});

describe('preset table sanity', () => {
	it('never emits coordinates in a foreign unit space', () => {
		// A cheap catch-all: no preset should produce a coordinate an order of
		// magnitude past its own box. Curve control points may sit outside the
		// box, so only a gross overshoot is flagged.
		const offenders: string[] = [];
		for (const name of Object.keys(PRESET_SHAPE_GEOMETRY_TABLE)) {
			const path = evaluatePresetShape(name, 200, 100)?.svgPath;
			if (!path) {
				continue;
			}
			const box = bounds(path);
			if (box.maxX > 2000 || box.maxY > 1000 || box.minX < -2000 || box.minY < -1000) {
				offenders.push(name);
			}
		}
		expect(offenders).toStrictEqual([]);
	});
});
