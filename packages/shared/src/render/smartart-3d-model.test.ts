import { describe, it, expect } from 'vitest';

import {
	boundsOf,
	circleOutline,
	contrastTextColor,
	parseHex,
	parsePathPoints,
	parsePolygonPoints,
	parseViewBox,
	roundedRectOutline,
} from './smartart-3d-geom';
import { buildSmartArt3DModel } from './smartart-3d-model';
import type { SmartArtLayoutResult } from './smartart-layout-types';

describe('smartart-3d geometry helpers', () => {
	it('parses a viewBox string', () => {
		expect(parseViewBox('0 0 200 100')).toStrictEqual({ width: 200, height: 100 });
	});

	it('falls back to 1x1 for a degenerate viewBox', () => {
		expect(parseViewBox('0 0 0 0')).toStrictEqual({ width: 1, height: 1 });
	});

	it('builds a sharp rect outline of 4 points', () => {
		const o = roundedRectOutline(100, 50, 0);
		expect(o).toHaveLength(4);
		expect(o[0]).toStrictEqual({ x: -50, y: -25 });
	});

	it('builds a rounded rect outline with arc segments', () => {
		const o = roundedRectOutline(100, 50, 10, 4);
		// 4 corners * (segments + 1) points.
		expect(o).toHaveLength(20);
		// All points lie within the half-extents.
		for (const p of o) {
			expect(Math.abs(p.x)).toBeLessThanOrEqual(50.0001);
			expect(Math.abs(p.y)).toBeLessThanOrEqual(25.0001);
		}
	});

	it('clamps the corner radius to half the smaller side', () => {
		const o = roundedRectOutline(40, 20, 999, 2);
		for (const p of o) {
			expect(Math.abs(p.y)).toBeLessThanOrEqual(10.0001);
		}
	});

	it('builds a circle outline on the radius', () => {
		const o = circleOutline(10, 8);
		expect(o).toHaveLength(8);
		for (const p of o) {
			expect(Math.hypot(p.x, p.y)).toBeCloseTo(10, 5);
		}
	});

	it('parses polygon points', () => {
		expect(parsePolygonPoints('0,0 10,0 10,10')).toStrictEqual([
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
			{ x: 10, y: 10 },
		]);
	});

	it('parses an M/L path into a poly-line', () => {
		expect(parsePathPoints('M 0 0 L 10 0 L 10 10')).toStrictEqual([
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
			{ x: 10, y: 10 },
		]);
	});

	it('reduces a cubic curve command to its end point', () => {
		const pts = parsePathPoints('M0 0 C 5 5 10 5 20 0');
		expect(pts).toStrictEqual([
			{ x: 0, y: 0 },
			{ x: 20, y: 0 },
		]);
	});

	it('computes bounds and centroid', () => {
		expect(
			boundsOf([
				{ x: 0, y: 0 },
				{ x: 10, y: 4 },
			]),
		).toStrictEqual({
			cx: 5,
			cy: 2,
			width: 10,
			height: 4,
		});
	});

	it('parses hex colours and short hex', () => {
		expect(parseHex('#ff0000')).toStrictEqual([255, 0, 0]);
		expect(parseHex('#abc')).toStrictEqual([170, 187, 204]);
		expect(parseHex('not-a-colour')).toStrictEqual([128, 128, 128]);
	});

	it('picks contrasting text colours by luminance', () => {
		expect(contrastTextColor('#ffffff')).toBe('#1a1a1a');
		expect(contrastTextColor('#000000')).toBe('#ffffff');
		expect(contrastTextColor('#1f3864')).toBe('#ffffff');
	});
});

function rectLayout(): SmartArtLayoutResult {
	return {
		nodes: [
			{
				kind: 'rect',
				key: 'n1',
				x: 10,
				y: 10,
				width: 80,
				height: 40,
				rx: 6,
				fill: '#4f81bd',
				stroke: '#385d8a',
				strokeWidth: 1,
				opacity: 1,
				text: 'A',
				fontSize: 12,
				textX: 50,
				textY: 30,
			},
		],
		connectors: [{ key: 'c1', d: 'M 50 50 L 50 80' }],
		shadowFilter: undefined,
		viewBox: '0 0 200 100',
		family: 'list',
	};
}

describe('buildSmartArt3DModel', () => {
	it('converts a rect node into a centred, y-up extruded mesh', () => {
		const model = buildSmartArt3DModel(rectLayout());
		expect(model.bounds).toStrictEqual({ width: 200, height: 100 });
		expect(model.meshes).toHaveLength(1);

		const m = model.meshes[0];
		// Node centre (50, 30) in 200x100 space -> world (50-100, 50-30).
		expect(m.position).toStrictEqual({ x: -50, y: 20, z: 0 });
		expect(m.halfWidth).toBe(40);
		expect(m.halfHeight).toBe(20);
		expect(m.fill).toBe('#4f81bd');
		expect(m.rounded).toBeTruthy();
		expect(m.depth).toBeGreaterThan(0);
		expect(m.bevel).toBeGreaterThan(0);
		expect(m.textColor).toBe('#ffffff');
	});

	it('honours a fixed depth override', () => {
		const model = buildSmartArt3DModel(rectLayout(), { depth: 25, bevelRatio: 0 });
		expect(model.meshes[0].depth).toBe(25);
		expect(model.meshes[0].bevel).toBe(0);
	});

	it('flips connector points into world space (y-up)', () => {
		const model = buildSmartArt3DModel(rectLayout());
		expect(model.connectors).toHaveLength(1);
		expect(model.connectors[0].points).toStrictEqual([
			{ x: -50, y: 0, z: 0 },
			{ x: -50, y: -30, z: 0 },
		]);
	});

	it('drops degenerate polygons with fewer than 3 points', () => {
		const layout = rectLayout();
		layout.nodes = [
			{
				kind: 'polygon',
				key: 'p1',
				points: '0,0 10,0',
				fill: '#fff',
				stroke: '#000',
				strokeWidth: 1,
				opacity: 1,
				text: '',
				fontSize: 10,
				textX: 0,
				textY: 0,
			},
		];
		expect(buildSmartArt3DModel(layout).meshes).toHaveLength(0);
	});

	it('passes the background through', () => {
		const model = buildSmartArt3DModel(rectLayout(), { background: '#101010' });
		expect(model.background).toBe('#101010');
	});
});
