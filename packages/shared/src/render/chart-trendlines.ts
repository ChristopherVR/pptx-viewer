/**
 * chart-trendlines.ts: framework-agnostic trendline regression maths.
 *
 * A port of the React `viewer/utils/chart-trendlines.tsx` regression engine,
 * stripped of its JSX. `computeTrendlinePoints` fits one series' trendline
 * and returns its polyline points plus an optional equation / R² label;
 * `chart-overlays-trendline.ts` calls it per series and assembles the
 * renderable SVG path/colour/label a binding actually draws (this module
 * used to also export that assembly step, `computeChartTrendlines`, but it
 * had no callers anywhere in the five bindings or shared and was removed).
 *
 * Supported regression types (per `PptxChartTrendlineType`):
 * linear, exponential, logarithmic, power, polynomial, movingAvg.
 */
import type { PptxChartTrendline } from 'pptx-viewer-core';

import type { PlotLayout, ValueRange } from './chart-helpers';
import {
	computeLinearRegression,
	computeRSquared,
	fitPolynomial,
} from './chart-overlays-regression';

/** A single point on a computed trendline, in SVG pixel space. */
export interface TrendlinePoint {
	x: number;
	y: number;
}

/**
 * Map a (possibly fractional / extrapolated) category index to an X pixel.
 * `mode === 'bar'` centres on category slots; `'line'` anchors at points.
 * Mirrors the React `xToPixel`.
 */
function xToPixel(
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

interface ComputedTrend {
	points: TrendlinePoint[];
	equation: string;
	rSquared: number;
}

/**
 * Compute the polyline points (and equation / R²) for one trendline over a
 * series' values. Returns an empty point list when the type is unsupported or
 * the data is too sparse to fit. Mirrors the React `computeTrendlinePoints`.
 */
export function computeTrendlinePoints(
	trendline: PptxChartTrendline,
	values: number[],
	catCount: number,
	layout: PlotLayout,
	range: ValueRange,
	mode: 'line' | 'bar',
): ComputedTrend {
	const n = values.length;
	if (n < 2) {
		return { points: [], equation: '', rSquared: 0 };
	}

	const xVals = values.map((_v, i) => i);
	const yVals = values;

	const forward = trendline.forward ?? 0;
	const backward = trendline.backward ?? 0;
	const startX = -backward;
	const endX = n - 1 + forward;
	const steps = Math.max(Math.ceil((endX - startX) * 4), 20);

	let evalFn: (x: number) => number;
	let equation = '';
	let rSquared = 0;

	switch (trendline.trendlineType) {
		case 'linear': {
			const reg = computeLinearRegression(xVals, yVals);
			const intercept = trendline.intercept;
			const slope =
				intercept !== undefined
					? yVals.reduce((s, y, i) => s + (y - intercept) * xVals[i], 0) /
						xVals.reduce((s, x) => s + x * x, 0)
					: reg.slope;
			const b = intercept ?? reg.intercept;
			evalFn = (x) => slope * x + b;
			equation = `y = ${slope.toFixed(2)}x + ${b.toFixed(2)}`;
			rSquared = reg.rSquared;
			break;
		}
		case 'exponential': {
			const logY = yVals.filter((y) => y > 0).map((y) => Math.log(y));
			const filteredX = xVals.filter((_x, i) => yVals[i] > 0);
			if (logY.length < 2) {
				return { points: [], equation: '', rSquared: 0 };
			}
			const reg = computeLinearRegression(filteredX, logY);
			const a = Math.exp(reg.intercept);
			const b = reg.slope;
			evalFn = (x) => a * Math.exp(b * x);
			equation = `y = ${a.toFixed(2)}e^(${b.toFixed(2)}x)`;
			rSquared = reg.rSquared;
			break;
		}
		case 'logarithmic': {
			const lnX = xVals.filter((x) => x > 0).map((x) => Math.log(x));
			const filteredY = yVals.filter((_y, i) => xVals[i] > 0);
			if (lnX.length < 2) {
				return { points: [], equation: '', rSquared: 0 };
			}
			const reg = computeLinearRegression(lnX, filteredY);
			evalFn = (x) => (x > 0 ? reg.slope * Math.log(x) + reg.intercept : 0);
			equation = `y = ${reg.slope.toFixed(2)}ln(x) + ${reg.intercept.toFixed(2)}`;
			rSquared = reg.rSquared;
			break;
		}
		case 'power': {
			const logX = xVals.filter((x, i) => x > 0 && yVals[i] > 0).map((x) => Math.log(x));
			const logY = yVals.filter((y, i) => y > 0 && xVals[i] > 0).map((y) => Math.log(y));
			if (logX.length < 2) {
				return { points: [], equation: '', rSquared: 0 };
			}
			const reg = computeLinearRegression(logX, logY);
			const a = Math.exp(reg.intercept);
			evalFn = (x) => (x > 0 ? a * x ** reg.slope : 0);
			equation = `y = ${a.toFixed(2)}x^${reg.slope.toFixed(2)}`;
			rSquared = reg.rSquared;
			break;
		}
		case 'polynomial': {
			const order = Math.min(trendline.order ?? 2, 6);
			const coeffs = fitPolynomial(xVals, yVals, order);
			evalFn = (x) => coeffs.reduce((s, c, i) => s + c * x ** i, 0);
			equation = coeffs.map((c, i) => `${c.toFixed(2)}x^${i}`).join(' + ');
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
				const px = xToPixel(i, catCount, layout, mode);
				const py = valueToYLocal(avgVal, range, layout.plotTop, layout.plotBottom);
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
		const px = xToPixel(xVal, catCount, layout, mode);
		const py = valueToYLocal(yVal, range, layout.plotTop, layout.plotBottom);
		points.push({ x: px, y: py });
	}

	return { points, equation, rSquared };
}

/**
 * Map a value to a Y pixel. Kept local (rather than importing `valueToY`) so
 * the trendline maths is independent of any future change to the linear
 * mapping used by the axis renderer — they happen to coincide today.
 */
function valueToYLocal(val: number, range: ValueRange, topY: number, bottomY: number): number {
	const usable = bottomY - topY;
	const ratio = (val - range.min) / range.span;
	return range.reverseOrder ? topY + ratio * usable : bottomY - ratio * usable;
}
