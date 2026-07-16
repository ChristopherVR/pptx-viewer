import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
/**
 * Unit tests for chart-funnel-sunburst.ts (funnel + sunburst view-models).
 *
 * Pure TypeScript: no framework, no DOM. Mirrors the pure-geometry assertions
 * implicit in the React `chart-sunburst-funnel.tsx` and Vue Funnel/Sunburst
 * components: trapezoid widths, descending segments, ring arc counts/opacity.
 */
import { describe, expect, it } from 'vitest';

import {
	buildFunnelViewModel,
	buildSunburstViewModel,
	computeFunnelSegments,
	computeHierarchicalSunburstArcs,
	computeSunburstArcs,
} from './chart-funnel-sunburst';
import { buildChartViewModel } from './chart-view-model';

function chartElement(chartData: PptxChartData, width = 400, height = 300): PptxElement {
	return {
		id: 'el-fs',
		type: 'chart',
		x: 0,
		y: 0,
		width,
		height,
		chartData,
	} as PptxElement;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeFunnelSegments
// ─────────────────────────────────────────────────────────────────────────────

describe('computeFunnelSegments', () => {
	it('returns one segment per value', () => {
		const segs = computeFunnelSegments([100, 60, 30], 0, 0, 200, 300, [], undefined);
		expect(segs).toHaveLength(3);
	});

	it('returns an empty array for no values', () => {
		expect(computeFunnelSegments([], 0, 0, 200, 300, [], undefined)).toHaveLength(0);
	});

	it('makes the largest value span the full plot width', () => {
		const segs = computeFunnelSegments([100, 50], 0, 0, 200, 300, [], undefined);
		expect(segs[0].topW).toBeCloseTo(200);
	});

	it('matches each segment bottom width to the next value top width', () => {
		const segs = computeFunnelSegments([100, 50], 0, 0, 200, 300, [], undefined);
		// next value 50 of max 100 -> 0.5 * 200 = 100.
		expect(segs[0].botW).toBeCloseTo(100);
		expect(segs[1].topW).toBeCloseTo(100);
	});

	it('tapers the final segment bottom to 30% of its own width', () => {
		const segs = computeFunnelSegments([100], 0, 0, 200, 300, [], undefined);
		// last segment: nextVal = abs(100) * 0.3 = 30; 30/100 * 200 = 60.
		expect(segs[0].botW).toBeCloseTo(60);
	});

	it('produces strictly descending top widths for descending values', () => {
		const segs = computeFunnelSegments([100, 60, 30], 0, 0, 200, 300, [], undefined);
		expect(segs[0].topW).toBeGreaterThan(segs[1].topW);
		expect(segs[1].topW).toBeGreaterThan(segs[2].topW);
	});

	it('uses the category label when present, else the formatted value', () => {
		const withCats = computeFunnelSegments([100], 0, 0, 200, 300, ['Leads'], undefined);
		expect(withCats[0].labelText).toBe('Leads');
		const noCats = computeFunnelSegments([100], 0, 0, 200, 300, [], undefined);
		expect(noCats[0].labelText).toBe('100');
	});

	it('emits a closed trapezoid path', () => {
		const segs = computeFunnelSegments([100], 0, 0, 200, 300, [], undefined);
		expect(segs[0].d).toMatch(/^M/u);
		expect(segs[0].d).toMatch(/Z$/u);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// computeSunburstArcs
// ─────────────────────────────────────────────────────────────────────────────

describe('computeSunburstArcs', () => {
	const series: PptxChartData['series'] = [
		{ name: 'inner', values: [50, 50] },
		{ name: 'outer', values: [25, 25, 25, 25] },
	];

	it('produces one arc per value across all rings', () => {
		const arcs = computeSunburstArcs(series, 200, 150, 100, undefined);
		expect(arcs).toHaveLength(6);
	});

	it('fades opacity for outer rings and clamps to a 0.1 floor', () => {
		const arcs = computeSunburstArcs(series, 200, 150, 100, undefined);
		// ring 0 -> 0.9, ring 1 -> 0.8.
		expect(arcs[0].opacity).toBeCloseTo(0.9);
		expect(arcs[2].opacity).toBeCloseTo(0.8);
	});

	it('never drops opacity below 0.1 for deep rings', () => {
		const deep: PptxChartData['series'] = Array.from({ length: 12 }, (_, i) => ({
			name: `r${i}`,
			values: [1],
		}));
		const arcs = computeSunburstArcs(deep, 200, 150, 100, undefined);
		expect(Math.min(...arcs.map((a) => a.opacity))).toBeGreaterThanOrEqual(0.1);
	});

	it('sets the large-arc flag for a wedge wider than PI (single value ring)', () => {
		const single: PptxChartData['series'] = [{ name: 's', values: [1] }];
		const arcs = computeSunburstArcs(single, 200, 150, 100, undefined);
		// full 360deg sweep -> sweep > PI -> largeArc 1.
		expect(arcs[0].d).toMatch(/A \S+ \S+ 0 1 1/u);
	});

	it('emits a closed donut-wedge path with two arcs', () => {
		const arcs = computeSunburstArcs(series, 200, 150, 100, undefined);
		const arcCount = (arcs[0].d.match(/A/gu) ?? []).length;
		expect(arcCount).toBe(2);
		expect(arcs[0].d).toMatch(/Z$/u);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildFunnelViewModel
// ─────────────────────────────────────────────────────────────────────────────

describe('buildFunnelViewModel', () => {
	const chartData: PptxChartData = {
		chartType: 'funnel',
		categories: ['A', 'B', 'C'],
		series: [{ name: 'Stage', values: [100, 60, 30] }],
		style: { hasTitle: true },
		title: 'Pipeline',
	};

	it('produces one path primitive per value', () => {
		const vm = buildFunnelViewModel(chartElement(chartData), chartData, chartData.categories);
		const paths = vm.primitives.filter((p) => p.kind === 'path');
		expect(paths).toHaveLength(3);
	});

	it('produces one centred data label per segment', () => {
		const vm = buildFunnelViewModel(chartElement(chartData), chartData, chartData.categories);
		expect(vm.dataLabels).toHaveLength(3);
		expect(vm.dataLabels[0].text).toBe('A');
	});

	it('has no cartesian gridlines or axis labels', () => {
		const vm = buildFunnelViewModel(chartElement(chartData), chartData, chartData.categories);
		expect(vm.gridlines).toHaveLength(0);
		expect(vm.axisLabels).toHaveLength(0);
	});

	it('surfaces the title when hasTitle is set', () => {
		const vm = buildFunnelViewModel(chartElement(chartData), chartData, chartData.categories);
		expect(vm.title).toBe('Pipeline');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildSunburstViewModel
// ─────────────────────────────────────────────────────────────────────────────

describe('buildSunburstViewModel', () => {
	const chartData: PptxChartData = {
		chartType: 'sunburst',
		categories: ['A', 'B'],
		series: [
			{ name: 'inner', values: [50, 50] },
			{ name: 'outer', values: [25, 25, 25, 25] },
		],
		style: { hasLegend: true },
	};

	it('produces one path primitive per arc across rings', () => {
		const vm = buildSunburstViewModel(chartElement(chartData), chartData, chartData.categories);
		const paths = vm.primitives.filter((p) => p.kind === 'path');
		expect(paths).toHaveLength(6);
	});

	it('carries per-arc opacity onto the path primitives', () => {
		const vm = buildSunburstViewModel(chartElement(chartData), chartData, chartData.categories);
		const paths = vm.primitives.filter((p) => p.kind === 'path');
		expect(paths[0].opacity).toBeCloseTo(0.9);
	});

	it('builds a per-category legend when hasLegend is set', () => {
		const vm = buildSunburstViewModel(chartElement(chartData), chartData, chartData.categories);
		expect(vm.legend).toHaveLength(2);
		expect(vm.legend[0].label).toBe('A');
	});

	it('omits the legend when hasLegend is unset', () => {
		const plain: PptxChartData = { ...chartData, style: {} };
		const vm = buildSunburstViewModel(chartElement(plain), plain, plain.categories);
		expect(vm.legend).toHaveLength(0);
	});

	it('renders ChartEx hierarchy as aligned parent and leaf rings', () => {
		const hierarchical: PptxChartData = {
			chartType: 'sunburst',
			categories: ['A1', 'A2', 'B1', 'B2'],
			categoryLevels: [
				['A1', 'A2', 'B1', 'B2'],
				['A', 'A', 'B', 'B'],
			],
			series: [{ name: 'Size', values: [10, 30, 20, 40] }],
			style: { hasLegend: true },
		};
		const vm = buildSunburstViewModel(
			chartElement(hierarchical),
			hierarchical,
			hierarchical.categories,
		);
		const paths = vm.primitives.filter((primitive) => primitive.kind === 'path');
		expect(paths).toHaveLength(6);
		expect(paths.filter((path) => path.part?.pointIndex !== undefined)).toHaveLength(4);
		expect(vm.legend.map((entry) => entry.label)).toStrictEqual(['A', 'B']);
		const arcs = computeHierarchicalSunburstArcs(
			hierarchical.categoryLevels!,
			hierarchical.series[0].values,
			100,
			100,
			80,
			undefined,
		);
		expect(arcs.map(({ level, label }) => [level, label])).toStrictEqual([
			[0, 'A'],
			[0, 'B'],
			[1, 'A1'],
			[1, 'A2'],
			[1, 'B1'],
			[1, 'B2'],
		]);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// dispatcher integration
// ─────────────────────────────────────────────────────────────────────────────

describe('buildChartViewModel - funnel / sunburst dispatch', () => {
	it('dispatches funnel to the funnel builder (paths, no fallback rect)', () => {
		const data: PptxChartData = {
			chartType: 'funnel',
			categories: ['A', 'B'],
			series: [{ name: 'S', values: [100, 50] }],
		};
		const vm = buildChartViewModel(chartElement(data));
		expect(vm.primitives.filter((p) => p.kind === 'path')).toHaveLength(2);
	});

	it('dispatches sunburst to the sunburst builder', () => {
		const data: PptxChartData = {
			chartType: 'sunburst',
			categories: ['A', 'B'],
			series: [{ name: 'S', values: [50, 50] }],
		};
		const vm = buildChartViewModel(chartElement(data));
		expect(vm.primitives.filter((p) => p.kind === 'path')).toHaveLength(2);
	});
});
