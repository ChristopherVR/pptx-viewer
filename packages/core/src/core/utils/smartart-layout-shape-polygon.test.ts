import { describe, expect, it } from 'vitest';

import { presetPolygonPoints } from './smartart-layout-shape-polygon';

describe('presetPolygonPoints', () => {
	it('builds a chevron via the shared chevronPoints helper', () => {
		expect(presetPolygonPoints('chevron', 0, 0, 100, 40)).toContain(',');
	});

	it('builds a 4-point trapezoid narrower at the top', () => {
		const points = presetPolygonPoints('trapezoid', 0, 0, 100, 40)
			.split(' ')
			.map((pair) => pair.split(',').map(Number));
		expect(points).toHaveLength(4);
		const topWidth = points[1]![0] - points[0]![0];
		const bottomWidth = points[2]![0] - points[3]![0];
		expect(topWidth).toBeLessThan(bottomWidth);
	});

	it('falls back to a plain rectangle outline for an unrecognised polygon preset', () => {
		expect(presetPolygonPoints('gear6', 0, 0, 10, 10)).toBe('0,0 10,0 10,10 0,10');
		expect(presetPolygonPoints(undefined, 0, 0, 10, 10)).toBe('0,0 10,0 10,10 0,10');
	});

	it('builds a 6-point hexagon', () => {
		expect(presetPolygonPoints('hexagon', 0, 0, 100, 40).split(' ')).toHaveLength(6);
	});
});
