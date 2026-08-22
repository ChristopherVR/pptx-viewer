/**
 * chart-overlays.ts — chart overlay depth for Angular pptx-angular-viewer.
 *
 * Pure functions that produce additional `SvgPrimitive[]` / `SvgText[]` for an
 * existing cartesian chart.  No Angular dependencies; all inputs are typed
 * against `pptx-viewer-core` and the `SvgPrimitive` union already defined in
 * `chart-renderer-helpers.ts`.
 *
 * Ported / adapted from:
 *   packages/react/src/viewer/utils/chart-trendlines.tsx       (regression engine)
 *   packages/react/src/viewer/utils/chart-overlay-lines.tsx    (error bars)
 *   packages/react/src/viewer/utils/chart-chrome.tsx           (axis titles)
 *   packages/react/src/viewer/utils/chart-data-table.tsx       (data table)
 *   packages/shared/src/render/chart-trendlines.ts             (shared port)
 *
 * @module chart-overlays
 */

import type { PptxChartData, PptxChartSeries, PptxChartTrendline } from 'pptx-viewer-core';

import { DEFAULT_CHART_DATA_LABEL_PX, DEFAULT_CHART_TEXT_PX, chartFontPx } from './chart-font';
import type { PlotLayout, SvgPath, SvgPrimitive, SvgText, ValueRange } from './chart-view-model';
import { seriesColor, valueToY } from './chart-view-model';

export { computeErrorBarPrimitives } from './chart-error-bars';

// ─────────────────────────────────────────────────────────────────────────────
// Internal: coordinate helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map a (possibly fractional / extrapolated) category index to an X pixel.
 * `mode === 'bar'` centres on category slots; `'line'` anchors at data points.
 * Mirrors `xToPixel` from chart-overlay-utils.ts (React) and the shared port.
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

// ─────────────────────────────────────────────────────────────────────────────
// Internal: regression helpers (exported for unit-testing)
// ─────────────────────────────────────────────────────────────────────────────

/** Result of an ordinary least-squares linear regression. */
export interface LinearFit {
	slope: number;
	intercept: number;
	rSquared: number;
}

/**
 * Ordinary least-squares linear regression of `yVals` on `xVals`.
 * Returns slope=0, intercept=mean(y), rSquared=0 when fewer than 2 points or
 * when the denominator is effectively zero (vertical / constant-x data).
 *
 * Mirrors `computeLinearRegression` in chart-trendlines.tsx (React) and
 * chart-trendlines.ts (shared).
 */
export function computeLinearRegression(xVals: number[], yVals: number[]): LinearFit {
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

/**
 * Fit polynomial coefficients (ascending order: [a0, a1, …, a_order]) via
 * Gaussian elimination on the normal equations.
 * Mirrors `fitPolynomial` in chart-trendlines.tsx (React).
 */
export function fitPolynomial(xVals: number[], yVals: number[], order: number): number[] {
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

/**
 * Coefficient of determination (R²) of an arbitrary fit function against data.
 * Mirrors `computeRSquared` in chart-trendlines.tsx (React).
 */
export function computeRSquared(
	xVals: number[],
	yVals: number[],
	evalFn: (x: number) => number,
): number {
	const n = xVals.length;
	if (n === 0) {
		return 0;
	}
	const meanY = yVals.reduce((s, y) => s + y, 0) / n;
	let ssRes = 0;
	let ssTot = 0;
	for (let i = 0; i < n; i++) {
		ssRes += (yVals[i] - evalFn(xVals[i])) ** 2;
		ssTot += (yVals[i] - meanY) ** 2;
	}
	return ssTot > 0 ? 1 - ssRes / ssTot : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: single-trendline point computation
// ─────────────────────────────────────────────────────────────────────────────

interface TrendlinePoint {
	x: number;
	y: number;
}

interface ComputedTrend {
	points: TrendlinePoint[];
	equation: string;
	rSquared: number;
}

/**
 * Compute the polyline points (and equation / R²) for one trendline over a
 * series' values. Returns empty points when the type is unsupported or data is
 * too sparse. Mirrors `computeTrendlinePoints` in chart-trendlines.tsx (React).
 */
function computeTrendlinePoints(
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
			const fixedIntercept = trendline.intercept;
			const slope =
				fixedIntercept !== undefined
					? yVals.reduce((s, y, i) => s + (y - fixedIntercept) * xVals[i], 0) /
						xVals.reduce((s, x) => s + x * x, 0)
					: reg.slope;
			const b = fixedIntercept ?? reg.intercept;
			evalFn = (x) => slope * x + b;
			equation = `y = ${slope.toFixed(2)}x + ${b.toFixed(2)}`;
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
			equation = `y = ${a.toFixed(2)}e^(${b.toFixed(2)}x)`;
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
			equation = `y = ${reg.slope.toFixed(2)}ln(x) + ${reg.intercept.toFixed(2)}`;
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
		const px = xToPixel(xVal, catCount, layout, mode);
		const py = valueToY(yVal, range, layout.plotTop, layout.plotBottom);
		points.push({ x: px, y: py });
	}

	return { points, equation, rSquared };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: trendline primitives
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build `SvgPrimitive[]` for all trendlines declared by every series in
 * `chartData`.  Returns an empty array when no series declares a trendline.
 *
 * Each trendline produces:
 *   - one `SvgPath` (dashed polyline in the series / trendline colour), and
 *   - optionally one `SvgText` with the equation / R² label at the last point.
 *
 * @param chartData  Full parsed chart data.
 * @param catCount   Number of categories (x-slots), e.g. `chartData.categories.length || 1`.
 * @param layout     Plot-area bounding box from `computePlotLayout`.
 * @param range      Value-axis range from `computeValueRange` / `computeStackedValueRange`.
 * @param mode       `'bar'` for bar/column, `'line'` for line/area/scatter.
 * @param colorPalette  Optional resolved palette (same as passed to `seriesColor`).
 */
export function computeTrendlinePrimitives(
	chartData: PptxChartData,
	catCount: number,
	layout: PlotLayout,
	range: ValueRange,
	mode: 'line' | 'bar' = 'line',
	colorPalette?: readonly string[],
): SvgPrimitive[] {
	const out: SvgPrimitive[] = [];

	chartData.series.forEach((series: PptxChartSeries, si: number) => {
		if (!series.trendlines || series.trendlines.length === 0) {
			return;
		}

		series.trendlines.forEach((tl: PptxChartTrendline) => {
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

			const pathD = points
				.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
				.join(' ');
			const strokeColor = tl.color ?? seriesColor(series, si, colorPalette);

			const pathPrimitive: SvgPath = {
				kind: 'path',
				d: pathD,
				fill: 'none',
				stroke: strokeColor,
				strokeWidth: 1.5,
			};
			out.push(pathPrimitive);

			const labelParts: string[] = [];
			if (tl.displayEq && equation) {
				labelParts.push(equation);
			}
			if (tl.displayRSq) {
				labelParts.push(`R² = ${rSquared.toFixed(4)}`);
			}

			if (labelParts.length > 0) {
				const last = points[points.length - 1];
				const labelText: SvgText = {
					kind: 'text',
					x: last.x,
					y: last.y - 6,
					text: labelParts.join('  '),
					fontSize: DEFAULT_CHART_DATA_LABEL_PX,
					fill: strokeColor,
					textAnchor: 'end',
				};
				out.push(labelText);
			}
		});
	});

	return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: axis title primitives
// ─────────────────────────────────────────────────────────────────────────────

/** Fill colour for axis title text. */
const AXIS_TITLE_COLOR = '#475569';

/**
 * Build `SvgText[]` for the X and Y axis titles.
 *
 * Axis titles are read from `chartData.axes`:
 *   - the primary category axis (`catAx`, `axPos === 'b'`) drives the X title
 *   - the primary value axis (`valAx`, `axPos === 'l'` or first `valAx`) drives the Y title
 *
 * **Rotation note**: `SvgText` has no `transform` or `rotate` field.  The Y
 * axis title is therefore placed to the left of the plot without rotation and
 * noted inline.  If the orchestrator adds a `transform?: string` field to
 * `SvgText` (or a new `SvgTransform` wrapper primitive), the Y title can be
 * rendered rotated -90° by passing
 * `transform: \`rotate(-90, ${x}, ${y})\`` — the template expression is
 * straightforward once the field exists.
 *
 * @param chartData  Full parsed chart data.
 * @param layout     Plot-area bounding box.
 */
export function computeAxisTitlePrimitives(
	chartData: PptxChartData,
	layout: PlotLayout,
): SvgText[] {
	const out: SvgText[] = [];
	const axes = chartData.axes;
	if (!axes || axes.length === 0) {
		return out;
	}

	// Axis-title font: core folds a parsed/edited title size into `axis.fontSize`
	// (points); convert at the pt -> px boundary, defaulting to PowerPoint's
	// 10 pt chart text. See chart-font.ts.
	const titleFontPx = (axis: { fontSize?: number }): number =>
		axis.fontSize !== undefined ? chartFontPx(axis.fontSize) : DEFAULT_CHART_TEXT_PX;

	// X axis title (category axis at bottom).
	const catAxis = axes.find((a) => a.axisType === 'catAx' && a.axPos !== 'r' && a.titleText);
	if (catAxis?.titleText) {
		const xTitle: SvgText = {
			kind: 'text',
			x: layout.plotLeft + layout.plotWidth / 2,
			y: layout.plotBottom + 22,
			text: catAxis.titleText,
			fontSize: titleFontPx(catAxis),
			fill: AXIS_TITLE_COLOR,
			textAnchor: 'middle',
			fontWeight: 'bold',
		};
		out.push(xTitle);
	}

	// Y axis title (value axis at left), rotated -90° about its own anchor and
	// centred vertically on the plot area.
	const valAxis =
		axes.find((a) => a.axisType === 'valAx' && a.axPos !== 'r' && a.titleText) ??
		axes.find((a) => a.axisType === 'valAx' && a.titleText);
	if (valAxis?.titleText) {
		const yx = 12;
		const yy = layout.plotTop + layout.plotHeight / 2;
		const yTitle: SvgText = {
			kind: 'text',
			x: yx,
			y: yy,
			text: valAxis.titleText,
			fontSize: titleFontPx(valAxis),
			fill: AXIS_TITLE_COLOR,
			textAnchor: 'middle',
			fontWeight: 'bold',
			transform: `rotate(-90, ${yx}, ${yy})`,
		};
		out.push(yTitle);
	}

	return out;
}
