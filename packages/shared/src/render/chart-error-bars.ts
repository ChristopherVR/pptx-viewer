import type { PptxChartData, PptxChartErrBars, PptxChartSeries } from 'pptx-viewer-core';

import type { PlotLayout, SvgLine, SvgPrimitive, ValueRange } from './chart-view-model';
import { valueToY } from './chart-view-model';

const DEFAULT_COLOR = '#334155';
const CAP_HALF_WIDTH = 4;

export interface ErrorBarRenderOptions {
	/** Source point indexes in display order after category/date-axis filtering. */
	sourceIndices?: ReadonlyArray<number>;
	/** Exact display X positions for reordered category/date points. */
	xPositions?: ReadonlyArray<number>;
	/** Per-series Y ranges, used by secondary-axis combo series. */
	seriesRanges?: ReadonlyArray<ValueRange | undefined>;
	/** Per-series category mapping mode for mixed bar/line charts. */
	seriesModes?: ReadonlyArray<'line' | 'bar' | undefined>;
}

function categoryX(value: number, count: number, layout: PlotLayout, mode: 'line' | 'bar'): number {
	if (mode === 'bar') {
		const slot = layout.plotWidth / Math.max(count, 1);
		return layout.plotLeft + slot * value + slot / 2;
	}
	return layout.plotLeft + (value / Math.max(count - 1, 1)) * layout.plotWidth;
}

function positionedCategoryX(
	value: number,
	positions: ReadonlyArray<number> | undefined,
	fallback: (value: number) => number,
): number {
	if (!positions || positions.length === 0) {
		return fallback(value);
	}
	const lower = Math.floor(value);
	const upper = Math.ceil(value);
	const at = (index: number): number => {
		if (positions[index] !== undefined) {
			return positions[index];
		}
		const lastIndex = positions.length - 1;
		const last = positions[lastIndex] ?? 0;
		const beforeLast =
			lastIndex > 0 ? (positions[lastIndex - 1] ?? positions[0] ?? 0) : (positions[0] ?? 0);
		const gap = last - beforeLast;
		return last + gap * (index - positions.length + 1);
	};
	return at(lower) + (at(upper) - at(lower)) * (value - lower);
}

function numericX(value: number, range: ValueRange, layout: PlotLayout): number {
	return layout.plotLeft + ((value - range.min) / Math.max(range.span, 1e-9)) * layout.plotWidth;
}

function xValuesForSeries(
	chartData: PptxChartData,
	series: PptxChartSeries,
	indexes: ReadonlyArray<number>,
): { values: number[]; numeric: boolean } {
	const seriesType = series.seriesChartType ?? chartData.chartType;
	const numeric = seriesType === 'scatter' || seriesType === 'bubble';
	if (!numeric) {
		return { values: indexes.map((_index, displayIndex) => displayIndex), numeric: false };
	}
	return {
		values: indexes.map((index) => {
			const parsed = Number(chartData.categories[index]);
			return Number.isFinite(parsed) ? parsed : index;
		}),
		numeric: true,
	};
}

function numericXRange(values: number[]): ValueRange {
	const min = Math.min(...values);
	const max = Math.max(...values);
	return { min, max, span: Math.max(max - min, 1) };
}

function errorValue(
	errBars: PptxChartErrBars,
	values: number[],
	displayIndex: number,
	sourceIndex: number,
	direction: 'plus' | 'minus',
): number {
	switch (errBars.valType) {
		case 'fixedVal':
			return errBars.val ?? 0;
		case 'percentage':
			return Math.abs(values[displayIndex] ?? 0) * ((errBars.val ?? 0) / 100);
		case 'stdDev': {
			const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
			const variance =
				values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(values.length, 1);
			return Math.sqrt(variance) * (errBars.val ?? 1);
		}
		case 'stdErr': {
			const count = Math.max(values.length, 1);
			const mean = values.reduce((sum, value) => sum + value, 0) / count;
			const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / count;
			return Math.sqrt(variance / count);
		}
		case 'cust':
			return direction === 'plus'
				? (errBars.customPlus?.[sourceIndex] ?? 0)
				: (errBars.customMinus?.[sourceIndex] ?? 0);
	}
}

function line(x1: number, y1: number, x2: number, y2: number, color: string): SvgLine {
	return { kind: 'line', x1, y1, x2, y2, stroke: color, strokeWidth: 1 };
}

function appendYBar(
	out: SvgPrimitive[],
	errBars: PptxChartErrBars,
	x: number,
	baseValue: number,
	error: number,
	direction: 'plus' | 'minus',
	range: ValueRange,
	layout: PlotLayout,
): void {
	const color = errBars.color ?? DEFAULT_COLOR;
	const baseY = valueToY(baseValue, range, layout.plotTop, layout.plotBottom);
	const endValue = direction === 'plus' ? baseValue + error : baseValue - error;
	const endY = valueToY(endValue, range, layout.plotTop, layout.plotBottom);
	out.push(line(x, baseY, x, endY, color));
	if (!errBars.noEndCap) {
		out.push(line(x - CAP_HALF_WIDTH, endY, x + CAP_HALF_WIDTH, endY, color));
	}
}

function appendXBar(
	out: SvgPrimitive[],
	errBars: PptxChartErrBars,
	baseXValue: number,
	error: number,
	direction: 'plus' | 'minus',
	y: number,
	toPixel: (value: number) => number,
): void {
	const color = errBars.color ?? DEFAULT_COLOR;
	const baseX = toPixel(baseXValue);
	const endValue = direction === 'plus' ? baseXValue + error : baseXValue - error;
	const endX = toPixel(endValue);
	out.push(line(baseX, y, endX, y, color));
	if (!errBars.noEndCap) {
		out.push(line(endX, y - CAP_HALF_WIDTH, endX, y + CAP_HALF_WIDTH, color));
	}
}

/** Build X- and Y-direction ChartML error-bar primitives for cartesian series. */
export function computeErrorBarPrimitives(
	chartData: PptxChartData,
	catCount: number,
	layout: PlotLayout,
	range: ValueRange,
	mode: 'line' | 'bar' = 'line',
	options: ErrorBarRenderOptions = {},
): SvgPrimitive[] {
	const out: SvgPrimitive[] = [];
	chartData.series.forEach((series, seriesIndex) => {
		const indexes = options.sourceIndices ?? series.values.map((_value, index) => index);
		const yValues = indexes.map((index) => series.values[index] ?? 0);
		const xValues = xValuesForSeries(chartData, series, indexes);
		const xRange = xValues.numeric ? numericXRange(xValues.values) : undefined;
		const seriesMode = options.seriesModes?.[seriesIndex] ?? mode;
		const yRange = options.seriesRanges?.[seriesIndex] ?? range;
		series.errBars?.forEach((errBars) => {
			indexes.forEach((sourceIndex, displayIndex) => {
				const yValue = yValues[displayIndex] ?? 0;
				const baseXValue = xValues.values[displayIndex] ?? displayIndex;
				const categoryMapper = (value: number) =>
					positionedCategoryX(value, options.xPositions, (index) =>
						categoryX(index, indexes.length || catCount, layout, seriesMode),
					);
				const toPixel = xValues.numeric
					? (value: number) => numericX(value, xRange!, layout)
					: categoryMapper;
				const x = toPixel(baseXValue);
				const y = valueToY(yValue, yRange, layout.plotTop, layout.plotBottom);
				for (const direction of ['plus', 'minus'] as const) {
					if (errBars.barType !== direction && errBars.barType !== 'both') {
						continue;
					}
					const values = errBars.direction === 'x' ? xValues.values : yValues;
					const error = errorValue(errBars, values, displayIndex, sourceIndex, direction);
					if (errBars.direction === 'x') {
						appendXBar(out, errBars, baseXValue, error, direction, y, toPixel);
					} else {
						appendYBar(out, errBars, x, yValue, error, direction, yRange, layout);
					}
				}
			});
		});
	});
	return out;
}
