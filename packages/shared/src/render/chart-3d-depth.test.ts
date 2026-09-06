import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { applyChart3DDepth, computeDepthVector, translateSlicePath } from './chart-3d-depth';
import { resolveUntargetedBarFaceFill } from './chart-bar3d-face-picture';
import {
	ensureBarFacePicturePixelSampled,
	resetBarFacePicturePixelCacheForTests,
} from './chart-bar3d-face-picture-sample';
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

	it('leaves the pie perfectly round when no pieCenter is supplied (backward compatible)', () => {
		const slice: SvgPath = {
			kind: 'path',
			d: 'M200,150 L250,150 A50,50 0 0 1 200,200 Z',
			fill: '#ED7D31',
		};
		const vm = applyChart3DDepth(emptyVm([slice]), 'pie3D', { rotX: 45 });
		const frontSlice = vm.primitives.find(
			(p): p is SvgPath => p.kind === 'path' && p.fill === '#ED7D31',
		);
		expect(frontSlice?.d).toBe(slice.d);
	});

	it('squashes the pie face and its extrusion vertically when pieCenter + rotX are given', () => {
		const slice: SvgPath = {
			kind: 'path',
			d: 'M200,150 L250,150 A50,50 0 0 1 200,200 Z',
			fill: '#ED7D31',
		};
		const vm = applyChart3DDepth(emptyVm([slice]), 'pie3D', { rotX: 60 }, undefined, undefined, {
			cx: 200,
			cy: 150,
		});
		const frontSlice = vm.primitives.find(
			(p): p is SvgPath => p.kind === 'path' && p.fill === '#ED7D31',
		);
		// rotX=60 -> scaleY = cos(60deg) = 0.5; endpoint y=200 (50 below cy=150) -> 175.
		expect(frontSlice?.d).toMatch(/A50,25(\.\d+)?,0,0,1,200,175(\.\d+)?/u);
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

// C2-G9 3-D face-targeting half: a `bar3D` point's/series' picture fill
// (`c:pictureOptions`) must paint only the faces `applyToFront`/`Sides`/`End`
// select, leaving the rest on their tinted/shaded solid fill.
describe('applyChart3DDepth - bar3D picture-fill face targeting', () => {
	const barRect: SvgRect = {
		kind: 'rect',
		x: 50,
		y: 100,
		w: 20,
		h: 80,
		fill: '#4472C4',
		part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 0 },
	};

	function seriesWithPicture(picture: Record<string, unknown>) {
		return [{ dataPoints: [{ idx: 0, picture: { imageUrl: 'data:image/png;x', ...picture } }] }];
	}

	it('paints both side and end faces when no applyTo* flags are set (COM: absent = all faces)', () => {
		const vm = applyChart3DDepth(
			emptyVm([barRect]),
			'bar3D',
			undefined,
			undefined,
			undefined,
			undefined,
			{
				series: seriesWithPicture({}),
				elementId: 'chart1',
			},
		);
		const [topFace, sideFace] = vm.primitives.filter((p): p is SvgPolygon => p.kind === 'polygon');
		expect(topFace.fill).toMatch(/^url\(#chart1-chart-dpt-pic-0-0-end\)$/u);
		expect(sideFace.fill).toMatch(/^url\(#chart1-chart-dpt-pic-0-0-side\)$/u);
		expect(vm.defs).toHaveLength(2);
	});

	it('paints only the targeted face, leaving the other on its tinted/shaded solid', () => {
		const vm = applyChart3DDepth(
			emptyVm([barRect]),
			'bar3D',
			undefined,
			undefined,
			undefined,
			undefined,
			{
				series: seriesWithPicture({ applyToFront: true, applyToSides: true, applyToEnd: false }),
				elementId: 'chart1',
			},
		);
		const [topFace, sideFace] = vm.primitives.filter((p): p is SvgPolygon => p.kind === 'polygon');
		expect(topFace.fill).not.toMatch(/^url\(/u);
		expect(sideFace.fill).toBe('url(#chart1-chart-dpt-pic-0-0-side)');
		expect(vm.defs).toHaveLength(1);
	});

	describe('the untargeted end/side face fallback once the picture first pixel is sampled', () => {
		const imageUrl = 'data:image/png;chart-3d-depth-sample-test';
		const pictureContext = {
			series: [
				{ dataPoints: [{ idx: 0, picture: { imageUrl, applyToSides: false, applyToEnd: false } }] },
			],
			elementId: 'chart1',
		};

		beforeEach(() => {
			resetBarFacePicturePixelCacheForTests();
		});
		afterEach(() => {
			resetBarFacePicturePixelCacheForTests();
		});

		it('uses the resolved point/series colour fallback before any sample is cached', () => {
			const vm = applyChart3DDepth(
				emptyVm([barRect]),
				'bar3D',
				undefined,
				undefined,
				undefined,
				undefined,
				pictureContext,
			);
			const [topFace, sideFace] = vm.primitives.filter(
				(p): p is SvgPolygon => p.kind === 'polygon',
			);
			expect(topFace.fill).toBe(resolveUntargetedBarFaceFill('end', '#4472C4'));
			expect(sideFace.fill).toBe(resolveUntargetedBarFaceFill('side', '#4472C4'));
		});

		it('uses the sampled colour (COM-verified: PowerPoint samples the picture itself) once it is cached', async () => {
			ensureBarFacePicturePixelSampled(imageUrl, () => Promise.resolve('#00ff00'));
			await vi.waitFor(() => {
				const vm = applyChart3DDepth(
					emptyVm([barRect]),
					'bar3D',
					undefined,
					undefined,
					undefined,
					undefined,
					pictureContext,
				);
				const [topFace] = vm.primitives.filter((p): p is SvgPolygon => p.kind === 'polygon');
				expect(topFace.fill).toBe(resolveUntargetedBarFaceFill('end', '#00ff00'));
			});

			const vm = applyChart3DDepth(
				emptyVm([barRect]),
				'bar3D',
				undefined,
				undefined,
				undefined,
				undefined,
				pictureContext,
			);
			const [topFace, sideFace] = vm.primitives.filter(
				(p): p is SvgPolygon => p.kind === 'polygon',
			);
			expect(topFace.fill).toBe(resolveUntargetedBarFaceFill('end', '#00ff00'));
			expect(sideFace.fill).toBe(resolveUntargetedBarFaceFill('side', '#00ff00'));
		});
	});

	it('leaves both extrusion faces solid when the point has no picture', () => {
		const vm = applyChart3DDepth(
			emptyVm([barRect]),
			'bar3D',
			undefined,
			undefined,
			undefined,
			undefined,
			{
				series: [{}],
				elementId: 'chart1',
			},
		);
		const polys = vm.primitives.filter((p): p is SvgPolygon => p.kind === 'polygon');
		for (const poly of polys) {
			expect(poly.fill).not.toMatch(/^url\(/u);
		}
		expect(vm.defs ?? []).toHaveLength(0);
	});
});
