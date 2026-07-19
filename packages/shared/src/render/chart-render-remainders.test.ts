/**
 * Regression tests for the chart render remainders:
 *   #89 marker symbol/size (and `symbol === 'none'` drawing nothing)
 *   #72 single-series `varyColors` on bar/column
 *   #97 pie/doughnut explosion, firstSliceAng, holeSize
 *
 * All assertions run against the framework-agnostic view-model, so they cover
 * every binding that consumes `buildChartViewModel`.
 */
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildMarkerPrimitive } from './chart-marker-shape';
import {
	buildChartViewModel,
	computePieLayout,
	computePieSlices,
	DEFAULT_PALETTE,
} from './chart-view-model';

function chartElement(chartData: PptxChartData): PptxElement {
	return {
		id: 'chart-1',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as PptxElement;
}

// ─────────────────────────────────────────────────────────────────────────────
// #89 marker symbol / size
// ─────────────────────────────────────────────────────────────────────────────

describe('buildMarkerPrimitive (#89)', () => {
	const base = { cx: 10, cy: 20, fill: '#123456', defaultRadius: 3, size: undefined };

	it('returns null for symbol "none" (draws nothing)', () => {
		expect(buildMarkerPrimitive({ ...base, symbol: 'none' })).toBeNull();
	});

	it('renders a diamond as a 4-point polygon', () => {
		const p = buildMarkerPrimitive({ ...base, symbol: 'diamond' });
		expect(p?.kind).toBe('polygon');
		if (p?.kind === 'polygon') {
			expect(p.points.split(' ')).toHaveLength(4);
		}
	});

	it('renders a square as a rect sized by the marker size', () => {
		const p = buildMarkerPrimitive({ ...base, symbol: 'square', size: 12 });
		expect(p?.kind).toBe('rect');
		if (p?.kind === 'rect') {
			// size 12 -> radius 6 -> width/height 12
			expect(p.w).toBeCloseTo(12);
			expect(p.h).toBeCloseTo(12);
		}
	});

	it('renders x / plus as stroked paths with no fill', () => {
		for (const symbol of ['x', 'plus'] as const) {
			const p = buildMarkerPrimitive({ ...base, symbol });
			expect(p?.kind).toBe('path');
			if (p?.kind === 'path') {
				expect(p.fill).toBe('none');
				expect(p.stroke).toBe('#123456');
			}
		}
	});

	it('renders a star as a 10-vertex polygon', () => {
		const p = buildMarkerPrimitive({ ...base, symbol: 'star' });
		expect(p?.kind).toBe('polygon');
		if (p?.kind === 'polygon') {
			expect(p.points.split(' ')).toHaveLength(10);
		}
	});

	it('falls back to a default-radius circle for circle/undefined', () => {
		const c = buildMarkerPrimitive({ ...base, symbol: 'circle' });
		expect(c?.kind).toBe('circle');
		if (c?.kind === 'circle') {
			expect(c.r).toBe(3);
		}
	});
});

describe('line chart markers (#89 integration)', () => {
	function lineChart(symbol: PptxChartData['series'][number]['marker']): PptxChartData {
		return {
			chartType: 'line',
			categories: ['A', 'B', 'C'],
			series: [{ name: 'S', values: [10, 20, 15], marker: symbol }],
		} satisfies PptxChartData;
	}

	it('draws the parsed marker symbol at its size (diamond)', () => {
		const vm = buildChartViewModel(chartElement(lineChart({ symbol: 'diamond', size: 14 })));
		const polygons = vm.primitives.filter((p) => p.kind === 'polygon');
		expect(polygons).toHaveLength(3);
	});

	it('draws NOTHING for symbol "none"', () => {
		const vm = buildChartViewModel(chartElement(lineChart({ symbol: 'none' })));
		expect(vm.primitives.filter((p) => p.kind === 'circle')).toHaveLength(0);
		expect(vm.primitives.filter((p) => p.kind === 'polygon')).toHaveLength(0);
		// The connecting line itself is still present.
		expect(vm.primitives.some((p) => p.kind === 'polyline')).toBeTruthy();
	});

	it('keeps the legacy circle dots when no marker is present', () => {
		const vm = buildChartViewModel(chartElement(lineChart(undefined)));
		expect(vm.primitives.filter((p) => p.kind === 'circle')).toHaveLength(3);
	});

	it('emits a smoothed path instead of a polyline when c:smooth is set (#97)', () => {
		const data = lineChart(undefined);
		data.series[0].smooth = true;
		const vm = buildChartViewModel(chartElement(data));
		expect(vm.primitives.some((p) => p.kind === 'polyline')).toBeFalsy();
		const path = vm.primitives.find((p) => p.kind === 'path');
		expect(path?.kind).toBe('path');
		if (path?.kind === 'path') {
			expect(path.d).toContain('C');
		}
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// #72 single-series varyColors
// ─────────────────────────────────────────────────────────────────────────────

describe('single-series bar varyColors (#72)', () => {
	function barChart(varyColors: boolean): PptxChartData {
		return {
			chartType: 'bar',
			grouping: 'clustered',
			categories: ['A', 'B', 'C'],
			series: [{ name: 'S', values: [10, 20, 30] }],
			varyColors,
		} satisfies PptxChartData;
	}

	it('gives each point a distinct palette colour when varyColors=1', () => {
		const vm = buildChartViewModel(chartElement(barChart(true)));
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects).toHaveLength(3);
		const fills = rects.map((r) => (r.kind === 'rect' ? r.fill : ''));
		expect(new Set(fills).size).toBe(3);
		expect(fills[0]).toBe(DEFAULT_PALETTE[0]);
		expect(fills[1]).toBe(DEFAULT_PALETTE[1]);
		expect(fills[2]).toBe(DEFAULT_PALETTE[2]);
	});

	it('keeps a single colour across points when varyColors is absent/false', () => {
		const vm = buildChartViewModel(chartElement(barChart(false)));
		const fills = vm.primitives
			.filter((p) => p.kind === 'rect')
			.map((r) => (r.kind === 'rect' ? r.fill : ''));
		expect(new Set(fills).size).toBe(1);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// #97 pie explosion / firstSliceAng / holeSize
// ─────────────────────────────────────────────────────────────────────────────

describe('pie explosion (#97)', () => {
	it('offsets an exploded slice centre so its path differs', () => {
		const plain = computePieSlices([25, 25, 50], 100, 100, 80, 0);
		const exploded = computePieSlices([25, 25, 50], 100, 100, 80, 0, {
			explosions: [40, 0, 0],
		});
		expect(exploded[0].d).not.toBe(plain[0].d);
		// Non-exploded slices are unchanged.
		expect(exploded[1].d).toBe(plain[1].d);
	});

	it('applies a series-level explosion through the view-model', () => {
		const data: PptxChartData = {
			chartType: 'pie',
			categories: ['A', 'B'],
			series: [{ name: 'S', values: [60, 40], explosion: 30 }],
			style: { hasLegend: false },
		};
		const noExplode: PptxChartData = {
			...data,
			series: [{ name: 'S', values: [60, 40] }],
		};
		const a = buildChartViewModel(chartElement(data));
		const b = buildChartViewModel(chartElement(noExplode));
		const pathA = a.primitives.find((p) => p.kind === 'path');
		const pathB = b.primitives.find((p) => p.kind === 'path');
		expect(pathA?.kind === 'path' && pathB?.kind === 'path' && pathA.d !== pathB.d).toBeTruthy();
	});
});

describe('pie firstSliceAng (#97)', () => {
	it('rotates the slices when firstSliceAngle differs', () => {
		const base: PptxChartData = {
			chartType: 'pie',
			categories: ['A', 'B', 'C'],
			series: [{ name: 'S', values: [30, 30, 40] }],
			style: { hasLegend: false },
		};
		const rotated: PptxChartData = { ...base, firstSliceAngle: 90 };
		const vmBase = buildChartViewModel(chartElement(base));
		const vmRot = buildChartViewModel(chartElement(rotated));
		const dBase = vmBase.primitives.find((p) => p.kind === 'path');
		const dRot = vmRot.primitives.find((p) => p.kind === 'path');
		expect(dBase?.kind === 'path' && dRot?.kind === 'path' && dBase.d !== dRot.d).toBeTruthy();
	});
});

describe('doughnut holeSize (#97)', () => {
	it('honours c:holeSize for the inner radius', () => {
		const data: PptxChartData = {
			chartType: 'doughnut',
			categories: ['A'],
			series: [{ name: 'S', values: [1] }],
			doughnutHoleSize: 25,
		};
		const layout = computePieLayout(300, 300, data, true);
		expect(layout.innerR).toBeCloseTo(layout.outerR * 0.25);
	});

	it('falls back to the default 0.55 ratio when holeSize is absent', () => {
		const data: PptxChartData = {
			chartType: 'doughnut',
			categories: ['A'],
			series: [{ name: 'S', values: [1] }],
		};
		const layout = computePieLayout(300, 300, data, true);
		expect(layout.innerR).toBeCloseTo(layout.outerR * 0.55);
	});
});
