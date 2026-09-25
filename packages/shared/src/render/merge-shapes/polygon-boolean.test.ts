import { describe, expect, it } from 'vitest';

import { booleanRegions, regionArea, splitRegionComponents } from './polygon-boolean';
import type { PolygonLoop } from './polygon-types';
import { signedLoopArea } from './polygon-types';

function square(x: number, y: number, size: number): PolygonLoop {
	return [
		{ x, y },
		{ x: x + size, y },
		{ x: x + size, y: y + size },
		{ x, y: y + size },
	];
}

const a = [square(0, 0, 2)];
const b = [square(1, 1, 2)];

describe('booleanRegions', () => {
	it('unions two overlapping squares into one outline', () => {
		const result = booleanRegions('union', a, b);
		expect(result).toHaveLength(1);
		expect(regionArea(result)).toBeCloseTo(7);
		// An L-plus-square outline has eight corners once collinear points go.
		expect(result[0]).toHaveLength(8);
	});

	it('intersects, subtracts and xors', () => {
		expect(regionArea(booleanRegions('intersect', a, b))).toBeCloseTo(1);
		expect(regionArea(booleanRegions('subtract', a, b))).toBeCloseTo(3);
		expect(regionArea(booleanRegions('xor', a, b))).toBeCloseTo(6);
	});

	it('returns nothing for the intersection of disjoint shapes', () => {
		expect(booleanRegions('intersect', a, [square(5, 5, 1)])).toStrictEqual([]);
	});

	it('keeps disjoint shapes as separate loops in a union', () => {
		const result = booleanRegions('union', a, [square(5, 5, 1)]);
		expect(result).toHaveLength(2);
		expect(regionArea(result)).toBeCloseTo(5);
	});

	it('punches a hole when subtracting a shape fully inside', () => {
		const result = booleanRegions('subtract', [square(0, 0, 4)], [square(1, 1, 2)]);
		expect(result).toHaveLength(2);
		expect(regionArea(result)).toBeCloseTo(12);
		const areas = result.map((loop) => signedLoopArea(loop)).sort((x, y) => x - y);
		expect(areas[0]).toBeLessThan(0);
		expect(areas[1]).toBeGreaterThan(0);
	});

	it('handles shared edges and a concave clip', () => {
		// Two squares sharing an edge union into one rectangle.
		const rect = booleanRegions('union', [square(0, 0, 1)], [square(1, 0, 1)]);
		expect(rect).toHaveLength(1);
		expect(rect[0]).toHaveLength(4);
		// A U-shape clip: Sutherland-Hodgman gets this wrong, the arrangement does not.
		const u: PolygonLoop = [
			{ x: 0, y: 0 },
			{ x: 3, y: 0 },
			{ x: 3, y: 3 },
			{ x: 2, y: 3 },
			{ x: 2, y: 1 },
			{ x: 1, y: 1 },
			{ x: 1, y: 3 },
			{ x: 0, y: 3 },
		];
		const bar = [square(0, 2, 3).map((p) => ({ x: p.x, y: p.y - 0.5 }))];
		// The bar covers y 1.5..3 of both prongs (1 wide each), never the notch.
		const prongs = booleanRegions('intersect', [u], bar);
		expect(prongs).toHaveLength(2);
		expect(regionArea(prongs)).toBeCloseTo(3);
	});

	it('treats input orientation as irrelevant (even-odd)', () => {
		const reversed = [square(1, 1, 2).reverse()];
		expect(regionArea(booleanRegions('union', a, reversed))).toBeCloseTo(7);
	});
});

describe('splitRegionComponents', () => {
	it('keeps a hole with its owner and separates disjoint pieces', () => {
		const framed = booleanRegions('subtract', [square(0, 0, 4)], [square(1, 1, 2)]);
		const island = booleanRegions('union', [square(10, 0, 1)], []);
		const parts = splitRegionComponents([...framed, ...island]);
		expect(parts).toHaveLength(2);
		expect(parts.map((part) => part.length).sort()).toStrictEqual([1, 2]);
	});
});
