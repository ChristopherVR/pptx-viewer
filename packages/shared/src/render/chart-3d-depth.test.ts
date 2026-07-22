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
});
