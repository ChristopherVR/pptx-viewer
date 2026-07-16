/**
 * chart-overlays.test.ts — unit tests for chart-overlays.ts.
 *
 * Tests are grouped by exported function:
 *   - computeLinearRegression  (regression helpers)
 *   - fitPolynomial
 *   - computeRSquared
 *   - computeTrendlinePrimitives
 *   - computeErrorBarPrimitives
 *   - computeAxisTitlePrimitives
 *   - computeDataTablePrimitives
 *
 * Ported from:
 *   packages/shared/src/render/chart-trendlines.test.ts
 *   packages/vue/src/viewer/components/chart/ChartTrendlines.test.ts
 */

import type {
	PptxChartAxisFormatting,
	PptxChartData,
	PptxChartErrBars,
	PptxChartSeries,
	PptxChartTrendline,
} from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	DATA_TABLE_HEADER_H,
	DATA_TABLE_KEY_W,
	DATA_TABLE_ROW_H,
	computeAxisTitlePrimitives,
	computeDataTablePrimitives,
	computeErrorBarPrimitives,
	computeLinearRegression,
	computeRSquared,
	computeTrendlinePrimitives,
	fitPolynomial,
} from './chart-overlays';
import type { PlotLayout, ValueRange } from './chart-view-model';

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────

const LAYOUT: PlotLayout = {
	svgWidth: 400,
	svgHeight: 300,
	plotLeft: 48,
	plotTop: 20,
	plotRight: 392,
	plotBottom: 276,
	plotWidth: 344,
	plotHeight: 256,
};

const RANGE: ValueRange = {
	min: 0,
	max: 100,
	span: 100,
};

function makeChartData(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'line',
		categories: ['A', 'B', 'C', 'D'],
		series: [],
		...overrides,
	};
}

function makeSeries(overrides: Partial<PptxChartSeries> = {}): PptxChartSeries {
	return {
		name: 'Series 1',
		values: [10, 20, 30, 40],
		...overrides,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// computeLinearRegression
// ─────────────────────────────────────────────────────────────────────────────

describe('computeLinearRegression', () => {
	it('returns slope=1 intercept=0 for y=x data', () => {
		const xs = [0, 1, 2, 3];
		const ys = [0, 1, 2, 3];
		const { slope, intercept, rSquared } = computeLinearRegression(xs, ys);
		expect(slope).toBeCloseTo(1, 6);
		expect(intercept).toBeCloseTo(0, 6);
		expect(rSquared).toBeCloseTo(1, 6);
	});

	it('returns slope=2 intercept=1 for y=2x+1 data', () => {
		const xs = [0, 1, 2, 3, 4];
		const ys = xs.map((x) => 2 * x + 1);
		const { slope, intercept, rSquared } = computeLinearRegression(xs, ys);
		expect(slope).toBeCloseTo(2, 5);
		expect(intercept).toBeCloseTo(1, 5);
		expect(rSquared).toBeCloseTo(1, 5);
	});

	it('returns rSquared < 1 for noisy data', () => {
		const xs = [0, 1, 2, 3, 4];
		const ys = [0, 2, 1, 4, 3];
		const { rSquared } = computeLinearRegression(xs, ys);
		expect(rSquared).toBeGreaterThan(0);
		expect(rSquared).toBeLessThan(1);
	});

	it('returns zeros for fewer than 2 points', () => {
		const result = computeLinearRegression([1], [1]);
		expect(result.slope).toBe(0);
		expect(result.intercept).toBe(0);
		expect(result.rSquared).toBe(0);
	});

	it('handles zero denominator (all x equal)', () => {
		const result = computeLinearRegression([2, 2, 2], [1, 2, 3]);
		expect(result.slope).toBe(0);
		expect(result.intercept).toBeCloseTo(2, 6); // mean of y
		expect(result.rSquared).toBe(0);
	});

	it('returns zero for empty arrays', () => {
		const result = computeLinearRegression([], []);
		expect(result.slope).toBe(0);
		expect(result.intercept).toBe(0);
		expect(result.rSquared).toBe(0);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// fitPolynomial
// ─────────────────────────────────────────────────────────────────────────────

describe('fitPolynomial', () => {
	it('recovers linear coefficients for degree-1 fit', () => {
		const xs = [0, 1, 2, 3];
		const ys = xs.map((x) => 3 * x + 5);
		const coeffs = fitPolynomial(xs, ys, 1);
		// coeffs[0] = intercept, coeffs[1] = slope
		expect(coeffs[0]).toBeCloseTo(5, 4);
		expect(coeffs[1]).toBeCloseTo(3, 4);
	});

	it('recovers quadratic coefficients for degree-2 fit', () => {
		const xs = [0, 1, 2, 3, 4];
		const ys = xs.map((x) => x * x - 2 * x + 1);
		const coeffs = fitPolynomial(xs, ys, 2);
		expect(coeffs[0]).toBeCloseTo(1, 3);
		expect(coeffs[1]).toBeCloseTo(-2, 3);
		expect(coeffs[2]).toBeCloseTo(1, 3);
	});

	it('returns an array of length order+1', () => {
		const xs = [0, 1, 2, 3, 4, 5];
		const ys = xs.map((x) => x * x);
		expect(fitPolynomial(xs, ys, 3)).toHaveLength(4);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// computeRSquared
// ─────────────────────────────────────────────────────────────────────────────

describe('computeRSquared', () => {
	it('returns 1 for a perfect fit', () => {
		const xs = [0, 1, 2, 3];
		const ys = [0, 1, 2, 3];
		const r2 = computeRSquared(xs, ys, (x) => x);
		expect(r2).toBeCloseTo(1, 6);
	});

	it('returns 0 for a constant prediction on non-constant data', () => {
		const xs = [0, 1, 2, 3];
		const ys = [0, 1, 4, 9];
		const meanY = ys.reduce((s, y) => s + y, 0) / ys.length;
		const r2 = computeRSquared(xs, ys, () => meanY);
		expect(r2).toBeCloseTo(0, 6);
	});

	it('returns 0 for empty arrays', () => {
		const r2 = computeRSquared([], [], (x) => x);
		expect(r2).toBe(0);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// computeTrendlinePrimitives
// ─────────────────────────────────────────────────────────────────────────────

describe('computeTrendlinePrimitives', () => {
	it('returns empty array when no series has trendlines', () => {
		const chartData = makeChartData({ series: [makeSeries()] });
		const result = computeTrendlinePrimitives(chartData, 4, LAYOUT, RANGE);
		expect(result).toHaveLength(0);
	});

	it('returns a path primitive for a linear trendline', () => {
		const trendline: PptxChartTrendline = { trendlineType: 'linear' };
		const chartData = makeChartData({
			series: [makeSeries({ trendlines: [trendline] })],
		});
		const result = computeTrendlinePrimitives(chartData, 4, LAYOUT, RANGE);
		expect(result.length).toBeGreaterThanOrEqual(1);
		expect(result[0].kind).toBe('path');
	});

	it('adds an equation label text when displayEq is true', () => {
		const trendline: PptxChartTrendline = { trendlineType: 'linear', displayEq: true };
		const chartData = makeChartData({
			series: [makeSeries({ trendlines: [trendline] })],
		});
		const result = computeTrendlinePrimitives(chartData, 4, LAYOUT, RANGE);
		const texts = result.filter((p) => p.kind === 'text');
		expect(texts.length).toBeGreaterThanOrEqual(1);
	});

	it('adds an R² label text when displayRSq is true', () => {
		const trendline: PptxChartTrendline = { trendlineType: 'linear', displayRSq: true };
		const chartData = makeChartData({
			series: [makeSeries({ trendlines: [trendline] })],
		});
		const result = computeTrendlinePrimitives(chartData, 4, LAYOUT, RANGE);
		const textPrimitive = result.find((p) => p.kind === 'text');
		expect(textPrimitive).toBeDefined();
		if (textPrimitive?.kind === 'text') {
			expect(textPrimitive.text).toContain('R');
		}
	});

	it('handles exponential trendline without crashing', () => {
		const trendline: PptxChartTrendline = { trendlineType: 'exponential' };
		const chartData = makeChartData({
			series: [makeSeries({ values: [1, 4, 9, 16], trendlines: [trendline] })],
		});
		expect(() => computeTrendlinePrimitives(chartData, 4, LAYOUT, RANGE)).not.toThrow();
	});

	it('handles logarithmic trendline without crashing', () => {
		const trendline: PptxChartTrendline = { trendlineType: 'logarithmic' };
		const chartData = makeChartData({
			series: [makeSeries({ values: [1, 3, 6, 10], trendlines: [trendline] })],
		});
		expect(() => computeTrendlinePrimitives(chartData, 4, LAYOUT, RANGE)).not.toThrow();
	});

	it('handles power trendline without crashing', () => {
		const trendline: PptxChartTrendline = { trendlineType: 'power' };
		const chartData = makeChartData({
			series: [makeSeries({ values: [1, 4, 9, 16], trendlines: [trendline] })],
		});
		expect(() => computeTrendlinePrimitives(chartData, 4, LAYOUT, RANGE)).not.toThrow();
	});

	it('handles polynomial trendline without crashing', () => {
		const trendline: PptxChartTrendline = { trendlineType: 'polynomial', order: 2 };
		const chartData = makeChartData({
			series: [makeSeries({ trendlines: [trendline] })],
		});
		expect(() => computeTrendlinePrimitives(chartData, 4, LAYOUT, RANGE)).not.toThrow();
	});

	it('handles movingAvg trendline without crashing', () => {
		const trendline: PptxChartTrendline = { trendlineType: 'movingAvg', period: 2 };
		const chartData = makeChartData({
			series: [makeSeries({ trendlines: [trendline] })],
		});
		expect(() => computeTrendlinePrimitives(chartData, 4, LAYOUT, RANGE)).not.toThrow();
	});

	it('returns empty for a series with fewer than 2 values', () => {
		const trendline: PptxChartTrendline = { trendlineType: 'linear' };
		const chartData = makeChartData({
			series: [makeSeries({ values: [42], trendlines: [trendline] })],
		});
		const result = computeTrendlinePrimitives(chartData, 1, LAYOUT, RANGE);
		expect(result).toHaveLength(0);
	});

	it('produces one path per trendline across multiple series', () => {
		const tl: PptxChartTrendline = { trendlineType: 'linear' };
		const chartData = makeChartData({
			series: [
				makeSeries({ name: 'S1', trendlines: [tl] }),
				makeSeries({ name: 'S2', values: [5, 10, 15, 20], trendlines: [tl] }),
			],
		});
		const paths = computeTrendlinePrimitives(chartData, 4, LAYOUT, RANGE).filter(
			(p) => p.kind === 'path',
		);
		expect(paths).toHaveLength(2);
	});

	it('does not crash on empty series array', () => {
		const chartData = makeChartData({ series: [] });
		expect(() => computeTrendlinePrimitives(chartData, 0, LAYOUT, RANGE)).not.toThrow();
		expect(computeTrendlinePrimitives(chartData, 0, LAYOUT, RANGE)).toHaveLength(0);
	});

	it('uses trendline.color when provided', () => {
		const tl: PptxChartTrendline = { trendlineType: 'linear', color: '#FF0000' };
		const chartData = makeChartData({ series: [makeSeries({ trendlines: [tl] })] });
		const result = computeTrendlinePrimitives(chartData, 4, LAYOUT, RANGE);
		const path = result.find((p) => p.kind === 'path');
		if (path?.kind === 'path') {
			expect(path.stroke).toBe('#FF0000');
		}
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// computeErrorBarPrimitives
// ─────────────────────────────────────────────────────────────────────────────

describe('computeErrorBarPrimitives', () => {
	it('returns empty array when no series has error bars', () => {
		const chartData = makeChartData({ series: [makeSeries()] });
		expect(computeErrorBarPrimitives(chartData, 4, LAYOUT, RANGE)).toHaveLength(0);
	});

	it('produces stem + cap lines for fixedVal "both" error bars', () => {
		const eb: PptxChartErrBars = { direction: 'y', barType: 'both', valType: 'fixedVal', val: 5 };
		const chartData = makeChartData({ series: [makeSeries({ errBars: [eb] })] });
		const result = computeErrorBarPrimitives(chartData, 4, LAYOUT, RANGE);
		// 4 values × 2 directions × 2 lines (stem + cap) = 16
		expect(result).toHaveLength(16);
		expect(result.every((p) => p.kind === 'line')).toBeTruthy();
	});

	it('produces only plus stems for barType=plus', () => {
		const eb: PptxChartErrBars = { direction: 'y', barType: 'plus', valType: 'fixedVal', val: 3 };
		const chartData = makeChartData({ series: [makeSeries({ errBars: [eb] })] });
		const result = computeErrorBarPrimitives(chartData, 4, LAYOUT, RANGE);
		// 4 values × 1 direction × 2 lines = 8
		expect(result).toHaveLength(8);
	});

	it('produces only minus stems for barType=minus', () => {
		const eb: PptxChartErrBars = {
			direction: 'y',
			barType: 'minus',
			valType: 'fixedVal',
			val: 3,
		};
		const chartData = makeChartData({ series: [makeSeries({ errBars: [eb] })] });
		const result = computeErrorBarPrimitives(chartData, 4, LAYOUT, RANGE);
		expect(result).toHaveLength(8);
	});

	it('renders category X-direction fixed error bars', () => {
		const eb: PptxChartErrBars = { direction: 'x', barType: 'both', valType: 'fixedVal', val: 3 };
		const chartData = makeChartData({ series: [makeSeries({ errBars: [eb] })] });
		const result = computeErrorBarPrimitives(chartData, 4, LAYOUT, RANGE);
		expect(result).toHaveLength(16);
		const firstStem = result[0];
		expect(firstStem).toMatchObject({
			kind: 'line',
			y1: firstStem.kind === 'line' ? firstStem.y2 : 0,
		});
		if (firstStem.kind === 'line') {
			expect(firstStem.x2).toBeGreaterThan(firstStem.x1);
		}
	});

	it('maps scatter X bars from numeric xVal categories', () => {
		const eb: PptxChartErrBars = { direction: 'x', barType: 'plus', valType: 'fixedVal', val: 5 };
		const chartData = makeChartData({
			chartType: 'scatter',
			categories: ['10', '20', '40'],
			series: [makeSeries({ values: [10, 20, 30], errBars: [eb] })],
		});
		const [stem] = computeErrorBarPrimitives(chartData, 3, LAYOUT, RANGE);
		expect(stem).toMatchObject({ kind: 'line' });
		if (stem.kind === 'line') {
			expect(stem.x1).toBeCloseTo(LAYOUT.plotLeft, 5);
			expect(stem.x2).toBeCloseTo(LAYOUT.plotLeft + (5 / 30) * LAYOUT.plotWidth, 5);
		}
	});

	it('computes percentage and standard-deviation lengths from X values', () => {
		for (const errBars of [
			{ direction: 'x', barType: 'plus', valType: 'percentage', val: 25 },
			{ direction: 'x', barType: 'minus', valType: 'stdDev', val: 1 },
		] satisfies PptxChartErrBars[]) {
			const chartData = makeChartData({
				chartType: 'scatter',
				categories: ['10', '20', '40'],
				series: [makeSeries({ values: [10, 20, 30], errBars: [errBars] })],
			});
			const [stem] = computeErrorBarPrimitives(chartData, 3, LAYOUT, RANGE);
			expect(stem).toMatchObject({ kind: 'line' });
			if (stem.kind === 'line') {
				expect(stem.x2).not.toBeCloseTo(stem.x1, 5);
			}
		}
	});

	it('uses source point indexes for custom values after category reordering', () => {
		const eb: PptxChartErrBars = {
			direction: 'x',
			barType: 'plus',
			valType: 'cust',
			customPlus: [1, 2, 3],
		};
		const chartData = makeChartData({
			categories: ['A', 'B', 'C'],
			series: [makeSeries({ values: [10, 20, 30], errBars: [eb] })],
		});
		const result = computeErrorBarPrimitives(chartData, 2, LAYOUT, RANGE, 'line', {
			sourceIndices: [2, 0],
			xPositions: [100, 200],
		});
		expect(result[0]).toMatchObject({ kind: 'line', x1: 100, x2: 400 });
		expect(result[2]).toMatchObject({ kind: 'line', x1: 200, x2: 300 });
	});

	it('omits caps and respects the authored line color', () => {
		const eb: PptxChartErrBars = {
			direction: 'x',
			barType: 'both',
			valType: 'stdErr',
			noEndCap: true,
			color: '#123456',
		};
		const chartData = makeChartData({ series: [makeSeries({ errBars: [eb] })] });
		const result = computeErrorBarPrimitives(chartData, 4, LAYOUT, RANGE);
		expect(result).toHaveLength(8);
		expect(
			result.every((primitive) => primitive.kind === 'line' && primitive.stroke === '#123456'),
		).toBeTruthy();
	});

	it('handles percentage valType without crashing', () => {
		const eb: PptxChartErrBars = {
			direction: 'y',
			barType: 'both',
			valType: 'percentage',
			val: 10,
		};
		const chartData = makeChartData({ series: [makeSeries({ errBars: [eb] })] });
		expect(() => computeErrorBarPrimitives(chartData, 4, LAYOUT, RANGE)).not.toThrow();
	});

	it('handles stdDev valType without crashing', () => {
		const eb: PptxChartErrBars = { direction: 'y', barType: 'both', valType: 'stdDev', val: 1 };
		const chartData = makeChartData({ series: [makeSeries({ errBars: [eb] })] });
		expect(() => computeErrorBarPrimitives(chartData, 4, LAYOUT, RANGE)).not.toThrow();
	});

	it('handles stdErr valType without crashing', () => {
		const eb: PptxChartErrBars = { direction: 'y', barType: 'both', valType: 'stdErr' };
		const chartData = makeChartData({ series: [makeSeries({ errBars: [eb] })] });
		expect(() => computeErrorBarPrimitives(chartData, 4, LAYOUT, RANGE)).not.toThrow();
	});

	it('handles custom valType without crashing', () => {
		const eb: PptxChartErrBars = {
			direction: 'y',
			barType: 'both',
			valType: 'cust',
			customPlus: [1, 2, 3, 4],
			customMinus: [1, 1, 1, 1],
		};
		const chartData = makeChartData({ series: [makeSeries({ errBars: [eb] })] });
		expect(() => computeErrorBarPrimitives(chartData, 4, LAYOUT, RANGE)).not.toThrow();
	});

	it('does not crash on empty series', () => {
		const chartData = makeChartData({ series: [] });
		expect(computeErrorBarPrimitives(chartData, 0, LAYOUT, RANGE)).toHaveLength(0);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// computeAxisTitlePrimitives
// ─────────────────────────────────────────────────────────────────────────────

describe('computeAxisTitlePrimitives', () => {
	it('returns empty array when no axes are present', () => {
		const chartData = makeChartData({ series: [] });
		expect(computeAxisTitlePrimitives(chartData, LAYOUT)).toHaveLength(0);
	});

	it('returns empty array when axes array is empty', () => {
		const chartData = makeChartData({ axes: [], series: [] });
		expect(computeAxisTitlePrimitives(chartData, LAYOUT)).toHaveLength(0);
	});

	it('returns x-axis title text when catAx has titleText', () => {
		const axis: PptxChartAxisFormatting = {
			axisType: 'catAx',
			axPos: 'b',
			titleText: 'Month',
		};
		const chartData = makeChartData({ axes: [axis], series: [] });
		const result = computeAxisTitlePrimitives(chartData, LAYOUT);
		expect(result).toHaveLength(1);
		expect(result[0].kind).toBe('text');
		expect(result[0].text).toBe('Month');
		// X title should appear below plot bottom
		expect(result[0].y).toBeGreaterThan(LAYOUT.plotBottom);
	});

	it('returns y-axis title text when valAx has titleText', () => {
		const axis: PptxChartAxisFormatting = {
			axisType: 'valAx',
			axPos: 'l',
			titleText: 'Revenue',
		};
		const chartData = makeChartData({ axes: [axis], series: [] });
		const result = computeAxisTitlePrimitives(chartData, LAYOUT);
		expect(result).toHaveLength(1);
		expect(result[0].kind).toBe('text');
		expect(result[0].text).toBe('Revenue');
	});

	it('returns both titles when both axes have titleText', () => {
		const axes: PptxChartAxisFormatting[] = [
			{ axisType: 'catAx', axPos: 'b', titleText: 'Quarter' },
			{ axisType: 'valAx', axPos: 'l', titleText: 'Units' },
		];
		const chartData = makeChartData({ axes, series: [] });
		const result = computeAxisTitlePrimitives(chartData, LAYOUT);
		expect(result).toHaveLength(2);
		const texts = result.map((p) => p.text);
		expect(texts).toContain('Quarter');
		expect(texts).toContain('Units');
	});

	it('returns empty when axes exist but have no titleText', () => {
		const axes: PptxChartAxisFormatting[] = [
			{ axisType: 'catAx', axPos: 'b' },
			{ axisType: 'valAx', axPos: 'l' },
		];
		const chartData = makeChartData({ axes, series: [] });
		expect(computeAxisTitlePrimitives(chartData, LAYOUT)).toHaveLength(0);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// computeDataTablePrimitives
// ─────────────────────────────────────────────────────────────────────────────

describe('computeDataTablePrimitives', () => {
	it('returns empty array when dataTable is absent', () => {
		const chartData = makeChartData({ series: [makeSeries()] });
		expect(computeDataTablePrimitives(chartData, LAYOUT)).toHaveLength(0);
	});

	it('returns empty array when dataTable present but no categories and no series', () => {
		const chartData = makeChartData({
			categories: [],
			series: [],
			dataTable: {},
		});
		expect(computeDataTablePrimitives(chartData, LAYOUT)).toHaveLength(0);
	});

	it('returns primitives when dataTable is present with data', () => {
		const chartData = makeChartData({
			series: [makeSeries()],
			dataTable: { showHorzBorder: true, showVertBorder: true, showOutline: true, showKeys: true },
		});
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		expect(result.length).toBeGreaterThan(0);
	});

	it('produces category header text labels', () => {
		const chartData = makeChartData({
			series: [makeSeries()],
			dataTable: {},
		});
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		const texts = result
			.filter((p) => p.kind === 'text')
			.map((p) => (p.kind === 'text' ? p.text : ''));
		expect(texts).toContain('A');
		expect(texts).toContain('B');
		expect(texts).toContain('C');
		expect(texts).toContain('D');
	});

	it('produces series name text when showKeys is true', () => {
		const chartData = makeChartData({
			series: [makeSeries({ name: 'Revenue' })],
			dataTable: { showKeys: true },
		});
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		const texts = result
			.filter((p) => p.kind === 'text')
			.map((p) => (p.kind === 'text' ? p.text : ''));
		expect(texts).toContain('Revenue');
	});

	it('does not include series name when showKeys is false', () => {
		const chartData = makeChartData({
			series: [makeSeries({ name: 'Revenue' })],
			dataTable: { showKeys: false },
		});
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		const texts = result
			.filter((p) => p.kind === 'text')
			.map((p) => (p.kind === 'text' ? p.text : ''));
		expect(texts).not.toContain('Revenue');
	});

	it('places table below plotBottom', () => {
		const chartData = makeChartData({
			series: [makeSeries()],
			dataTable: {},
		});
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		const allY = result
			.flatMap((p) => {
				if (p.kind === 'line') {
					return [p.y1, p.y2];
				}
				if (p.kind === 'text') {
					return [p.y];
				}
				if (p.kind === 'rect') {
					return [p.y];
				}
				return [];
			})
			.filter((y) => y > 0);
		expect(allY.every((y) => y >= LAYOUT.plotBottom)).toBeTruthy();
	});

	it('produces outline border lines when showOutline is true', () => {
		const chartData = makeChartData({
			series: [makeSeries()],
			dataTable: { showOutline: true },
		});
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		const lines = result.filter((p) => p.kind === 'line');
		// At minimum 4 border lines for the outline
		expect(lines.length).toBeGreaterThanOrEqual(4);
	});

	it('produces no outline when showOutline is false', () => {
		const chartData = makeChartData({
			series: [makeSeries()],
			dataTable: { showOutline: false, showHorzBorder: false, showVertBorder: false },
		});
		// No border lines at all; only category text + value text + swatch rects
		const result = computeDataTablePrimitives(chartData, LAYOUT);
		const lines = result.filter((p) => p.kind === 'line');
		expect(lines).toHaveLength(0);
	});

	it('exports DATA_TABLE_ROW_H, DATA_TABLE_HEADER_H, DATA_TABLE_KEY_W as positive numbers', () => {
		expect(DATA_TABLE_ROW_H).toBeGreaterThan(0);
		expect(DATA_TABLE_HEADER_H).toBeGreaterThan(0);
		expect(DATA_TABLE_KEY_W).toBeGreaterThan(0);
	});

	it('does not crash with multiple series', () => {
		const chartData = makeChartData({
			series: [makeSeries({ name: 'S1' }), makeSeries({ name: 'S2', values: [5, 15, 25, 35] })],
			dataTable: { showKeys: true },
		});
		expect(() => computeDataTablePrimitives(chartData, LAYOUT)).not.toThrow();
	});
});
