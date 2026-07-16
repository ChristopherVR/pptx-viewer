import type { PptxChartAxisFormatting, PptxChartSeries } from 'pptx-viewer-core';

import type { ValueRange } from './chart-helpers';
import { computeValueRange } from './chart-helpers';

/** Compute a logarithmic range snapped to powers of the requested base. */
export function computeLogValueRange(
	series: ReadonlyArray<PptxChartSeries>,
	logBase: number,
): ValueRange {
	const allValues = series.flatMap((item) => item.values).filter((value) => value > 0);
	if (allValues.length === 0) {
		return { min: 1, max: logBase, span: 1, logScale: true, logBase };
	}
	const dataMin = Math.min(...allValues);
	const dataMax = Math.max(...allValues);
	const logMin = Math.floor(Math.log(dataMin) / Math.log(logBase));
	const logMax = Math.ceil(Math.log(dataMax) / Math.log(logBase));
	const min = logBase ** logMin;
	const max = logBase ** Math.max(logMax, logMin + 1);
	return {
		min,
		max,
		span: Math.max(Math.log(max) / Math.log(logBase) - Math.log(min) / Math.log(logBase), 1),
		logScale: true,
		logBase,
	};
}

/** Compute a value range using one parsed value axis's scale and bounds. */
export function computeValueRangeForAxis(
	series: ReadonlyArray<PptxChartSeries>,
	axis: PptxChartAxisFormatting | undefined,
): ValueRange {
	const requestedLogBase = axis?.logBase ?? 10;
	const logBase =
		axis?.logScale && Number.isFinite(requestedLogBase) && requestedLogBase > 1
			? requestedLogBase
			: axis?.logScale
				? 10
				: undefined;
	const automatic = logBase ? computeLogValueRange(series, logBase) : computeValueRange(series);
	const validMin =
		typeof axis?.min === 'number' && Number.isFinite(axis.min) && (!logBase || axis.min > 0)
			? axis.min
			: undefined;
	const validMax =
		typeof axis?.max === 'number' && Number.isFinite(axis.max) && (!logBase || axis.max > 0)
			? axis.max
			: undefined;
	const min = validMin ?? automatic.min;
	let max = validMax ?? automatic.max;
	if (max <= min) {
		max = logBase ? min * logBase : min + 1;
	}
	const span = logBase
		? Math.log(max) / Math.log(logBase) - Math.log(min) / Math.log(logBase)
		: max - min;
	return {
		min,
		max,
		span: Math.max(span, Number.EPSILON),
		...(logBase ? { logScale: true, logBase } : {}),
	};
}

/** Map a data value to a logarithmic Y coordinate. */
export function valueToYLog(val: number, range: ValueRange, topY: number, bottomY: number): number {
	const base = range.logBase ?? 10;
	const logValue = Math.log(Math.max(val, range.min)) / Math.log(base);
	const logMin = Math.log(range.min) / Math.log(base);
	return bottomY - ((logValue - logMin) / range.span) * (bottomY - topY);
}

/** Generate one tick for each power of the range's logarithmic base. */
export function generateLogTicks(range: ValueRange): number[] {
	if (!range.logScale || !range.logBase) {
		return [];
	}
	const base = range.logBase;
	const logMin = Math.log(range.min) / Math.log(base);
	const logMax = Math.log(range.max) / Math.log(base);
	const firstExponent = Math.ceil(logMin - Number.EPSILON);
	const lastExponent = Math.floor(logMax + Number.EPSILON);
	if (lastExponent < firstExponent) {
		return range.min === range.max ? [range.min] : [range.min, range.max];
	}
	return Array.from(
		{ length: lastExponent - firstExponent + 1 },
		(_unused, index) => base ** (firstExponent + index),
	);
}

/** Find any parsed logarithmic value axis. */
export function findLogAxis(
	axes: PptxChartAxisFormatting[] | undefined,
): PptxChartAxisFormatting | undefined {
	return axes?.find((axis) => axis.axisType === 'valAx' && axis.logScale);
}

/** Compute the primary value range for a chart. */
export function computeValueRangeForChart(
	series: ReadonlyArray<PptxChartSeries>,
	axes?: PptxChartAxisFormatting[],
): ValueRange {
	const primaryAxis =
		axes?.find((axis) => axis.axisType === 'valAx' && axis.axPos === 'l') ??
		axes?.find((axis) => axis.axisType === 'valAx' && axis.axPos !== 'r');
	return computeValueRangeForAxis(series, primaryAxis);
}
