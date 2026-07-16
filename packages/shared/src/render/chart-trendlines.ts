/**
 * chart-trendlines.ts — framework-agnostic trendline computation.
 *
 * A port of the React `viewer/utils/chart-trendlines.tsx` regression engine,
 * stripped of its JSX. Computes the polyline points (and optional equation /
 * R² label) for each series trendline so a binding can render them as plain
 * SVG `<path>` / `<text>` elements.
 *
 * Supported regression types (per `PptxChartTrendlineType`):
 * linear, exponential, logarithmic, power, polynomial, movingAvg.
 */
import type { PptxChartData, PptxChartTrendline } from 'pptx-viewer-core';

import { seriesColor } from './chart-helpers';
import type { PlotLayout, ValueRange } from './chart-helpers';

/** A single point on a computed trendline, in SVG pixel space. */
export interface TrendlinePoint {
	x: number;
	y: number;
}

/** A fully-resolved, renderable trendline for one series. */
export interface RenderableTrendline {
	/** SVG path `d` string (`M … L …`). */
	pathData: string;
	/** Stroke colour (trendline override → series colour). */
	color: string;
	/** Optional equation / R² label text (only when requested + computable). */
	label?: string;
	/** Label anchor — the last trendline point, nudged up. */
	labelX?: number;
	labelY?: number;
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

interface LinearFit {
	slope: number;
	intercept: number;
	rSquared: number;
}

/** Ordinary least-squares linear regression of `yVals` on `xVals`. */
function computeLinearRegression(xVals: number[], yVals: number[]): LinearFit {
	const n = xVals.length;
	if (n < 2) {
		return { slope: 0, intercept: 0, rSquared: 0 };
	}

	let sumX = 0;
	let sumY = 0;
	let sumXY = 0;
	let sumXX = 0;
	for (let i = 0; i < n; i++) {
		sumX += xVals[i];
		sumY += yVals[i];
		sumXY += xVals[i] * yVals[i];
		sumXX += xVals[i] * xVals[i];
	}

	const denom = n * sumXX - sumX * sumX;
	if (Math.abs(denom) < 1e-12) {
		return { slope: 0, intercept: sumY / n, rSquared: 0 };
	}

	const slope = (n * sumXY - sumX * sumY) / denom;
	const intercept = (sumY - slope * sumX) / n;

	const ssRes = yVals.reduce((s, y, i) => s + (y - (slope * xVals[i] + intercept)) ** 2, 0);
	const meanY = sumY / n;
	const ssTot = yVals.reduce((s, y) => s + (y - meanY) ** 2, 0);
	const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

	return { slope, intercept, rSquared };
}

/** Fit polynomial coefficients (ascending order) via Gaussian elimination. */
function fitPolynomial(xVals: number[], yVals: number[], order: number): number[] {
	const n = xVals.length;
	const m = order + 1;
	const matrix: number[][] = Array.from({ length: m }, () => Array(m + 1).fill(0) as number[]);

	for (let i = 0; i < m; i++) {
		for (let j = 0; j < m; j++) {
			let sum = 0;
			for (let k = 0; k < n; k++) {
				sum += xVals[k] ** (i + j);
			}
			matrix[i][j] = sum;
		}
		let sum = 0;
		for (let k = 0; k < n; k++) {
			sum += yVals[k] * xVals[k] ** i;
		}
		matrix[i][m] = sum;
	}

	for (let i = 0; i < m; i++) {
		let maxRow = i;
		for (let k = i + 1; k < m; k++) {
			if (Math.abs(matrix[k][i]) > Math.abs(matrix[maxRow][i])) {
				maxRow = k;
			}
		}
		[matrix[i], matrix[maxRow]] = [matrix[maxRow], matrix[i]];
		const pivot = matrix[i][i];
		if (Math.abs(pivot) < 1e-12) {
			continue;
		}
		for (let j = i; j <= m; j++) {
			matrix[i][j] /= pivot;
		}
		for (let k = 0; k < m; k++) {
			if (k === i) {
				continue;
			}
			const factor = matrix[k][i];
			for (let j = i; j <= m; j++) {
				matrix[k][j] -= factor * matrix[i][j];
			}
		}
	}

	return matrix.map((row) => row[m]);
}

/** R² of an arbitrary fit function against the data. */
function computeRSquared(xVals: number[], yVals: number[], evalFn: (x: number) => number): number {
	const n = xVals.length;
	const meanY = yVals.reduce((s, y) => s + y, 0) / n;
	let ssRes = 0;
	let ssTot = 0;
	for (let i = 0; i < n; i++) {
		ssRes += (yVals[i] - evalFn(xVals[i])) ** 2;
		ssTot += (yVals[i] - meanY) ** 2;
	}
	return ssTot > 0 ? 1 - ssRes / ssTot : 0;
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

/**
 * Build the renderable trendlines for every series in a chart. Returns an
 * empty array when no series declares any trendline (so a binding can skip
 * the overlay entirely).
 *
 * @param mode 'bar' for bar/column/stacked plots, 'line' for line/area plots.
 */
export function computeChartTrendlines(
	chartData: PptxChartData,
	layout: PlotLayout,
	range: ValueRange,
	mode: 'line' | 'bar',
	styleId?: number,
	colorPalette?: string[],
): RenderableTrendline[] {
	const catCount = Math.max(chartData.categories.length, 1);
	const out: RenderableTrendline[] = [];

	chartData.series.forEach((series, si) => {
		if (!series.trendlines || series.trendlines.length === 0) {
			return;
		}

		series.trendlines.forEach((tl) => {
			const { points, equation, rSquared } = computeTrendlinePoints(
				tl,
				series.values,
				catCount,
				layout,
				range,
				mode,
			);
			if (points.length < 2) {
				return;
			}

			const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
			const color = tl.color || seriesColor(series, si, styleId, colorPalette);

			const labelParts: string[] = [];
			if (tl.displayEq && equation) {
				labelParts.push(equation);
			}
			if (tl.displayRSq) {
				labelParts.push(`R² = ${rSquared.toFixed(4)}`);
			}

			const last = points[points.length - 1];
			out.push({
				pathData,
				color,
				label: labelParts.length > 0 ? labelParts.join('  ') : undefined,
				labelX: labelParts.length > 0 ? last.x : undefined,
				labelY: labelParts.length > 0 ? last.y - 6 : undefined,
			});
		});
	});

	return out;
}
