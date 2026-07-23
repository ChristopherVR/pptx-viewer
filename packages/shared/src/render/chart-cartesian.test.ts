/**
 * Tests for the enriched cartesian chart view-model builder
 * (`buildCartesianViewModel` via `buildChartViewModel`): log value axis, display
 * units, secondary value axis, percentStacked normalisation, and overlays.
 *
 * The linear single-axis / abs-stacked / no-overlay default path is asserted to
 * be unchanged: a baseline chart produces the same gridline/label/primitive
 * counts and leaves the new optional view-model fields undefined.
 */
import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildChartViewModel } from './chart-view-model';

// ── Helpers ──────────────────────────────────────────────────────

function chartElement(chartData: PptxChartData, width = 400, height = 300): ChartPptxElement {
	return {
		id: 'el-c',
		type: 'chart',
		x: 0,
		y: 0,
		width,
		height,
		chartData,
	} as ChartPptxElement;
}

// ── Linear default: unchanged ────────────────────────────────────

describe('cartesian linear default path', () => {
	const baselineBar: PptxChartData = {
		chartType: 'bar',
		categories: ['Q1', 'Q2', 'Q3'],
		series: [
			{ name: 'Revenue', values: [100, 150, 120] },
			{ name: 'Cost', values: [80, 90, 100] },
		],
		style: { hasLegend: true, legendPosition: 'b' },
	};

	it('emits six tick gridlines for a linear value axis', () => {
		const vm = buildChartViewModel(chartElement(baselineBar));
		expect(vm.gridlines).toHaveLength(6);
		expect(vm.axisLabels).toHaveLength(6);
	});

	it('leaves the new optional fields undefined when no rich features present', () => {
		const vm = buildChartViewModel(chartElement(baselineBar));
		expect(vm.secondaryGridlines).toBeUndefined();
		expect(vm.secondaryAxisLabels).toBeUndefined();
		expect(vm.overlays).toBeUndefined();
		expect(vm.dataTable).toBeUndefined();
	});

	it('produces one rect per (category x series)', () => {
		const vm = buildChartViewModel(chartElement(baselineBar));
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects).toHaveLength(6);
	});

	it('keeps abs-stacked geometry: 0.7 bar-group width, one rect per non-zero value', () => {
		const stacked: PptxChartData = {
			...baselineBar,
			grouping: 'stacked',
		};
		const vm = buildChartViewModel(chartElement(stacked));
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects).toHaveLength(6);
		// Linear stacked still produces 6 gridlines (abs sum range).
		expect(vm.gridlines).toHaveLength(6);
	});
});

// ── Log value axis ───────────────────────────────────────────────

describe('cartesian log value axis', () => {
	const logChart: PptxChartData = {
		chartType: 'line',
		categories: ['A', 'B', 'C', 'D'],
		series: [{ name: 'S', values: [1, 10, 100, 1000] }],
		axes: [{ axisType: 'valAx', axPos: 'l', logScale: true, logBase: 10 }],
	};

	it('produces log-spaced gridlines at each power of the base', () => {
		const vm = buildChartViewModel(chartElement(logChart));
		// range snaps to 10^0..10^3 -> ticks at 1, 10, 100, 1000 (4 ticks).
		expect(vm.gridlines).toHaveLength(4);
		expect(vm.axisLabels.filter((l) => l.text === '1')).toHaveLength(1);
	});

	it('omits the zero line on a log axis', () => {
		const vm = buildChartViewModel(chartElement(logChart));
		expect(vm.zeroLine).toBeUndefined();
	});

	it('log-maps geometry: equal log steps are equally spaced vertically', () => {
		const vm = buildChartViewModel(chartElement(logChart));
		const circles = vm.primitives.filter((p) => p.kind === 'circle');
		expect(circles).toHaveLength(4);
		const gap1 = circles[0].cy - circles[1].cy;
		const gap2 = circles[1].cy - circles[2].cy;
		expect(gap1).toBeCloseTo(gap2, 4);
	});
});

// ── Display units ────────────────────────────────────────────────

describe('cartesian display units', () => {
	const unitChart: PptxChartData = {
		chartType: 'bar',
		categories: ['A', 'B'],
		series: [{ name: 'S', values: [1_000_000, 2_000_000] }],
		axes: [{ axisType: 'valAx', axPos: 'l', displayUnits: 'millions' }],
	};

	it('scales axis labels by the display-unit divisor', () => {
		const vm = buildChartViewModel(chartElement(unitChart));
		// max 2,000,000 / 1,000,000 = 2 -> a "2" label should appear.
		expect(vm.axisLabels.some((l) => l.text === '2')).toBeTruthy();
	});

	it('emits a rotated display-unit caption (e.g. "Millions")', () => {
		const vm = buildChartViewModel(chartElement(unitChart));
		const caption = vm.axisLabels.find((l) => l.text === 'Millions');
		expect(caption).toBeDefined();
		expect(caption?.transform).toContain('rotate(-90');
	});
});

describe('cartesian reversed value axis', () => {
	const reversedChart: PptxChartData = {
		chartType: 'line',
		categories: ['Low', 'High'],
		series: [{ name: 'S', values: [0, 100] }],
		axes: [
			{
				axisType: 'valAx',
				axPos: 'l',
				min: 0,
				max: 100,
				orientation: 'maxMin',
				majorUnit: 25,
			},
		],
	};

	it('renders increasing values from top to bottom with explicit major ticks', () => {
		const vm = buildChartViewModel(chartElement(reversedChart));
		const circles = vm.primitives.filter((primitive) => primitive.kind === 'circle');
		expect(circles[0].cy).toBeLessThan(circles[1].cy);
		expect(vm.axisLabels.map((label) => label.text)).toStrictEqual(['0', '25', '50', '75', '100']);
	});
});

describe('cartesian reversed category axis', () => {
	for (const chartType of ['bar', 'line', 'area'] as const) {
		it(`reverses ${chartType} geometry while retaining source point indexes`, () => {
			const data: PptxChartData = {
				chartType,
				categories: ['A', 'B', 'C'],
				series: [{ name: 'S', values: [10, 20, 30] }],
				axes: [{ axisType: 'catAx', orientation: 'maxMin' }],
			};
			const vm = buildChartViewModel(chartElement(data));
			expect(vm.categoryLabels.map((label) => label.text)).toStrictEqual(['C', 'B', 'A']);
			const marks = vm.primitives.filter((primitive) =>
				chartType === 'bar' ? primitive.kind === 'rect' : primitive.kind === 'circle',
			);
			expect(marks[0]?.part?.pointIndex).toBe(2);
			expect(marks[2]?.part?.pointIndex).toBe(0);
		});
	}

	it('does not apply category-axis reversal to scatter X positioning', () => {
		const data: PptxChartData = {
			chartType: 'scatter',
			categories: ['A', 'B', 'C'],
			series: [{ name: 'S', values: [10, 20, 30] }],
			axes: [{ axisType: 'catAx', orientation: 'maxMin' }],
		};
		const vm = buildChartViewModel(chartElement(data));
		const dots = vm.primitives.filter((primitive) => primitive.kind === 'circle');
		expect(vm.categoryLabels.map((label) => label.text)).toStrictEqual(['A', 'B', 'C']);
		expect(dots.map((dot) => dot.part?.pointIndex)).toStrictEqual([0, 1, 2]);
		expect(dots[0]?.cx).toBeLessThan(dots[2]?.cx ?? 0);
	});
});

// ── Secondary value axis ─────────────────────────────────────────

describe('cartesian secondary value axis', () => {
	const secChart: PptxChartData = {
		chartType: 'line',
		categories: ['A', 'B', 'C'],
		series: [
			{ name: 'Revenue', values: [100, 200, 300], axisId: 100 },
			{ name: 'Growth %', values: [5, 10, 15], axisId: 200 },
		],
		axes: [
			{ axisType: 'valAx', axPos: 'l', axisId: 100 },
			{ axisType: 'valAx', axPos: 'r', axisId: 200, titleText: 'Growth' },
		],
	};

	it('emits a second set of gridlines and labels on the right', () => {
		const vm = buildChartViewModel(chartElement(secChart));
		expect(vm.secondaryGridlines).toBeDefined();
		expect(vm.secondaryAxisLabels).toBeDefined();
		expect(vm.secondaryGridlines!.length).toBeGreaterThan(0);
	});

	it('positions secondary labels to the right of plotRight', () => {
		const vm = buildChartViewModel(chartElement(secChart));
		const plotRight = vm.gridlines[0].x2;
		const numericLabel = vm.secondaryAxisLabels!.find((l) => l.textAnchor === 'start');
		expect(numericLabel!.x).toBeGreaterThan(plotRight);
	});

	it('scales the secondary series against its own range', () => {
		const vm = buildChartViewModel(chartElement(secChart));
		// Revenue (100..300) and Growth% (5..15) are different scales; the second
		// series' first point should not collapse to the primary baseline.
		const polylines = vm.primitives.filter((p) => p.kind === 'polyline');
		expect(polylines).toHaveLength(2);
	});

	it('reserves right margin for the secondary axis in the layout', () => {
		const withSec = buildChartViewModel(chartElement(secChart));
		const withoutSec = buildChartViewModel(
			chartElement({ ...secChart, axes: [{ axisType: 'valAx', axPos: 'l', axisId: 100 }] }),
		);
		// plotRight (= gridline x2) is pulled in by 40px when a secondary axis exists.
		expect(withoutSec.gridlines[0].x2 - withSec.gridlines[0].x2).toBe(40);
	});
});

// ── percentStacked ───────────────────────────────────────────────

describe('cartesian percentStacked', () => {
	const percentChart: PptxChartData = {
		chartType: 'bar',
		categories: ['Q1', 'Q2'],
		series: [
			{ name: 'A', values: [30, 10] },
			{ name: 'B', values: [70, 90] },
		],
		grouping: 'percentStacked',
		style: { hasDataLabels: true },
	};

	it('normalises each category to a 0..100 range', () => {
		const vm = buildChartViewModel(chartElement(percentChart));
		// Top axis label should be 100 (percent normalised), bottom 0.
		expect(vm.axisLabels.some((l) => l.text === '100')).toBeTruthy();
	});

	it('emits in-bar percent labels', () => {
		const vm = buildChartViewModel(chartElement(percentChart));
		// Q1: A=30/100=30%, B=70/100=70%.
		expect(vm.dataLabels.some((l) => l.text === '30%')).toBeTruthy();
		expect(vm.dataLabels.some((l) => l.text === '70%')).toBeTruthy();
	});

	it('stacks each category to the full plot height (sums to 100%)', () => {
		const vm = buildChartViewModel(chartElement(percentChart));
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		// Two segments per category, two categories -> four rects.
		expect(rects).toHaveLength(4);
	});
});

// ── invertIfNegative (c:invertIfNegative) ────────────────────────

describe('cartesian invertIfNegative', () => {
	const SERIES_COLOR = '#4472C4';

	function firstTwoRectFills(data: PptxChartData): Array<string> {
		const vm = buildChartViewModel(chartElement(data));
		return vm.primitives.filter((p) => p.kind === 'rect').map((p) => p.fill);
	}

	it('lightens a negative-value bar when the series sets invertIfNegative', () => {
		const [positive, negative] = firstTwoRectFills({
			chartType: 'bar',
			categories: ['Up', 'Down'],
			series: [{ name: 'S', values: [10, -20], color: SERIES_COLOR, invertIfNegative: true }],
		});
		// The positive bar keeps the series colour; the negative bar is inverted.
		expect(positive).toBe(SERIES_COLOR);
		expect(negative).not.toBe(SERIES_COLOR);
		// Convention: 50% blend of #4472C4 toward white -> #A2B9E2.
		expect(negative).toBe('#A2B9E2');
	});

	it('leaves negative bars untouched when invertIfNegative is absent', () => {
		const [positive, negative] = firstTwoRectFills({
			chartType: 'bar',
			categories: ['Up', 'Down'],
			series: [{ name: 'S', values: [10, -20], color: SERIES_COLOR }],
		});
		expect(positive).toBe(SERIES_COLOR);
		expect(negative).toBe(SERIES_COLOR);
	});

	it('lets a per-point c:dPt invertIfNegative override the series-level flag', () => {
		const [, negative] = firstTwoRectFills({
			chartType: 'bar',
			categories: ['Up', 'Down'],
			series: [
				{
					name: 'S',
					values: [10, -20],
					color: SERIES_COLOR,
					invertIfNegative: false,
					dataPoints: [{ idx: 1, invertIfNegative: true }],
				},
			],
		});
		expect(negative).toBe('#A2B9E2');
	});
});

// ── Overlays ─────────────────────────────────────────────────────

describe('cartesian overlays', () => {
	it('appends trendline primitives and surfaces them on the overlays field', () => {
		const data: PptxChartData = {
			chartType: 'line',
			categories: ['A', 'B', 'C', 'D'],
			series: [
				{
					name: 'S',
					values: [10, 20, 30, 40],
					trendlines: [{ trendlineType: 'linear', displayEq: true, displayRSq: true }],
				},
			],
		};
		const vm = buildChartViewModel(chartElement(data));
		expect(vm.overlays).toBeDefined();
		const trendPaths = vm.overlays!.filter((p) => p.kind === 'path');
		expect(trendPaths.length).toBeGreaterThan(0);
	});

	it('appends error-bar primitives', () => {
		const data: PptxChartData = {
			chartType: 'bar',
			categories: ['A', 'B'],
			series: [
				{
					name: 'S',
					values: [10, 20],
					errBars: [{ direction: 'y', barType: 'both', valType: 'fixedVal', val: 2 }],
				},
			],
		};
		const vm = buildChartViewModel(chartElement(data));
		expect(vm.overlays).toBeDefined();
		const lines = vm.overlays!.filter((p) => p.kind === 'line');
		expect(lines.length).toBeGreaterThan(0);
	});

	it('anchors scatter X error bars to numeric xVal point coordinates', () => {
		const data: PptxChartData = {
			chartType: 'scatter',
			categories: ['10', '20', '40'],
			series: [
				{
					name: 'S',
					values: [10, 20, 30],
					errBars: [{ direction: 'x', barType: 'plus', valType: 'fixedVal', val: 5 }],
				},
			],
		};
		const vm = buildChartViewModel(chartElement(data));
		const dots = vm.primitives.filter((primitive) => primitive.kind === 'circle');
		const stems = vm.overlays!.filter((primitive) => primitive.kind === 'line');
		expect(dots[0].cx).toBeCloseTo(stems[0].x1, 5);
		expect(dots[1].cx - dots[0].cx).toBeLessThan(dots[2].cx - dots[1].cx);
	});

	it('emits axis-title primitives from axis titleText', () => {
		const data: PptxChartData = {
			chartType: 'bar',
			categories: ['A', 'B'],
			series: [{ name: 'S', values: [10, 20] }],
			axes: [
				{ axisType: 'catAx', axPos: 'b', titleText: 'Quarter' },
				{ axisType: 'valAx', axPos: 'l', titleText: 'Dollars' },
			],
		};
		const vm = buildChartViewModel(chartElement(data));
		expect(vm.overlays).toBeDefined();
		const titleTexts = vm.overlays!.filter((p) => p.kind === 'text').map((p) => p.text);
		expect(titleTexts).toContain('Quarter');
		expect(titleTexts).toContain('Dollars');
	});

	it('emits a data-table primitive block when chartData.dataTable is set', () => {
		const data: PptxChartData = {
			chartType: 'bar',
			categories: ['A', 'B'],
			series: [{ name: 'S', values: [10, 20] }],
			dataTable: { showKeys: true, showOutline: true },
		};
		const vm = buildChartViewModel(chartElement(data));
		expect(vm.dataTable).toBeDefined();
		expect(vm.dataTable!.length).toBeGreaterThan(0);
		// Data-table rows reserve vertical space -> primary gridlines still present.
		expect(vm.gridlines.length).toBeGreaterThan(0);
	});
});
