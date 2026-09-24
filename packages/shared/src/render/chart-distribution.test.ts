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
	computeHistogramBins,
	computeHistogramBars,
} from './chart-distribution';
import type { PlotLayout, ValueRange } from './chart-view-model';
import { buildChartViewModel, valueToY } from './chart-view-model';

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

describe('computeHistogramBins', () => {
	it('honours bin size and left-closed interval boundaries', () => {
		const bins = computeHistogramBins([0, 10, 20], {
			layout: 'histogram',
			binSize: 10,
			intervalClosed: 'l',
		});
		expect(bins.map((bin) => bin.value)).toStrictEqual([1, 1, 1]);
		expect(bins.map((bin) => bin.sourceIndices)).toStrictEqual([[0], [1], [2]]);
	});

	it('assigns exact boundaries to the preceding right-closed bin', () => {
		const bins = computeHistogramBins([0, 10, 20], {
			layout: 'histogram',
			binSize: 10,
			intervalClosed: 'r',
		});
		expect(bins.map((bin) => bin.value)).toStrictEqual([2, 1]);
	});

	it('creates custom underflow and overflow bins', () => {
		const bins = computeHistogramBins([-5, 0, 5, 10, 15], {
			layout: 'histogram',
			binCount: 2,
			underflow: 0,
			overflow: 10,
			intervalClosed: 'r',
		});
		expect(bins[0]).toMatchObject({ value: 2, label: '≤ 0', sourceIndices: [0, 1] });
		expect(bins.at(-1)).toMatchObject({ value: 1, label: '> 10', sourceIndices: [4] });
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

	it('distinguishes inclusive and exclusive interpolated quartiles', () => {
		const values = [1, 2, 3, 4, 5, 6, 7, 8];
		expect(computeBoxStats(values, 'inclusive')).toMatchObject({ q1: 2.75, q3: 6.25 });
		expect(computeBoxStats(values, 'exclusive')).toMatchObject({ q1: 2.25, q3: 6.75 });
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// computeBoxWhiskerGeometry
// ─────────────────────────────────────────────────────────────────────────────

describe('computeBoxWhiskerGeometry', () => {
	const range: ValueRange = { min: 0, max: 100, span: 100 };
	// Mirrors how PowerPoint's cx:boxWhisker actually shapes its data
	// (COM-verified against charts-com.pptx slide 32 / chartEx7.xml): the raw
	// category label REPEATS once per underlying observation, and each series
	// carries its own full-length values array aligned to those same rows.
	const rawCategories = ['Cat1', 'Cat1', 'Cat2', 'Cat2'];
	const chartData: PptxChartData = {
		chartType: 'boxWhisker',
		categories: rawCategories,
		series: [
			{ name: 'A', values: [10, 20, 40, 50] },
			{ name: 'B', values: [70, 80, 90, 100] },
		],
	};

	it('produces one box per (series, category) pair, grouping repeated category labels', () => {
		const geo = computeBoxWhiskerGeometry(chartData, rawCategories, layout, range, undefined);
		// 2 unique categories x 2 series = 4 boxes.
		expect(geo).toHaveLength(4);
	});

	it('skips a (series, category) pair with fewer than two observations', () => {
		const sparse: PptxChartData = {
			chartType: 'boxWhisker',
			categories: ['Only'],
			series: [{ name: 'A', values: [10] }],
		};
		const geo = computeBoxWhiskerGeometry(sparse, ['Only'], layout, range, undefined);
		expect(geo).toHaveLength(0);
	});

	it('places each series box in its own slot of the per-category group width', () => {
		const geo = computeBoxWhiskerGeometry(chartData, rawCategories, layout, range, undefined);
		const slotWidth = layout.plotWidth / 2 / 2; // 2 categories, 2 series each.
		expect(geo[0].boxW).toBeCloseTo(slotWidth * 0.7);
	});

	it('sizes a single-series box to 0.7x the whole per-category group width', () => {
		const singleSeries: PptxChartData = {
			chartType: 'boxWhisker',
			categories: rawCategories,
			series: [{ name: 'A', values: [10, 20, 90, 100] }],
		};
		const geo = computeBoxWhiskerGeometry(singleSeries, rawCategories, layout, range, undefined);
		const groupW = layout.plotWidth / 2;
		expect(geo[0].boxW).toBeCloseTo(groupW * 0.7);
	});

	it('maps the max value higher (smaller Y) than the min value', () => {
		const geo = computeBoxWhiskerGeometry(chartData, rawCategories, layout, range, undefined);
		expect(geo[0].yMax).toBeLessThan(geo[0].yMin);
	});

	it('places the median Y between the Q1 and Q3 Y bounds', () => {
		const geo = computeBoxWhiskerGeometry(chartData, rawCategories, layout, range, undefined);
		const hi = Math.min(geo[0].yQ1, geo[0].yQ3);
		const lo = Math.max(geo[0].yQ1, geo[0].yQ3);
		expect(geo[0].yMed).toBeGreaterThanOrEqual(hi);
		expect(geo[0].yMed).toBeLessThanOrEqual(lo);
	});

	it('uses 1.5 IQR whiskers and identifies the outlier by its raw row index', () => {
		const outlierCategories = ['Cat', 'Cat', 'Cat', 'Cat', 'Cat'];
		const typed: PptxChartData = {
			chartType: 'boxWhisker',
			categories: outlierCategories,
			series: [
				{
					name: 'A',
					values: [1, 2, 3, 4, 100],
					boxWhiskerOptions: { quartileMethod: 'inclusive' },
				},
			],
		};
		const [geometry] = computeBoxWhiskerGeometry(
			typed,
			outlierCategories,
			layout,
			range,
			undefined,
		);
		expect(geometry.yMax).toBeCloseTo(valueToY(4, range, layout.plotTop, layout.plotBottom));
		expect(geometry.points.find((point) => point.rowIndex === 4)?.outlier).toBeTruthy();
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

	it('preserves interactive point indices for legacy unbinned bars', () => {
		const vm = buildHistogramViewModel(chartElement(chartData), chartData, chartData.categories);
		const rects = vm.primitives.filter((primitive) => primitive.kind === 'rect');
		expect(rects.map((rect) => rect.part)).toStrictEqual([
			{ role: 'dataPoint', seriesIndex: 0, pointIndex: 0 },
			{ role: 'dataPoint', seriesIndex: 0, pointIndex: 1 },
			{ role: 'dataPoint', seriesIndex: 0, pointIndex: 2 },
		]);
	});

	it('bins observations and overlays a cumulative Pareto line', () => {
		const typed: PptxChartData = {
			chartType: 'histogram',
			categories: [],
			series: [
				{
					name: 'Frequency',
					values: [1, 2, 3, 4],
					histogramOptions: { layout: 'histogram', binCount: 2 },
				},
				{
					name: 'Cumulative',
					values: [1, 2, 3, 4],
					histogramOptions: { layout: 'pareto' },
				},
			],
		};
		const vm = buildHistogramViewModel(chartElement(typed), typed, []);
		const rects = vm.primitives.filter((primitive) => primitive.kind === 'rect');
		const line = vm.primitives.find((primitive) => primitive.kind === 'polyline');
		const points = vm.primitives.filter((primitive) => primitive.kind === 'circle');
		expect(rects).toHaveLength(2);
		expect(line?.part).toStrictEqual({ role: 'series', seriesIndex: 1 });
		expect(line?.points.split(' ').at(-1)?.endsWith(`,${layout.plotTop}`)).toBeTruthy();
		expect(points.map((point) => point.part?.pointIndex)).toStrictEqual([0, 1]);
		expect(vm.secondaryAxisLabels?.map((label) => label.text)).toContain('100%');
		expect(vm.secondaryGridlines?.length).toBeGreaterThan(0);
	});

	it('stably orders Pareto bars and labels by descending frequency', () => {
		const pareto: PptxChartData = {
			chartType: 'histogram',
			categories: ['A', 'B', 'C', 'D'],
			series: [
				{ name: 'Frequency', values: [5, 10, 10, 2] },
				{
					name: 'Cumulative',
					values: [5, 10, 10, 2],
					histogramOptions: { layout: 'pareto' },
				},
			],
		};
		const vm = buildHistogramViewModel(chartElement(pareto), pareto, pareto.categories);
		const bars = vm.primitives.filter((primitive) => primitive.kind === 'rect');
		const points = vm.primitives.filter((primitive) => primitive.kind === 'circle');
		expect(vm.categoryLabels.map((label) => label.text)).toStrictEqual(['B', 'C', 'A', 'D']);
		expect(bars.map((bar) => bar.part?.pointIndex)).toStrictEqual([1, 2, 0, 3]);
		expect(points.map((point) => point.part?.pointIndex)).toStrictEqual([1, 2, 0, 3]);
		expect(points.at(-1)?.cy).toBe(
			vm.secondaryAxisLabels?.find((label) => label.text === '100%')?.y,
		);
		expect(vm.secondaryAxisLabels?.map((label) => label.text)).toStrictEqual([
			'0%',
			'20%',
			'40%',
			'60%',
			'80%',
			'100%',
		]);
	});

	it('reserves right-axis space only when a Pareto series is present', () => {
		const ordinary = buildHistogramViewModel(
			chartElement(chartData),
			chartData,
			chartData.categories,
		);
		const paretoData: PptxChartData = {
			...chartData,
			series: [
				...chartData.series,
				{ name: 'Cumulative', values: [5, 12, 7], histogramOptions: { layout: 'pareto' } },
			],
		};
		const pareto = buildHistogramViewModel(
			chartElement(paretoData),
			paretoData,
			paretoData.categories,
		);
		expect(ordinary.secondaryAxisLabels).toBeUndefined();
		expect(ordinary.gridlines[0].x2 - pareto.gridlines[0].x2).toBe(40);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildBoxWhiskerViewModel
// ─────────────────────────────────────────────────────────────────────────────

describe('buildBoxWhiskerViewModel', () => {
	// One box per (series, category): 2 series x 2 unique categories, each
	// series' raw rows repeating its category label (COM-verified shape, see
	// computeBoxWhiskerGeometry's tests above).
	const rawCategories = ['Cat1', 'Cat1', 'Cat2', 'Cat2'];
	const chartData: PptxChartData = {
		chartType: 'boxWhisker',
		categories: rawCategories,
		series: [
			{ name: 'A', values: [10, 20, 40, 50] },
			{ name: 'B', values: [70, 80, 90, 100] },
		],
		style: { hasLegend: true },
	};

	it('produces one IQR box rect per (series, category) pair', () => {
		const vm = buildBoxWhiskerViewModel(chartElement(chartData), chartData, chartData.categories);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects).toHaveLength(4);
	});

	it('produces five lines per box (2 whiskers + 2 caps + median)', () => {
		const vm = buildBoxWhiskerViewModel(chartElement(chartData), chartData, chartData.categories);
		const lines = vm.primitives.filter((p) => p.kind === 'line');
		expect(lines).toHaveLength(20);
	});

	it('emits cartesian gridlines and one category label per unique category', () => {
		const vm = buildBoxWhiskerViewModel(chartElement(chartData), chartData, chartData.categories);
		expect(vm.gridlines.length).toBeGreaterThan(0);
		// 4 raw (repeated) rows collapse to 2 unique category labels.
		expect(vm.categoryLabels).toHaveLength(2);
		expect(vm.categoryLabels.map((label) => label.text)).toStrictEqual(['Cat1', 'Cat2']);
	});

	it('builds a per-series legend when hasLegend is set, never a per-category one', () => {
		const vm = buildBoxWhiskerViewModel(chartElement(chartData), chartData, chartData.categories);
		expect(vm.legend).toHaveLength(2);
		expect(vm.legend.map((entry) => entry.label)).toStrictEqual(['A', 'B']);
	});

	it('renders typed mean and point visibility, tagged by raw row index', () => {
		const outlierCategories = ['Cat', 'Cat', 'Cat', 'Cat', 'Cat'];
		const typed: PptxChartData = {
			chartType: 'boxWhisker',
			categories: outlierCategories,
			series: [
				{
					name: 'A',
					values: [1, 2, 3, 4, 100],
					boxWhiskerOptions: {
						quartileMethod: 'inclusive',
						showMeanLine: true,
						showMeanMarker: true,
						showInnerPoints: true,
						showOutlierPoints: true,
					},
				},
			],
		};
		const vm = buildBoxWhiskerViewModel(chartElement(typed), typed, typed.categories);
		const circles = vm.primitives.filter((primitive) => primitive.kind === 'circle');
		expect(vm.primitives.filter((primitive) => primitive.kind === 'line')).toHaveLength(6);
		// 1 mean marker + 5 observation points.
		expect(circles).toHaveLength(6);
		expect(circles.at(-1)?.part).toStrictEqual({
			role: 'dataPoint',
			seriesIndex: 0,
			pointIndex: 4,
		});
	});

	it('hides mean, inner and outlier points when typed visibility flags are false', () => {
		const categories = ['Cat', 'Cat', 'Cat'];
		const typed: PptxChartData = {
			chartType: 'boxWhisker',
			categories,
			series: [
				{
					name: 'A',
					values: [1, 2, 100],
					boxWhiskerOptions: {
						showMeanLine: false,
						showMeanMarker: false,
						showInnerPoints: false,
						showOutlierPoints: false,
					},
				},
			],
		};
		const vm = buildBoxWhiskerViewModel(chartElement(typed), typed, typed.categories);
		expect(vm.primitives.filter((primitive) => primitive.kind === 'circle')).toHaveLength(0);
		expect(vm.primitives.filter((primitive) => primitive.kind === 'line')).toHaveLength(5);
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
			categories: ['x', 'x', 'x'],
			series: [{ name: 'A', values: [10, 50, 90] }],
		};
		const vm = buildChartViewModel(chartElement(data));
		expect(vm.primitives.filter((p) => p.kind === 'rect')).toHaveLength(1);
	});
});
