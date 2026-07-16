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

import type {
	PlotLayout,
	SvgLine,
	SvgPath,
	SvgPrimitive,
	SvgText,
	ValueRange,
} from './chart-view-model';
import { formatAxisValue, seriesColor, valueToY } from './chart-view-model';

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
					fontSize: 7,
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

	// X axis title (category axis at bottom).
	const catAxis = axes.find((a) => a.axisType === 'catAx' && a.axPos !== 'r' && a.titleText);
	if (catAxis?.titleText) {
		const xTitle: SvgText = {
			kind: 'text',
			x: layout.plotLeft + layout.plotWidth / 2,
			y: layout.plotBottom + 22,
			text: catAxis.titleText,
			fontSize: 9,
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
			fontSize: 9,
			fill: AXIS_TITLE_COLOR,
			textAnchor: 'middle',
			fontWeight: 'bold',
			transform: `rotate(-90, ${yx}, ${yy})`,
		};
		out.push(yTitle);
	}

	return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: data-table cell formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a single data value as a short human-readable string.
 * Mirrors `formatValue` in chart-data-table.tsx (React) — identical to
 * `formatAxisValue` but kept local for clarity.
 */
function formatDataValue(val: number): string {
	return formatAxisValue(val);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: data table primitives
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Layout constants for the SVG data table rendered below the plot area.
 * Kept as named constants so tests can assert against them without magic numbers.
 */
export const DATA_TABLE_ROW_H = 14;
export const DATA_TABLE_HEADER_H = 14;
export const DATA_TABLE_KEY_W = 60;
export const DATA_TABLE_PADDING = 4;

/**
 * Build `SvgPrimitive[]` for a simple data table rendered below the plot area.
 *
 * The table is rendered as SVG `rect` (borders) + `text` (labels) primitives.
 * Columns = categories; rows = series (with an optional series-key column on
 * the left when `dataTable.showKeys !== false`).
 *
 * Border flags from `PptxChartDataTable` are respected:
 *   - `showHorzBorder` — horizontal rules between rows
 *   - `showVertBorder` — vertical rules between columns
 *   - `showOutline`    — outer border rectangle
 *   - `showKeys`       — series name/colour key column
 *
 * Mirrors `renderChartDataTable` in chart-data-table.tsx (React), translated
 * to pure SVG primitives so the Angular template can render them natively.
 *
 * @param chartData  Full parsed chart data (`dataTable` must be present).
 * @param layout     Plot-area bounding box — the table is placed at `plotBottom + 4`.
 * @param colorPalette  Optional resolved colour palette (same as chart).
 */
export function computeDataTablePrimitives(
	chartData: PptxChartData,
	layout: PlotLayout,
	colorPalette?: readonly string[],
): SvgPrimitive[] {
	const table = chartData.dataTable;
	if (!table) {
		return [];
	}

	const categories = chartData.categories;
	const series = chartData.series;
	if (categories.length === 0 && series.length === 0) {
		return [];
	}

	const out: SvgPrimitive[] = [];

	const showH = table.showHorzBorder !== false;
	const showV = table.showVertBorder !== false;
	const showO = table.showOutline !== false;
	const showK = table.showKeys !== false;

	const borderColor = '#cbd5e1';
	const textColor = '#334155';
	const headerWeight: 'bold' | 'normal' = 'bold';

	const catCount = categories.length;
	const seriesCount = series.length;

	// Column metrics
	const keyColW = showK ? DATA_TABLE_KEY_W : 0;
	const totalW = layout.plotWidth;
	const cellW = catCount > 0 ? (totalW - keyColW) / catCount : totalW - keyColW;

	// Table top edge (just below the plot bottom)
	const tableTop = layout.plotBottom + DATA_TABLE_PADDING;

	// Total table height: 1 header row + N series rows
	const tableH = DATA_TABLE_HEADER_H + seriesCount * DATA_TABLE_ROW_H;

	// Outer border — rendered as four SvgLine segments because SvgRect has no
	// `stroke` field (only `fill`).
	if (showO) {
		const mkBorderLine = (x1: number, y1: number, x2: number, y2: number): SvgLine => ({
			kind: 'line',
			x1,
			y1,
			x2,
			y2,
			stroke: borderColor,
			strokeWidth: 1,
		});
		out.push(mkBorderLine(layout.plotLeft, tableTop, layout.plotLeft + totalW, tableTop));
		out.push(
			mkBorderLine(layout.plotLeft + totalW, tableTop, layout.plotLeft + totalW, tableTop + tableH),
		);
		out.push(
			mkBorderLine(layout.plotLeft + totalW, tableTop + tableH, layout.plotLeft, tableTop + tableH),
		);
		out.push(mkBorderLine(layout.plotLeft, tableTop + tableH, layout.plotLeft, tableTop));
	}

	// Helper: x-position of column ci (0-based category columns, after key col)
	function colX(ci: number): number {
		return layout.plotLeft + keyColW + ci * cellW;
	}

	// Helper: y-position of row ri (0 = header)
	function rowY(ri: number): number {
		return tableTop + (ri === 0 ? 0 : DATA_TABLE_HEADER_H + (ri - 1) * DATA_TABLE_ROW_H);
	}

	// Header row: category labels
	categories.forEach((cat, ci) => {
		const x = colX(ci) + cellW / 2;
		const y = rowY(0) + DATA_TABLE_HEADER_H / 2 + 3;
		const label: SvgText = {
			kind: 'text',
			x,
			y,
			text: cat,
			fontSize: 8,
			fill: textColor,
			textAnchor: 'middle',
			fontWeight: headerWeight,
		};
		out.push(label);

		// Vertical border after this column header (not after the last)
		if (showV && ci < catCount - 1) {
			const vx = colX(ci) + cellW;
			const vLine: SvgLine = {
				kind: 'line',
				x1: vx,
				y1: tableTop,
				x2: vx,
				y2: tableTop + tableH,
				stroke: borderColor,
				strokeWidth: 1,
			};
			out.push(vLine);
		}
	});

	// Horizontal border under header
	if (showH) {
		const hy = tableTop + DATA_TABLE_HEADER_H;
		const hLine: SvgLine = {
			kind: 'line',
			x1: layout.plotLeft,
			y1: hy,
			x2: layout.plotLeft + totalW,
			y2: hy,
			stroke: borderColor,
			strokeWidth: 1,
		};
		out.push(hLine);
	}

	// Vertical border between key column and first data column
	if (showK && showV) {
		const kvx = layout.plotLeft + keyColW;
		const kvLine: SvgLine = {
			kind: 'line',
			x1: kvx,
			y1: tableTop,
			x2: kvx,
			y2: tableTop + tableH,
			stroke: borderColor,
			strokeWidth: 1,
		};
		out.push(kvLine);
	}

	// Data rows
	series.forEach((s: PptxChartSeries, si: number) => {
		const rowIndex = si + 1; // row 0 is the header
		const ry = rowY(rowIndex);
		const cellCy = ry + DATA_TABLE_ROW_H / 2 + 3;

		// Series key cell (colour swatch + name)
		if (showK) {
			const swatchX = layout.plotLeft + DATA_TABLE_PADDING;
			const swatchY = ry + DATA_TABLE_ROW_H / 2 - 3;
			const swatchColor = seriesColor(s, si, colorPalette);

			// Colour swatch as a small filled rect
			out.push({
				kind: 'rect',
				x: swatchX,
				y: swatchY,
				w: 7,
				h: 7,
				fill: swatchColor,
				rx: 1,
			});

			// Series name text
			const nameX = swatchX + 9;
			const nameLabel: SvgText = {
				kind: 'text',
				x: nameX,
				y: cellCy,
				text: s.name,
				fontSize: 8,
				fill: textColor,
				textAnchor: 'start',
			};
			out.push(nameLabel);
		}

		// Data cells
		categories.forEach((_cat, ci) => {
			const val = s.values[ci];
			const cellLabel: SvgText = {
				kind: 'text',
				x: colX(ci) + cellW / 2,
				y: cellCy,
				text: val !== undefined ? formatDataValue(val) : '',
				fontSize: 8,
				fill: textColor,
				textAnchor: 'middle',
			};
			out.push(cellLabel);
		});

		// Horizontal border below this row (not after the last)
		if (showH && si < seriesCount - 1) {
			const hy2 = ry + DATA_TABLE_ROW_H;
			const hRowLine: SvgLine = {
				kind: 'line',
				x1: layout.plotLeft,
				y1: hy2,
				x2: layout.plotLeft + totalW,
				y2: hy2,
				stroke: borderColor,
				strokeWidth: 1,
			};
			out.push(hRowLine);
		}
	});

	return out;
}
