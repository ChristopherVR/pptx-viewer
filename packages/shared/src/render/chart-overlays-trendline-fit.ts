/**
 * chart-overlays-trendline-fit.ts: per-series trendline point computation
 * (linear / exponential / logarithmic / power / polynomial / moving-average),
 * built on the regression math in chart-overlays-regression.ts. Split out of
 * chart-overlays.ts to keep that module under the repo's file-size guideline.
 *
 * Excel fits a trendline against x = 1, 2, ..., n on a category chart (bar /
 * line / area): the category POSITION, never a 0-based array index. A scatter
 * chart has no categories at all; Excel fits against the series' own real
 * `c:xVal` data instead. Collapsing both cases to a bare 0-based index (the
 * previous behaviour here) shifted every category-chart fit by one unit and
 * made a scatter trendline ignore its own X axis entirely, fitting against
 * point ORDER instead of the X values a reader actually sees on the chart.
 *
 * Ported / adapted from:
 *   packages/react/src/viewer/utils/chart-trendlines.tsx (regression engine)
 *   packages/shared/src/render/chart-trendlines.ts (shared port)
 *
 * @module chart-overlays-trendline-fit
 */

import type { PptxChartSeries, PptxChartTrendline } from 'pptx-viewer-core';

import {
	computeLinearRegression,
	computeRSquared,
	fitPolynomial,
} from './chart-overlays-regression';
import {
	formatExponentialEquation,
	formatLinearEquation,
	formatLogarithmicEquation,
	formatPolynomialEquation,
	formatPowerEquation,
} from './chart-trendline-equation-format';
import type { PlotLayout, ValueRange } from './chart-view-model';
import { valueToY } from './chart-view-model';

/**
 * Map a (possibly fractional / extrapolated) category index to an X pixel.
 * `mode === 'bar'` centres on category slots; `'line'` anchors at data points.
 * Mirrors `xToPixel` from chart-overlay-utils.ts (React) and the shared port.
 */
export function xToPixel(
	xVal: number,
	catCount: number,
	layout: PlotLayout,
	mode: 'line' | 'bar',
): number {
	if (mode === 'bar') {
		const slotWidth = layout.plotWidth / Math.max(catCount, 1);
		return layout.plotLeft + slotWidth * xVal + slotWidth / 2;
	}
	const maxIdx = Math.max(catCount - 1, 1);
	return layout.plotLeft + (xVal / maxIdx) * layout.plotWidth;
}

interface TrendlinePoint {
	x: number;
	y: number;
}

export interface ComputedTrend {
	points: TrendlinePoint[];
	equation: string;
	rSquared: number;
}

/** A scatter chart's shared X-axis domain, matching `computeScatterDots`' own normalisation. */
export interface TrendlineXDomain {
	min: number;
	span: number;
}

/**
 * Compute the polyline points (and equation / R-squared) for one trendline
 * over a series. Returns empty points when the type is unsupported or data
 * is too sparse.
 *
 * @param xDomain  A scatter chart's X-axis domain (from `computeScatterXDomain`),
 *   present only when `series.xValues` should be used both for the fit AND for
 *   placing the drawn curve. Absent (category charts) fits against x = 1..n and
 *   places the curve via the existing 0-based `xToPixel` category convention.
 */
export function computeTrendlinePoints(
	trendline: PptxChartTrendline,
	series: PptxChartSeries,
	catCount: number,
	layout: PlotLayout,
	range: ValueRange,
	mode: 'line' | 'bar',
	xDomain?: TrendlineXDomain,
): ComputedTrend {
	const yVals = series.values;
	const n = yVals.length;
	if (n < 2) {
		return { points: [], equation: '', rSquared: 0 };
	}

	const useRealX = xDomain !== undefined && (series.xValues?.length ?? 0) >= n;
	// Fit-space X: the series' own real data for a scatter chart, else Excel's
	// 1-based category position (never a bare 0-based index).
	const xVals = useRealX ? series.xValues!.slice(0, n) : yVals.map((_v, i) => i + 1);

	// A fit-space X maps to a pixel either through the scatter domain's own
	// normalisation (matching `computeScatterDots`, so the curve lines up with
	// the actual plotted points) or, for a category chart, through the
	// existing 0-based `xToPixel` convention (fitX is 1-based, so shift back).
	const toPixelX = (fitX: number): number =>
		useRealX
			? layout.plotLeft +
				(xDomain!.span > 0 ? (fitX - xDomain!.min) / xDomain!.span : 0) * layout.plotWidth
			: xToPixel(fitX - 1, catCount, layout, mode);

	const forward = trendline.forward ?? 0;
	const backward = trendline.backward ?? 0;
	const minX = Math.min(...xVals);
	const maxX = Math.max(...xVals);
	const startX = minX - backward;
	const endX = maxX + forward;
	const steps = Math.max(Math.ceil((endX - startX) * 4), 20);

	let evalFn: (x: number) => number;
	let equation = '';
	let rSquared = 0;

	switch (trendline.trendlineType) {
		case 'linear': {
			const reg = computeLinearRegression(xVals, yVals);
			const fixedIntercept = trendline.intercept;
			const slope =
				fixedIntercept !== undefined
					? yVals.reduce((s, y, i) => s + (y - fixedIntercept) * xVals[i], 0) /
						xVals.reduce((s, x) => s + x * x, 0)
					: reg.slope;
			const b = fixedIntercept ?? reg.intercept;
			evalFn = (x) => slope * x + b;
			equation = formatLinearEquation(slope, b);
			rSquared = reg.rSquared;
			break;
		}
		case 'exponential': {
			const posY = yVals.filter((y) => y > 0).map((y) => Math.log(y));
			const posX = xVals.filter((_x, i) => yVals[i] > 0);
			if (posY.length < 2) {
				return { points: [], equation: '', rSquared: 0 };
			}
			const reg = computeLinearRegression(posX, posY);
			const a = Math.exp(reg.intercept);
			const b = reg.slope;
			evalFn = (x) => a * Math.exp(b * x);
			equation = formatExponentialEquation(a, b);
			rSquared = reg.rSquared;
			break;
		}
		case 'logarithmic': {
			const posLnX = xVals.filter((x) => x > 0).map((x) => Math.log(x));
			const filteredY = yVals.filter((_y, i) => xVals[i] > 0);
			if (posLnX.length < 2) {
				return { points: [], equation: '', rSquared: 0 };
			}
			const reg = computeLinearRegression(posLnX, filteredY);
			evalFn = (x) => (x > 0 ? reg.slope * Math.log(x) + reg.intercept : 0);
			equation = formatLogarithmicEquation(reg.slope, reg.intercept);
			rSquared = reg.rSquared;
			break;
		}
		case 'power': {
			const logXArr = xVals.filter((x, i) => x > 0 && yVals[i] > 0).map((x) => Math.log(x));
			const logYArr = yVals.filter((y, i) => y > 0 && xVals[i] > 0).map((y) => Math.log(y));
			if (logXArr.length < 2) {
				return { points: [], equation: '', rSquared: 0 };
			}
			const reg = computeLinearRegression(logXArr, logYArr);
			const a = Math.exp(reg.intercept);
			evalFn = (x) => (x > 0 ? a * x ** reg.slope : 0);
			equation = formatPowerEquation(a, reg.slope);
			rSquared = reg.rSquared;
			break;
		}
		case 'polynomial': {
			const order = Math.min(trendline.order ?? 2, 6);
			const coeffs = fitPolynomial(xVals, yVals, order);
			evalFn = (x) => coeffs.reduce((s, c, i) => s + c * x ** i, 0);
			equation = formatPolynomialEquation(coeffs);
			rSquared = computeRSquared(xVals, yVals, evalFn);
			break;
		}
		case 'movingAvg': {
			const period = trendline.period ?? 2;
			const maPoints: TrendlinePoint[] = [];
			for (let i = period - 1; i < n; i++) {
				let sum = 0;
				for (let j = i - period + 1; j <= i; j++) {
					sum += yVals[j];
				}
				const avgVal = sum / period;
				const px = toPixelX(xVals[i]);
				const py = valueToY(avgVal, range, layout.plotTop, layout.plotBottom);
				maPoints.push({ x: px, y: py });
			}
			return {
				points: maPoints,
				equation: `${period}-period moving average`,
				rSquared: 0,
			};
		}
		default:
			return { points: [], equation: '', rSquared: 0 };
	}

	const points: TrendlinePoint[] = [];
	for (let step = 0; step <= steps; step++) {
		const xVal = startX + ((endX - startX) * step) / steps;
		const yVal = evalFn(xVal);
		if (!Number.isFinite(yVal)) {
			continue;
		}
		const px = toPixelX(xVal);
		const py = valueToY(yVal, range, layout.plotTop, layout.plotBottom);
		points.push({ x: px, y: py });
	}

	return { points, equation, rSquared };
}
