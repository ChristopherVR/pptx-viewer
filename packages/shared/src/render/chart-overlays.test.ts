/**
 * chart-overlays.test.ts: unit tests for chart-overlays.ts.
 *
 * Tests are grouped by exported function:
 *   - computeLinearRegression  (regression helpers)
 *   - fitPolynomial
 *   - computeRSquared
 *   - computeTrendlinePrimitives
 *   - computeErrorBarPrimitives
 *   - computeAxisTitlePrimitives
 *
 * `computeDataTablePrimitives` moved to `chart-data-table-render.test.ts`
 * alongside its own module.
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
	computeAxisTitlePrimitives,
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

	it('defaults the R² label to 4-decimal fixed formatting with no numFmt', () => {
		const trendline: PptxChartTrendline = {
			trendlineType: 'linear',
			displayRSq: true,
			// Perfectly linear series -> rSquared === 1, so the format is easy to
			// assert exactly: "1.0000" from `.toFixed(4)`.
		};
		const chartData = makeChartData({
			series: [makeSeries({ values: [1, 2, 3, 4], trendlines: [trendline] })],
		});
		const result = computeTrendlinePrimitives(chartData, 4, LAYOUT, RANGE);
		const textPrimitive = result.find((p) => p.kind === 'text');
		expect(textPrimitive?.kind === 'text' && textPrimitive.text).toBe('R² = 1.0000');
	});

	it('honours c:trendlineLbl/c:numFmt over the default fixed formatting when sourceLinked is false', () => {
		const trendline: PptxChartTrendline = {
			trendlineType: 'linear',
			displayRSq: true,
			label: { sourceLinked: false, numberFormatCode: '0%' },
		};
		const chartData = makeChartData({
			series: [makeSeries({ values: [1, 2, 3, 4], trendlines: [trendline] })],
		});
		const result = computeTrendlinePrimitives(chartData, 4, LAYOUT, RANGE);
		const textPrimitive = result.find((p) => p.kind === 'text');
		expect(textPrimitive?.kind === 'text' && textPrimitive.text).toBe('R² = 100%');
	});

	it('ignores numFmt when sourceLinked is not explicitly false', () => {
		const trendline: PptxChartTrendline = {
			trendlineType: 'linear',
			displayRSq: true,
			label: { numberFormatCode: '0%' },
		};
		const chartData = makeChartData({
			series: [makeSeries({ values: [1, 2, 3, 4], trendlines: [trendline] })],
		});
		const result = computeTrendlinePrimitives(chartData, 4, LAYOUT, RANGE);
		const textPrimitive = result.find((p) => p.kind === 'text');
		expect(textPrimitive?.kind === 'text' && textPrimitive.text).toBe('R² = 1.0000');
	});

	it('anchors the label at c:trendlineLbl/c:layout/c:manualLayout when the author dragged it', () => {
		const trendline: PptxChartTrendline = {
			trendlineType: 'linear',
			displayRSq: true,
			label: { layout: { x: 0.1, y: 0.2, xMode: 'edge', yMode: 'edge' } },
		};
		const chartData = makeChartData({
			series: [makeSeries({ values: [1, 2, 3, 4], trendlines: [trendline] })],
		});
		const result = computeTrendlinePrimitives(chartData, 4, LAYOUT, RANGE);
		const textPrimitive = result.find((p) => p.kind === 'text');
		expect(textPrimitive?.kind === 'text' && textPrimitive.x).toBeCloseTo(0.1 * LAYOUT.svgWidth, 5);
		expect(textPrimitive?.kind === 'text' && textPrimitive.y).toBeCloseTo(
			0.2 * LAYOUT.svgHeight,
			5,
		);
	});

	it('keeps the default "hug the last point" anchor with no manual layout', () => {
		const trendline: PptxChartTrendline = { trendlineType: 'linear', displayRSq: true };
		const chartData = makeChartData({
			series: [makeSeries({ values: [1, 2, 3, 4], trendlines: [trendline] })],
		});
		const withLayout = computeTrendlinePrimitives(chartData, 4, LAYOUT, RANGE);
		const trendlineWithManualLayout: PptxChartTrendline = {
			...trendline,
			label: { layout: { x: 0.1, y: 0.2, xMode: 'edge', yMode: 'edge' } },
		};
		const chartDataManual = makeChartData({
			series: [makeSeries({ values: [1, 2, 3, 4], trendlines: [trendlineWithManualLayout] })],
		});
		const withManual = computeTrendlinePrimitives(chartDataManual, 4, LAYOUT, RANGE);
		const auto = withLayout.find((p) => p.kind === 'text');
		const manual = withManual.find((p) => p.kind === 'text');
		expect(auto?.kind === 'text' && manual?.kind === 'text' && auto.x !== manual.x).toBeTruthy();
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
