import { describe, expect, it } from 'vitest';

import { applyChart3DDepth, computeDepthVector, translateSlicePath } from './chart-3d-depth';
import type { ChartViewModel, SvgPath, SvgRect } from './chart-view-model';

function emptyVm(primitives: ChartViewModel['primitives']): ChartViewModel {
	return {
		svgWidth: 400,
		svgHeight: 300,
		title: undefined,
		titleX: 200,
		titleY: 14,
		gridlines: [],
		axisLabels: [],
		zeroLine: undefined,
		categoryLabels: [],
		primitives,
		dataLabels: [],
		legend: [],
		legendX: 200,
		legendY: 290,
		legendAnchor: 'middle',
	};
}

describe('computeDepthVector', () => {
	it('derives a non-zero oblique vector from default view3D', () => {
		const v = computeDepthVector(undefined);
		expect(v.magnitude).toBeGreaterThan(0);
		expect(v.dx).not.toBe(0);
	});

	it('scales magnitude with depthPercent (clamped)', () => {
		const small = computeDepthVector({ depthPercent: 40 });
		const large = computeDepthVector({ depthPercent: 200 });
		expect(large.magnitude).toBeGreaterThanOrEqual(small.magnitude);
	});

	it('a positive rotX tilts the depth upward (negative dy)', () => {
		const v = computeDepthVector({ rotX: 30, rotY: 20 });
		expect(v.dy).toBeLessThan(0);
	});
});

describe('translateSlicePath', () => {
	it('shifts M/L/endpoint coordinates but preserves arc radii', () => {
		const d = 'M100,100 L150,100 A50,50 0 0 1 100,150 Z';
		const out = translateSlicePath(d, 0, 10);
		expect(out).toContain('M100,110');
		expect(out).toContain('L150,110');
		// arc radii unchanged, endpoint shifted down by 10.
		expect(out).toContain('A50,50,0,0,1,100,160');
		expect(out.endsWith('Z')).toBeTruthy();
	});
});

describe('applyChart3DDepth', () => {
	const barRect: SvgRect = {
		kind: 'rect',
		x: 50,
		y: 100,
		w: 20,
		h: 80,
		fill: '#4472C4',
		part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 0 },
	};

	it('adds top + side extrusion polygons for bar3D', () => {
		const vm = applyChart3DDepth(emptyVm([barRect]), 'bar3D', undefined);
		const polys = vm.primitives.filter((p) => p.kind === 'polygon');
		expect(polys).toHaveLength(2);
		// extrusions are inserted BEHIND the front-face rect.
		expect(vm.primitives[vm.primitives.length - 1].kind).toBe('rect');
	});

	it('adds downward thickness copies for pie3D', () => {
		const slice: SvgPath = {
			kind: 'path',
			d: 'M100,100 L150,100 A50,50 0 0 1 100,150 Z',
			fill: '#ED7D31',
		};
		const vm = applyChart3DDepth(emptyVm([slice]), 'pie3D', undefined);
		const paths = vm.primitives.filter((p) => p.kind === 'path');
		expect(paths).toHaveLength(2);
	});

	it('leaves non-3D types unchanged', () => {
		const vm0 = emptyVm([barRect]);
		const vm = applyChart3DDepth(vm0, 'bar', undefined);
		expect(vm.primitives).toHaveLength(1);
	});

	it('does not tag extrusion faces as interactive parts', () => {
		const vm = applyChart3DDepth(emptyVm([barRect]), 'bar3D', undefined);
		const polys = vm.primitives.filter((p) => p.kind === 'polygon');
		for (const poly of polys) {
			expect(poly.part).toBeUndefined();
		}
	});

	it('adds no wall/floor panels when surfaces are unauthored', () => {
		const vm = applyChart3DDepth(emptyVm([barRect]), 'bar3D', undefined, {});
		// Only the 2 bar-extrusion polygons, no extra background panels.
		expect(vm.primitives.filter((p) => p.kind === 'polygon')).toHaveLength(2);
	});

	it('prepends floor/wall panels behind the extrusion for a cartesian 3D chart', () => {
		const vm = applyChart3DDepth(emptyVm([barRect]), 'bar3D', undefined, {
			floor: { spPr: { fillColor: '#CCCCCC' } },
			backWall: { spPr: { fillColor: '#DDDDDD' } },
		});
		const polys = vm.primitives.filter((p) => p.kind === 'polygon');
		// 2 background panels (floor + backWall) + 2 bar-extrusion faces.
		expect(polys).toHaveLength(4);
		expect(polys[0].fill).toBe('#DDDDDD');
		expect(polys[1].fill).toBe('#CCCCCC');
		// Panels sit behind everything, including the extrusion.
		expect(vm.primitives[vm.primitives.length - 1].kind).toBe('rect');
	});

	it('does not paint wall/floor panels for pie3D (no plot rectangle to wall in)', () => {
		const slice: SvgPath = { kind: 'path', d: 'M0,0 L10,0 A10,10 0 0 1 0,10 Z', fill: '#ED7D31' };
		const vm = applyChart3DDepth(emptyVm([slice]), 'pie3D', undefined, {
			floor: { spPr: { fillColor: '#CCCCCC' } },
		});
		expect(vm.primitives.filter((p) => p.kind === 'polygon' && p.fill === '#CCCCCC')).toHaveLength(
			0,
		);
	});
});

describe('applyChart3DDepth - clustered bar3D per-series depth staggering', () => {
	const seriesBar = (seriesIndex: number, x: number): SvgRect => ({
		kind: 'rect',
		x,
		y: 100,
		w: 20,
		h: 80,
		fill: '#4472C4',
		part: { role: 'dataPoint', seriesIndex, pointIndex: 0 },
	});

	it('gives two clustered series different depth offsets (they no longer share one plane)', () => {
		const vm = applyChart3DDepth(
			emptyVm([seriesBar(0, 10), seriesBar(1, 40)]),
			'bar3D',
			{ rotX: 15, rotY: 20 },
			undefined,
			'clustered',
		);
		const topFaces = vm.primitives.filter(
			(p): p is SvgPolygon => p.kind === 'polygon',
		) as SvgPolygon[];
		// 2 series x 2 faces (top + side) = 4 extrusion polygons.
		expect(topFaces).toHaveLength(4);
		// The two series' top faces (index 0 and 2 in back-to-front paint order)
		// must not land on identical geometry.
		expect(topFaces[0].points).not.toBe(topFaces[2].points);
	});

	it('a single-series clustered bar3D chart is unaffected by the staggering (still one shared plane)', () => {
		const staggered = applyChart3DDepth(
			emptyVm([seriesBar(0, 10)]),
			'bar3D',
			{ rotX: 15, rotY: 20 },
			undefined,
			'clustered',
		);
		const plain = applyChart3DDepth(emptyVm([seriesBar(0, 10)]), 'bar3D', { rotX: 15, rotY: 20 });
		expect(staggered.primitives).toStrictEqual(plain.primitives);
	});

	it('keeps stacked/percentStacked series coplanar (one shared depth vector)', () => {
		const stacked = applyChart3DDepth(
			emptyVm([seriesBar(0, 10), seriesBar(1, 10)]),
			'bar3D',
			{ rotX: 15, rotY: 20 },
			undefined,
			'stacked',
		);
		const polys = stacked.primitives.filter((p): p is SvgPolygon => p.kind === 'polygon');
		// Both series' top faces are offset by the identical shared vector, so
		// (given identical rect geometry here) they produce identical points.
		expect(polys[0].points).toBe(polys[2].points);
	});
});
