import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
/**
 * Unit tests for chart-distribution.ts (histogram + box-whisker view-models).
 *
 * Pure TypeScript: no framework, no DOM. Mirrors the pure-geometry assertions
 * from the React `chart-bar.tsx` and Vue Histogram/BoxWhisker components: bin
 * counts, contiguous bars, five-number quartile summary, IQR box geometry.
 */
import { describe, expect, it } from 'vitest';

import {
	buildBoxWhiskerViewModel,
	buildHistogramViewModel,
	computeBoxStats,
	computeBoxWhiskerGeometry,
	computeHistogramBars,
} from './chart-distribution';
import type { PlotLayout, ValueRange } from './chart-view-model';
import { buildChartViewModel } from './chart-view-model';

const layout: PlotLayout = {
	svgWidth: 400,
	svgHeight: 300,
	plotLeft: 48,
	plotTop: 8,
	plotRight: 392,
	plotBottom: 276,
	plotWidth: 344,
	plotHeight: 268,
};

function chartElement(chartData: PptxChartData, width = 400, height = 300): PptxElement {
	return {
		id: 'el-dist',
		type: 'chart',
		x: 0,
		y: 0,
		width,
		height,
		chartData,
	} as PptxElement;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeHistogramBars
// ─────────────────────────────────────────────────────────────────────────────

describe('computeHistogramBars', () => {
	const range: ValueRange = { min: 0, max: 100, span: 100 };

	it('returns one bin (bar) per value', () => {
		const bars = computeHistogramBars([10, 30, 60, 90], 4, layout, range, undefined, undefined);
		expect(bars).toHaveLength(4);
	});

	it('lays bars out contiguously (no inter-bar gap)', () => {
		const bars = computeHistogramBars([10, 30, 60, 90], 4, layout, range, undefined, undefined);
		const binWidth = layout.plotWidth / 4;
		// Each bar advances by exactly the bin width.
		expect(bars[1].x - bars[0].x).toBeCloseTo(binWidth);
		expect(bars[2].x - bars[1].x).toBeCloseTo(binWidth);
	});

	it('shrinks each bar by a 0.5px hairline divider', () => {
		const bars = computeHistogramBars([10, 30], 2, layout, range, undefined, undefined);
		const binWidth = layout.plotWidth / 2;
		expect(bars[0].w).toBeCloseTo(binWidth - 0.5);
	});

	it('taller values produce taller bars', () => {
		const bars = computeHistogramBars([10, 90], 2, layout, range, undefined, undefined);
		expect(bars[1].h).toBeGreaterThan(bars[0].h);
	});

	it('uses the series colour override when provided', () => {
		const bars = computeHistogramBars([10], 1, layout, range, '#abcdef', undefined);
		expect(bars[0].fill).toBe('#abcdef');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// computeBoxStats
// ─────────────────────────────────────────────────────────────────────────────

describe('computeBoxStats', () => {
	it('returns undefined for fewer than two values', () => {
		expect(computeBoxStats([5])).toBeUndefined();
		expect(computeBoxStats([])).toBeUndefined();
	});

	it('computes the five-number summary with floor-index quartiles', () => {
		// sorted: [10, 20, 30, 40] (n=4): q1 idx floor(1)=1 ->20, med idx floor(2)=2 ->30, q3 idx floor(3)=3 ->40.
		const stats = computeBoxStats([40, 10, 30, 20]);
		expect(stats).toStrictEqual({ min: 10, q1: 20, median: 30, q3: 40, max: 40 });
	});

	it('sorts input before computing quartiles', () => {
		const stats = computeBoxStats([100, 1, 50, 25, 75]);
		expect(stats?.min).toBe(1);
		expect(stats?.max).toBe(100);
	});

	it('orders min <= q1 <= median <= q3 <= max', () => {
		const stats = computeBoxStats([3, 1, 4, 1, 5, 9, 2, 6]);
		expect(stats).toBeDefined();
		if (stats) {
			expect(stats.min).toBeLessThanOrEqual(stats.q1);
			expect(stats.q1).toBeLessThanOrEqual(stats.median);
			expect(stats.median).toBeLessThanOrEqual(stats.q3);
			expect(stats.q3).toBeLessThanOrEqual(stats.max);
		}
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// computeBoxWhiskerGeometry
// ─────────────────────────────────────────────────────────────────────────────

describe('computeBoxWhiskerGeometry', () => {
	const range: ValueRange = { min: 0, max: 100, span: 100 };
	const chartData: PptxChartData = {
		chartType: 'boxWhisker',
		categories: ['Cat1', 'Cat2'],
		series: [
			{ name: 'A', values: [10, 20] },
			{ name: 'B', values: [40, 50] },
			{ name: 'C', values: [70, 80] },
			{ name: 'D', values: [90, 100] },
		],
	};

	it('produces one box per category with >= 2 cross-series values', () => {
		const geo = computeBoxWhiskerGeometry(chartData, 2, layout, range, undefined);
		expect(geo).toHaveLength(2);
	});

	it('skips categories with fewer than two values', () => {
		const sparse: PptxChartData = {
			chartType: 'boxWhisker',
			categories: ['Only'],
			series: [{ name: 'A', values: [10] }],
		};
		const geo = computeBoxWhiskerGeometry(sparse, 1, layout, range, undefined);
		expect(geo).toHaveLength(0);
	});

	it('places the box at half the per-category group width', () => {
		const geo = computeBoxWhiskerGeometry(chartData, 2, layout, range, undefined);
		const groupW = layout.plotWidth / 2;
		expect(geo[0].boxW).toBeCloseTo(groupW * 0.5);
	});

	it('maps the max value higher (smaller Y) than the min value', () => {
		const geo = computeBoxWhiskerGeometry(chartData, 2, layout, range, undefined);
		expect(geo[0].yMax).toBeLessThan(geo[0].yMin);
	});

	it('places the median Y between the Q1 and Q3 Y bounds', () => {
		const geo = computeBoxWhiskerGeometry(chartData, 2, layout, range, undefined);
		const hi = Math.min(geo[0].yQ1, geo[0].yQ3);
		const lo = Math.max(geo[0].yQ1, geo[0].yQ3);
		expect(geo[0].yMed).toBeGreaterThanOrEqual(hi);
		expect(geo[0].yMed).toBeLessThanOrEqual(lo);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildHistogramViewModel
// ─────────────────────────────────────────────────────────────────────────────

describe('buildHistogramViewModel', () => {
	const chartData: PptxChartData = {
		chartType: 'histogram',
		categories: ['0-10', '10-20', '20-30'],
		series: [{ name: 'Freq', values: [5, 12, 7] }],
		style: { hasLegend: true, hasDataLabels: true },
	};

	it('produces one rect primitive per bin', () => {
		const vm = buildHistogramViewModel(chartElement(chartData), chartData, chartData.categories);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects).toHaveLength(3);
	});

	it('emits cartesian gridlines and axis labels', () => {
		const vm = buildHistogramViewModel(chartElement(chartData), chartData, chartData.categories);
		expect(vm.gridlines.length).toBeGreaterThan(0);
		expect(vm.axisLabels.length).toBeGreaterThan(0);
	});

	it('emits data labels when hasDataLabels is set', () => {
		const vm = buildHistogramViewModel(chartElement(chartData), chartData, chartData.categories);
		expect(vm.dataLabels).toHaveLength(3);
	});

	it('emits category labels', () => {
		const vm = buildHistogramViewModel(chartElement(chartData), chartData, chartData.categories);
		expect(vm.categoryLabels).toHaveLength(3);
		expect(vm.categoryLabels[0].text).toBe('0-10');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildBoxWhiskerViewModel
// ─────────────────────────────────────────────────────────────────────────────

describe('buildBoxWhiskerViewModel', () => {
	const chartData: PptxChartData = {
		chartType: 'boxWhisker',
		categories: ['Cat1', 'Cat2'],
		series: [
			{ name: 'A', values: [10, 20] },
			{ name: 'B', values: [40, 50] },
			{ name: 'C', values: [70, 80] },
			{ name: 'D', values: [90, 100] },
		],
		style: { hasLegend: true },
	};

	it('produces one IQR box rect per category', () => {
		const vm = buildBoxWhiskerViewModel(chartElement(chartData), chartData, chartData.categories);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects).toHaveLength(2);
	});

	it('produces five lines per category (2 whiskers + 2 caps + median)', () => {
		const vm = buildBoxWhiskerViewModel(chartElement(chartData), chartData, chartData.categories);
		const lines = vm.primitives.filter((p) => p.kind === 'line');
		expect(lines).toHaveLength(10);
	});

	it('emits cartesian gridlines and category labels', () => {
		const vm = buildBoxWhiskerViewModel(chartElement(chartData), chartData, chartData.categories);
		expect(vm.gridlines.length).toBeGreaterThan(0);
		expect(vm.categoryLabels).toHaveLength(2);
	});

	it('builds a per-category legend when hasLegend is set', () => {
		const vm = buildBoxWhiskerViewModel(chartElement(chartData), chartData, chartData.categories);
		expect(vm.legend).toHaveLength(2);
		expect(vm.legend[0].label).toBe('Cat1');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// dispatcher integration
// ─────────────────────────────────────────────────────────────────────────────

describe('buildChartViewModel - histogram / boxWhisker dispatch', () => {
	it('dispatches histogram to the histogram builder', () => {
		const data: PptxChartData = {
			chartType: 'histogram',
			categories: ['a', 'b', 'c'],
			series: [{ name: 'S', values: [1, 2, 3] }],
		};
		const vm = buildChartViewModel(chartElement(data));
		expect(vm.primitives.filter((p) => p.kind === 'rect')).toHaveLength(3);
		expect(vm.gridlines.length).toBeGreaterThan(0);
	});

	it('dispatches boxWhisker to the box-whisker builder', () => {
		const data: PptxChartData = {
			chartType: 'boxWhisker',
			categories: ['x'],
			series: [
				{ name: 'A', values: [10] },
				{ name: 'B', values: [50] },
				{ name: 'C', values: [90] },
			],
		};
		const vm = buildChartViewModel(chartElement(data));
		expect(vm.primitives.filter((p) => p.kind === 'rect')).toHaveLength(1);
	});
});
