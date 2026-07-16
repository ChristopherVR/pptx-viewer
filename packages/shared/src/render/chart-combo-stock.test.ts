/**
 * Unit tests for chart-combo-stock.ts
 *
 * All tests exercise pure TypeScript helpers — no Angular, no DOM, no TestBed.
 * Mirrors the assertion style in chart-renderer-helpers.test.ts.
 *
 * Tested:
 *   buildComboViewModel — bar + line overlay, chrome, legend, data labels
 *   buildStockViewModel — HLC / OHLC candlesticks, wick lines, body rects
 *
 * Ported from:
 *   packages/react/src/viewer/utils/chart-waterfall-combo.tsx
 *   packages/react/src/viewer/utils/chart-stock.tsx
 */

import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildComboViewModel, buildStockViewModel } from './chart-combo-stock';

// ─────────────────────────────────────────────────────────────────────────────
// Shared test fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal element-like object understood by buildComboViewModel / buildStockViewModel. */
function makeElement(width = 400, height = 300) {
	return {
		id: 'el-test',
		type: 'chart' as const,
		x: 0,
		y: 0,
		width,
		height,
	};
}

const CATEGORIES = ['Q1', 'Q2', 'Q3', 'Q4'];

// ─────────────────────────────────────────────────────────────────────────────
// buildComboViewModel
// ─────────────────────────────────────────────────────────────────────────────

describe('buildComboViewModel', () => {
	// ── basic output shape ────────────────────────────────────────────────────

	it('returns a ChartViewModel with all required fields', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: CATEGORIES,
			series: [
				{ name: 'Revenue', values: [100, 120, 90, 150] },
				{ name: 'Growth', values: [10, 20, -10, 30] },
			],
		};
		const vm = buildComboViewModel(makeElement(), chartData, CATEGORIES);
		expect(vm).toHaveProperty('svgWidth');
		expect(vm).toHaveProperty('svgHeight');
		expect(vm).toHaveProperty('gridlines');
		expect(vm).toHaveProperty('axisLabels');
		expect(vm).toHaveProperty('zeroLine');
		expect(vm).toHaveProperty('categoryLabels');
		expect(vm).toHaveProperty('primitives');
		expect(vm).toHaveProperty('dataLabels');
		expect(vm).toHaveProperty('legend');
	});

	// ── cartesian chrome ──────────────────────────────────────────────────────

	it('includes gridlines and axis labels (cartesian chart)', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: CATEGORIES,
			series: [
				{ name: 'Bars', values: [10, 20, 30, 40] },
				{ name: 'Line', values: [5, 15, 25, 35] },
			],
		};
		const vm = buildComboViewModel(makeElement(), chartData, CATEGORIES);
		expect(vm.gridlines.length).toBeGreaterThan(0);
		expect(vm.axisLabels.length).toBeGreaterThan(0);
	});

	it('includes category labels along the X axis', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: CATEGORIES,
			series: [
				{ name: 'Bars', values: [1, 2, 3, 4] },
				{ name: 'Line', values: [4, 3, 2, 1] },
			],
		};
		const vm = buildComboViewModel(makeElement(), chartData, CATEGORIES);
		expect(vm.categoryLabels).toHaveLength(CATEGORIES.length);
		expect(vm.categoryLabels[0].text).toBe('Q1');
		expect(vm.categoryLabels[3].text).toBe('Q4');
	});

	// ── series → primitive mapping ────────────────────────────────────────────

	it('produces rect primitives for the first (bar) series', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: CATEGORIES,
			series: [
				{ name: 'Bars', values: [10, 20, 30, 40] },
				{ name: 'Line', values: [5, 15, 25, 35] },
			],
		};
		const vm = buildComboViewModel(makeElement(), chartData, CATEGORIES);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		// One bar per category.
		expect(rects).toHaveLength(CATEGORIES.length);
	});

	it('produces polyline primitives for line series (series[1+])', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: CATEGORIES,
			series: [
				{ name: 'Bars', values: [10, 20, 30, 40] },
				{ name: 'Line A', values: [5, 15, 25, 35] },
				{ name: 'Line B', values: [4, 14, 24, 34] },
			],
		};
		const vm = buildComboViewModel(makeElement(), chartData, CATEGORIES);
		const polylines = vm.primitives.filter((p) => p.kind === 'polyline');
		// One polyline per line series.
		expect(polylines).toHaveLength(2);
	});

	it('produces BOTH rect and polyline primitives in the same view-model', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: CATEGORIES,
			series: [
				{ name: 'Bars', values: [10, 20, 30, 40] },
				{ name: 'Line', values: [5, 15, 25, 35] },
			],
		};
		const vm = buildComboViewModel(makeElement(), chartData, CATEGORIES);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		const polylines = vm.primitives.filter((p) => p.kind === 'polyline');
		expect(rects.length).toBeGreaterThan(0);
		expect(polylines.length).toBeGreaterThan(0);
	});

	it('renders schema-valid X and Y error bars for mixed combo series', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: CATEGORIES,
			series: [
				{
					name: 'Bars',
					values: [10, 20, 30, 40],
					seriesChartType: 'bar',
					errBars: [
						{
							direction: 'x',
							barType: 'plus',
							valType: 'fixedVal',
							val: 0.25,
							noEndCap: true,
							color: '#aa0000',
						},
					],
				},
				{
					name: 'Line',
					values: [5, 15, 25, 35],
					seriesChartType: 'line',
					errBars: [
						{
							direction: 'y',
							barType: 'minus',
							valType: 'percentage',
							val: 10,
							noEndCap: true,
							color: '#00aa00',
						},
					],
				},
			],
		};
		const vm = buildComboViewModel(makeElement(), chartData, CATEGORIES);
		expect(vm.primitives.filter((p) => p.kind === 'line' && p.stroke === '#aa0000')).toHaveLength(
			4,
		);
		expect(vm.primitives.filter((p) => p.kind === 'line' && p.stroke === '#00aa00')).toHaveLength(
			4,
		);
	});

	it('reverses category order and retains combo source point indexes', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: ['Q1', 'Q2', 'Q3'],
			series: [
				{ name: 'Bars', values: [10, 20, 30] },
				{ name: 'Line', values: [1, 2, 3] },
			],
			axes: [{ axisType: 'dateAx', orientation: 'maxMin' }],
		};
		const vm = buildComboViewModel(makeElement(), chartData, chartData.categories);
		const rects = vm.primitives.filter((primitive) => primitive.kind === 'rect');
		const circles = vm.primitives.filter((primitive) => primitive.kind === 'circle');
		expect(vm.categoryLabels.map((label) => label.text)).toStrictEqual(['Q3', 'Q2', 'Q1']);
		expect(rects.map((rect) => rect.part?.pointIndex)).toStrictEqual([2, 1, 0]);
		expect(circles.map((circle) => circle.part?.pointIndex)).toStrictEqual([2, 1, 0]);
	});

	it('produces circle dot primitives for line series data points', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: CATEGORIES,
			series: [
				{ name: 'Bars', values: [10, 20, 30, 40] },
				{ name: 'Line', values: [5, 15, 25, 35] },
			],
		};
		const vm = buildComboViewModel(makeElement(), chartData, CATEGORIES);
		const circles = vm.primitives.filter((p) => p.kind === 'circle');
		// One circle per data point per line series.
		expect(circles).toHaveLength(CATEGORIES.length);
	});

	it('scales an axis-mapped line series against the secondary value axis', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: ['Q1', 'Q2'],
			series: [
				{ name: 'Revenue', values: [1000, 2000], axisId: 20, seriesChartType: 'bar' },
				{ name: 'Margin', values: [1, 2], axisId: 40, seriesChartType: 'line' },
			],
			axes: [
				{ axisType: 'catAx', axisId: 10, crossAxisId: 20, axPos: 'b' },
				{ axisType: 'valAx', axisId: 20, crossAxisId: 10, axPos: 'l' },
				{ axisType: 'catAx', axisId: 30, crossAxisId: 40, axPos: 't' },
				{ axisType: 'valAx', axisId: 40, crossAxisId: 30, axPos: 'r' },
			],
		};
		const vm = buildComboViewModel(makeElement(), chartData, chartData.categories);
		const line = vm.primitives.find((primitive) => primitive.kind === 'polyline');

		expect(line?.kind).toBe('polyline');
		const yCoordinates =
			line?.kind === 'polyline'
				? line.points.split(' ').map((point) => Number(point.split(',')[1]))
				: [];
		expect(Math.abs((yCoordinates[0] ?? 0) - (yCoordinates[1] ?? 0))).toBeGreaterThan(100);
		expect(vm.secondaryGridlines).toBeDefined();
		expect(vm.secondaryAxisLabels?.some((label) => label.text === '2')).toBeTruthy();
	});

	it('honours explicit secondary-axis bounds for combo line placement', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: ['Q1', 'Q2'],
			series: [
				{ name: 'Revenue', values: [1000, 2000], axisId: 20 },
				{ name: 'Margin', values: [1, 2], axisId: 40 },
			],
			axes: [
				{ axisType: 'valAx', axisId: 20, axPos: 'l' },
				{ axisType: 'valAx', axisId: 40, axPos: 'r', min: 0, max: 10 },
			],
		};
		const vm = buildComboViewModel(makeElement(), chartData, chartData.categories);
		const line = vm.primitives.find((primitive) => primitive.kind === 'polyline');
		const yCoordinates =
			line?.kind === 'polyline'
				? line.points.split(' ').map((point) => Number(point.split(',')[1]))
				: [];

		expect(Math.abs((yCoordinates[0] ?? 0) - (yCoordinates[1] ?? 0))).toBeLessThan(50);
		expect(vm.secondaryAxisLabels?.map((label) => label.text)).toContain('10');
	});

	it('honours a logarithmic secondary axis for combo line placement and ticks', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: ['Q1', 'Q2', 'Q3'],
			series: [
				{ name: 'Revenue', values: [1000, 2000, 3000], axisId: 20 },
				{ name: 'Ratio', values: [1, 10, 1000], axisId: 40 },
			],
			axes: [
				{ axisType: 'valAx', axisId: 20, axPos: 'l' },
				{
					axisType: 'valAx',
					axisId: 40,
					axPos: 'r',
					min: 1,
					max: 1000,
					logScale: true,
					logBase: 10,
				},
			],
		};
		const vm = buildComboViewModel(makeElement(), chartData, chartData.categories);
		const circles = vm.primitives.filter((primitive) => primitive.kind === 'circle');

		expect(circles).toHaveLength(3);
		expect(circles[0]?.cy).toBeGreaterThan(circles[1]?.cy ?? 0);
		expect(circles[1]?.cy).toBeGreaterThan(circles[2]?.cy ?? 0);
		expect(vm.secondaryAxisLabels?.map((label) => label.text)).toStrictEqual([
			'1',
			'10',
			'100',
			'1.0K',
		]);
	});

	it('counts primitives correctly for two line series', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: CATEGORIES,
			series: [
				{ name: 'Bars', values: [10, 20, 30, 40] },
				{ name: 'Line A', values: [5, 15, 25, 35] },
				{ name: 'Line B', values: [2, 12, 22, 32] },
			],
		};
		const vm = buildComboViewModel(makeElement(), chartData, CATEGORIES);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		const polylines = vm.primitives.filter((p) => p.kind === 'polyline');
		const circles = vm.primitives.filter((p) => p.kind === 'circle');
		expect(rects).toHaveLength(4); // 4 categories × 1 bar series
		expect(polylines).toHaveLength(2); // 2 line series
		expect(circles).toHaveLength(8); // 4 points × 2 line series
	});

	// ── legend ────────────────────────────────────────────────────────────────

	it('includes one legend entry per series when hasLegend is true', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: CATEGORIES,
			series: [
				{ name: 'Bars', values: [10, 20, 30, 40] },
				{ name: 'Line', values: [5, 15, 25, 35] },
			],
			style: { hasLegend: true, legendPosition: 'b' },
		};
		const vm = buildComboViewModel(makeElement(), chartData, CATEGORIES);
		expect(vm.legend).toHaveLength(2);
		expect(vm.legend[0].label).toBe('Bars');
		expect(vm.legend[1].label).toBe('Line');
	});

	it('produces an empty legend when hasLegend is false', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: CATEGORIES,
			series: [
				{ name: 'Bars', values: [1, 2, 3, 4] },
				{ name: 'Line', values: [4, 3, 2, 1] },
			],
			style: { hasLegend: false },
		};
		const vm = buildComboViewModel(makeElement(), chartData, CATEGORIES);
		expect(vm.legend).toHaveLength(0);
	});

	// ── title ─────────────────────────────────────────────────────────────────

	it('returns the chart title when hasTitle and title are set', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: CATEGORIES,
			series: [
				{ name: 'Bars', values: [1, 2, 3, 4] },
				{ name: 'Line', values: [4, 3, 2, 1] },
			],
			title: 'My Combo',
			style: { hasTitle: true },
		};
		const vm = buildComboViewModel(makeElement(), chartData, CATEGORIES);
		expect(vm.title).toBe('My Combo');
	});

	it('returns undefined title when hasTitle is false', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: CATEGORIES,
			series: [{ name: 'Bars', values: [1, 2, 3, 4] }],
			title: 'Hidden',
			style: { hasTitle: false },
		};
		const vm = buildComboViewModel(makeElement(), chartData, CATEGORIES);
		expect(vm.title).toBeUndefined();
	});

	// ── zero line ─────────────────────────────────────────────────────────────

	it('emits a zero line when values span both positive and negative', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: CATEGORIES,
			series: [
				{ name: 'Bars', values: [10, -5, 20, -10] },
				{ name: 'Line', values: [5, -2, 15, -8] },
			],
		};
		const vm = buildComboViewModel(makeElement(), chartData, CATEGORIES);
		expect(vm.zeroLine).toBeDefined();
	});

	it('has no zero line when all values are non-negative', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: CATEGORIES,
			series: [
				{ name: 'Bars', values: [5, 10, 15, 20] },
				{ name: 'Line', values: [1, 2, 3, 4] },
			],
		};
		const vm = buildComboViewModel(makeElement(), chartData, CATEGORIES);
		expect(vm.zeroLine).toBeUndefined();
	});

	// ── data labels ───────────────────────────────────────────────────────────

	it('produces data labels for bar and line series when hasDataLabels is true', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: CATEGORIES,
			series: [
				{ name: 'Bars', values: [10, 20, 30, 40] },
				{ name: 'Line', values: [5, 15, 25, 35] },
			],
			style: { hasDataLabels: true },
		};
		const vm = buildComboViewModel(makeElement(), chartData, CATEGORIES);
		// 4 bar labels + 4 line labels = 8.
		expect(vm.dataLabels).toHaveLength(8);
	});

	it('produces no data labels when hasDataLabels is false', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: CATEGORIES,
			series: [
				{ name: 'Bars', values: [10, 20, 30, 40] },
				{ name: 'Line', values: [5, 15, 25, 35] },
			],
			style: { hasDataLabels: false },
		};
		const vm = buildComboViewModel(makeElement(), chartData, CATEGORIES);
		expect(vm.dataLabels).toHaveLength(0);
	});

	// ── edge cases ────────────────────────────────────────────────────────────

	it('does not crash when the series array is empty', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: CATEGORIES,
			series: [],
		};
		expect(() => buildComboViewModel(makeElement(), chartData, CATEGORIES)).not.toThrow();
	});

	it('does not crash when only the bar series is present (no line series)', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: CATEGORIES,
			series: [{ name: 'OnlyBars', values: [10, 20, 30, 40] }],
		};
		const vm = buildComboViewModel(makeElement(), chartData, CATEGORIES);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		const polylines = vm.primitives.filter((p) => p.kind === 'polyline');
		expect(rects).toHaveLength(CATEGORIES.length);
		expect(polylines).toHaveLength(0);
	});

	it('does not crash when a line series has no values', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: CATEGORIES,
			series: [
				{ name: 'Bars', values: [1, 2, 3, 4] },
				{ name: 'EmptyLine', values: [] },
			],
		};
		expect(() => buildComboViewModel(makeElement(), chartData, CATEGORIES)).not.toThrow();
		const vm = buildComboViewModel(makeElement(), chartData, CATEGORIES);
		const polylines = vm.primitives.filter((p) => p.kind === 'polyline');
		// Empty line series is skipped.
		expect(polylines).toHaveLength(0);
	});

	it('does not crash with an empty category list', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: [],
			series: [
				{ name: 'Bars', values: [5, 10] },
				{ name: 'Line', values: [3, 7] },
			],
		};
		expect(() => buildComboViewModel(makeElement(), chartData, [])).not.toThrow();
	});

	it('enforces minimum SVG dimensions', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: [],
			series: [{ name: 'Bars', values: [1] }],
		};
		const vm = buildComboViewModel(makeElement(10, 10), chartData, []);
		expect(vm.svgWidth).toBeGreaterThanOrEqual(320);
		expect(vm.svgHeight).toBeGreaterThanOrEqual(180);
	});

	// ── series colour ─────────────────────────────────────────────────────────

	it('uses the series color property for bar rects when present', () => {
		const chartData: PptxChartData = {
			chartType: 'combo',
			categories: ['A'],
			series: [
				{ name: 'Bars', values: [42], color: '#abcdef' },
				{ name: 'Line', values: [7] },
			],
		};
		const vm = buildComboViewModel(makeElement(), chartData, ['A']);
		const rect = vm.primitives.find((p) => p.kind === 'rect');
		expect(rect).toBeDefined();
		if (rect && rect.kind === 'rect') {
			expect(rect.fill).toBe('#abcdef');
		}
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildStockViewModel
// ─────────────────────────────────────────────────────────────────────────────

describe('buildStockViewModel', () => {
	// ── basic output shape ────────────────────────────────────────────────────

	it('returns a ChartViewModel with all required fields', () => {
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: CATEGORIES,
			series: [
				{ name: 'High', values: [110, 125, 105, 140] },
				{ name: 'Low', values: [90, 100, 85, 115] },
				{ name: 'Close', values: [105, 115, 95, 130] },
			],
		};
		const vm = buildStockViewModel(makeElement(), chartData, CATEGORIES);
		expect(vm).toHaveProperty('svgWidth');
		expect(vm).toHaveProperty('svgHeight');
		expect(vm).toHaveProperty('gridlines');
		expect(vm).toHaveProperty('axisLabels');
		expect(vm).toHaveProperty('primitives');
		expect(vm).toHaveProperty('categoryLabels');
		expect(vm).toHaveProperty('legend');
	});

	// ── cartesian chrome ──────────────────────────────────────────────────────

	it('includes gridlines and axis labels', () => {
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: CATEGORIES,
			series: [
				{ name: 'High', values: [110, 125, 105, 140] },
				{ name: 'Low', values: [90, 100, 85, 115] },
				{ name: 'Close', values: [105, 115, 95, 130] },
			],
		};
		const vm = buildStockViewModel(makeElement(), chartData, CATEGORIES);
		expect(vm.gridlines.length).toBeGreaterThan(0);
		expect(vm.axisLabels.length).toBeGreaterThan(0);
	});

	it('includes category labels along the X axis', () => {
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: CATEGORIES,
			series: [
				{ name: 'High', values: [110, 125, 105, 140] },
				{ name: 'Low', values: [90, 100, 85, 115] },
				{ name: 'Close', values: [105, 115, 95, 130] },
			],
		};
		const vm = buildStockViewModel(makeElement(), chartData, CATEGORIES);
		expect(vm.categoryLabels).toHaveLength(CATEGORIES.length);
		expect(vm.categoryLabels[0].text).toBe('Q1');
	});

	// ── HLC series → primitive counts ─────────────────────────────────────────

	it('produces one wick line per category (HLC)', () => {
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: CATEGORIES,
			series: [
				{ name: 'High', values: [110, 125, 105, 140] },
				{ name: 'Low', values: [90, 100, 85, 115] },
				{ name: 'Close', values: [105, 115, 95, 130] },
			],
		};
		const vm = buildStockViewModel(makeElement(), chartData, CATEGORIES);
		const lines = vm.primitives.filter((p) => p.kind === 'line');
		expect(lines).toHaveLength(CATEGORIES.length);
	});

	it('produces one body rect per category (HLC)', () => {
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: CATEGORIES,
			series: [
				{ name: 'High', values: [110, 125, 105, 140] },
				{ name: 'Low', values: [90, 100, 85, 115] },
				{ name: 'Close', values: [105, 115, 95, 130] },
			],
		};
		const vm = buildStockViewModel(makeElement(), chartData, CATEGORIES);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects).toHaveLength(CATEGORIES.length);
	});

	// ── OHLC series → primitive counts ────────────────────────────────────────

	it('produces one wick line per category (OHLC)', () => {
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: CATEGORIES,
			series: [
				{ name: 'Open', values: [100, 110, 95, 120] },
				{ name: 'High', values: [110, 125, 105, 140] },
				{ name: 'Low', values: [90, 100, 85, 115] },
				{ name: 'Close', values: [105, 115, 95, 130] },
			],
		};
		const vm = buildStockViewModel(makeElement(), chartData, CATEGORIES);
		const lines = vm.primitives.filter((p) => p.kind === 'line');
		expect(lines).toHaveLength(CATEGORIES.length);
	});

	it('produces one body rect per category (OHLC)', () => {
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: CATEGORIES,
			series: [
				{ name: 'Open', values: [100, 110, 95, 120] },
				{ name: 'High', values: [110, 125, 105, 140] },
				{ name: 'Low', values: [90, 100, 85, 115] },
				{ name: 'Close', values: [105, 115, 95, 130] },
			],
		};
		const vm = buildStockViewModel(makeElement(), chartData, CATEGORIES);
		const rects = vm.primitives.filter((p) => p.kind === 'rect');
		expect(rects).toHaveLength(CATEGORIES.length);
	});

	it('total primitive count is 2× catCount (one wick + one body per candle)', () => {
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: CATEGORIES,
			series: [
				{ name: 'High', values: [110, 125, 105, 140] },
				{ name: 'Low', values: [90, 100, 85, 115] },
				{ name: 'Close', values: [105, 115, 95, 130] },
			],
		};
		const vm = buildStockViewModel(makeElement(), chartData, CATEGORIES);
		expect(vm.primitives).toHaveLength(CATEGORIES.length * 2);
	});

	// ── candle body colour (up/down) ──────────────────────────────────────────

	it('colours up-candle bodies green (close >= open in HLC mode, open = low)', () => {
		// In HLC mode open defaults to low. If close > low the candle is "up".
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: ['D1'],
			series: [
				{ name: 'High', values: [110] },
				{ name: 'Low', values: [90] },
				{ name: 'Close', values: [105] }, // close 105 > low 90 → isUp
			],
		};
		const vm = buildStockViewModel(makeElement(), chartData, ['D1']);
		const rect = vm.primitives.find((p) => p.kind === 'rect');
		expect(rect).toBeDefined();
		if (rect && rect.kind === 'rect') {
			expect(rect.fill).toBe('#22c55e'); // CANDLE_UP_FILL
		}
	});

	it('colours down-candle bodies red (close < open in OHLC mode)', () => {
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: ['D1'],
			series: [
				{ name: 'Open', values: [110] },
				{ name: 'High', values: [115] },
				{ name: 'Low', values: [90] },
				{ name: 'Close', values: [95] }, // close 95 < open 110 → isDown
			],
		};
		const vm = buildStockViewModel(makeElement(), chartData, ['D1']);
		const rect = vm.primitives.find((p) => p.kind === 'rect');
		expect(rect).toBeDefined();
		if (rect && rect.kind === 'rect') {
			expect(rect.fill).toBe('#ef4444'); // CANDLE_DOWN_FILL
		}
	});

	it('colours up-candle bodies green when close === open (OHLC doji)', () => {
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: ['D1'],
			series: [
				{ name: 'Open', values: [100] },
				{ name: 'High', values: [110] },
				{ name: 'Low', values: [90] },
				{ name: 'Close', values: [100] }, // close === open → isUp (doji treated as up)
			],
		};
		const vm = buildStockViewModel(makeElement(), chartData, ['D1']);
		const rect = vm.primitives.find((p) => p.kind === 'rect');
		if (rect && rect.kind === 'rect') {
			expect(rect.fill).toBe('#22c55e');
		}
	});

	// ── wick geometry ─────────────────────────────────────────────────────────

	it('wick line spans the full high-low range (y1 < y2 in SVG, since high maps to lower Y)', () => {
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: ['D1'],
			series: [
				{ name: 'High', values: [200] },
				{ name: 'Low', values: [100] },
				{ name: 'Close', values: [150] },
			],
		};
		const vm = buildStockViewModel(makeElement(), chartData, ['D1']);
		const line = vm.primitives.find((p) => p.kind === 'line');
		expect(line).toBeDefined();
		if (line && line.kind === 'line') {
			// In SVG high value → smaller Y (higher on screen), low value → larger Y.
			expect(line.y1).toBeLessThan(line.y2);
			// Wick is vertical: same x coordinate on both ends.
			expect(line.x1).toBe(line.x2);
		}
	});

	// ── body rect geometry ────────────────────────────────────────────────────

	it('body rect always has a positive height (minimum 1px)', () => {
		// Degenerate case: open === close → body height should be clamped to 1.
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: ['D1'],
			series: [
				{ name: 'Open', values: [100] },
				{ name: 'High', values: [110] },
				{ name: 'Low', values: [90] },
				{ name: 'Close', values: [100] }, // same as open
			],
		};
		const vm = buildStockViewModel(makeElement(), chartData, ['D1']);
		const rect = vm.primitives.find((p) => p.kind === 'rect');
		if (rect && rect.kind === 'rect') {
			expect(rect.h).toBeGreaterThanOrEqual(1);
		}
	});

	// ── legend ────────────────────────────────────────────────────────────────

	it('includes one legend entry per series when hasLegend is true', () => {
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: CATEGORIES,
			series: [
				{ name: 'High', values: [110, 125, 105, 140] },
				{ name: 'Low', values: [90, 100, 85, 115] },
				{ name: 'Close', values: [105, 115, 95, 130] },
			],
			style: { hasLegend: true },
		};
		const vm = buildStockViewModel(makeElement(), chartData, CATEGORIES);
		expect(vm.legend).toHaveLength(3);
		expect(vm.legend[0].label).toBe('High');
		expect(vm.legend[2].label).toBe('Close');
	});

	it('produces an empty legend when hasLegend is false', () => {
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: CATEGORIES,
			series: [
				{ name: 'High', values: [110, 125, 105, 140] },
				{ name: 'Low', values: [90, 100, 85, 115] },
				{ name: 'Close', values: [105, 115, 95, 130] },
			],
			style: { hasLegend: false },
		};
		const vm = buildStockViewModel(makeElement(), chartData, CATEGORIES);
		expect(vm.legend).toHaveLength(0);
	});

	// ── title ─────────────────────────────────────────────────────────────────

	it('returns the chart title when hasTitle and title are set', () => {
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: CATEGORIES,
			series: [
				{ name: 'High', values: [110, 125, 105, 140] },
				{ name: 'Low', values: [90, 100, 85, 115] },
				{ name: 'Close', values: [105, 115, 95, 130] },
			],
			title: 'ACME Stock',
			style: { hasTitle: true },
		};
		const vm = buildStockViewModel(makeElement(), chartData, CATEGORIES);
		expect(vm.title).toBe('ACME Stock');
	});

	// ── data labels ───────────────────────────────────────────────────────────

	it('produces one data label per category when hasDataLabels is true', () => {
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: CATEGORIES,
			series: [
				{ name: 'High', values: [110, 125, 105, 140] },
				{ name: 'Low', values: [90, 100, 85, 115] },
				{ name: 'Close', values: [105, 115, 95, 130] },
			],
			style: { hasDataLabels: true },
		};
		const vm = buildStockViewModel(makeElement(), chartData, CATEGORIES);
		// One label per candle showing the close value.
		expect(vm.dataLabels).toHaveLength(CATEGORIES.length);
	});

	it('data labels show the close value', () => {
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: ['D1'],
			series: [
				{ name: 'High', values: [110] },
				{ name: 'Low', values: [90] },
				{ name: 'Close', values: [103] },
			],
			style: { hasDataLabels: true },
		};
		const vm = buildStockViewModel(makeElement(), chartData, ['D1']);
		expect(vm.dataLabels).toHaveLength(1);
		expect(vm.dataLabels[0].text).toBe('103');
	});

	it('produces no data labels when hasDataLabels is not set', () => {
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: CATEGORIES,
			series: [
				{ name: 'High', values: [110, 125, 105, 140] },
				{ name: 'Low', values: [90, 100, 85, 115] },
				{ name: 'Close', values: [105, 115, 95, 130] },
			],
		};
		const vm = buildStockViewModel(makeElement(), chartData, CATEGORIES);
		expect(vm.dataLabels).toHaveLength(0);
	});

	it('reverses stock candles while keeping close-series source indexes', () => {
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: ['D1', 'D2', 'D3'],
			series: [
				{ name: 'High', values: [11, 22, 33] },
				{ name: 'Low', values: [8, 18, 28] },
				{ name: 'Close', values: [10, 20, 30] },
			],
			axes: [{ axisType: 'dateAx', orientation: 'maxMin' }],
		};
		const vm = buildStockViewModel(makeElement(), chartData, chartData.categories);
		const bodies = vm.primitives.filter((primitive) => primitive.kind === 'rect');
		expect(vm.categoryLabels.map((label) => label.text)).toStrictEqual(['D3', 'D2', 'D1']);
		expect(bodies.map((body) => body.part?.pointIndex)).toStrictEqual([2, 1, 0]);
		expect(bodies.every((body) => body.part?.seriesIndex === 2)).toBeTruthy();
	});

	// ── edge cases ────────────────────────────────────────────────────────────

	it('does not crash when series array is empty', () => {
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: CATEGORIES,
			series: [],
		};
		expect(() => buildStockViewModel(makeElement(), chartData, CATEGORIES)).not.toThrow();
		const vm = buildStockViewModel(makeElement(), chartData, CATEGORIES);
		// No series → no primitives.
		expect(vm.primitives).toHaveLength(0);
	});

	it('does not crash with only one series (insufficient for OHLC — treated as empty)', () => {
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: CATEGORIES,
			series: [{ name: 'High', values: [110, 125, 105, 140] }],
		};
		expect(() => buildStockViewModel(makeElement(), chartData, CATEGORIES)).not.toThrow();
		const vm = buildStockViewModel(makeElement(), chartData, CATEGORIES);
		// Only one series cannot form high+low+close → no primitives.
		expect(vm.primitives).toHaveLength(0);
	});

	it('does not crash with an empty category list', () => {
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: [],
			series: [
				{ name: 'High', values: [] },
				{ name: 'Low', values: [] },
				{ name: 'Close', values: [] },
			],
		};
		expect(() => buildStockViewModel(makeElement(), chartData, [])).not.toThrow();
	});

	it('enforces minimum SVG dimensions', () => {
		const chartData: PptxChartData = {
			chartType: 'stock',
			categories: [],
			series: [],
		};
		const vm = buildStockViewModel(makeElement(10, 10), chartData, []);
		expect(vm.svgWidth).toBeGreaterThanOrEqual(320);
		expect(vm.svgHeight).toBeGreaterThanOrEqual(180);
	});
});
