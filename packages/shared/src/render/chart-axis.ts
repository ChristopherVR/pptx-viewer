/**
 * chart-axis.ts — framework-agnostic axis maths beyond the linear-Y basics in
 * `chart-helpers.ts`.
 *
 * Three concerns, all pure and reused by every binding:
 *  - **log scale**: `computeLogValueRange` / `valueToYLog` / `generateLogTicks`
 *    and the auto-detecting `computeValueRangeForChart`.
 *  - **display units**: `getDisplayUnitDivisor` / `getDisplayUnitLabel` /
 *    `formatAxisValueWithUnits` (thousands / millions / … scaling).
 *  - **secondary axes & data-table reservation**: detection + series→axis split
 *    helpers and `computeLayoutOptions` feeding the extended `computeLayout`.
 *
 * Extracted from the React `viewer/utils/chart-helpers.ts` (log + display units)
 * and `viewer/utils/chart-layout.ts` (secondary axes + data table).
 *
 * @module chart-axis
 */
import type {
	PptxChartAxisFormatting,
	PptxChartDataTable,
	PptxChartSeries,
} from 'pptx-viewer-core';

import type { ValueRange } from './chart-helpers';
import { computeValueRange } from './chart-helpers';

// ── Log scale ────────────────────────────────────────────────────

/**
 * Compute a logarithmic value range for axes with logScale enabled.
 * Values <= 0 are clamped to a small positive number since log(0) is undefined.
 * The returned min/max are in data-space (not log-space) so that tick generation
 * can produce clean power-of-base labels.
 */
export function computeLogValueRange(
	series: ReadonlyArray<PptxChartSeries>,
	logBase: number,
): ValueRange {
	const allValues = series.flatMap((s) => s.values).filter((v) => v > 0);
	if (allValues.length === 0) {
		return { min: 1, max: logBase, span: 1, logScale: true, logBase };
	}

	const dataMin = Math.min(...allValues);
	const dataMax = Math.max(...allValues);

	// Snap to nearest power-of-base boundaries for clean ticks
	const logMin = Math.floor(Math.log(dataMin) / Math.log(logBase));
	const logMax = Math.ceil(Math.log(dataMax) / Math.log(logBase));

	const min = logBase ** logMin;
	const max = logBase ** Math.max(logMax, logMin + 1);
	const logSpan = Math.log(max) / Math.log(logBase) - Math.log(min) / Math.log(logBase);

	return {
		min,
		max,
		span: Math.max(logSpan, 1),
		logScale: true,
		logBase,
	};
}

/**
 * Map a data value to a Y pixel coordinate using logarithmic scaling.
 * Values <= 0 are clamped to range.min.
 */
export function valueToYLog(val: number, range: ValueRange, topY: number, bottomY: number): number {
	const usable = bottomY - topY;
	const base = range.logBase ?? 10;
	const clampedVal = Math.max(val, range.min);
	const logVal = Math.log(clampedVal) / Math.log(base);
	const logMin = Math.log(range.min) / Math.log(base);

	return bottomY - ((logVal - logMin) / range.span) * usable;
}

/**
 * Generate logarithmically-spaced tick values for a log-scale axis.
 * Returns tick values at each power of the base within the range.
 */
export function generateLogTicks(range: ValueRange): number[] {
	if (!range.logScale || !range.logBase) {
		return [];
	}

	const base = range.logBase;
	const logMin = Math.log(range.min) / Math.log(base);
	const logMax = Math.log(range.max) / Math.log(base);

	const ticks: number[] = [];
	for (let exp = Math.round(logMin); exp <= Math.round(logMax); exp++) {
		ticks.push(base ** exp);
	}

	return ticks;
}

/**
 * Find the value axis formatting from the axes array, looking for
 * a valAx with logScale enabled.
 */
export function findLogAxis(
	axes: PptxChartAxisFormatting[] | undefined,
): PptxChartAxisFormatting | undefined {
	return axes?.find((a) => a.axisType === 'valAx' && a.logScale);
}

/**
 * Compute the appropriate value range for a chart, automatically using
 * logarithmic scaling when a log-scale value axis is present.
 */
export function computeValueRangeForChart(
	series: ReadonlyArray<PptxChartSeries>,
	axes?: PptxChartAxisFormatting[],
): ValueRange {
	const logAxis = findLogAxis(axes);
	if (logAxis?.logBase) {
		return computeLogValueRange(series, logAxis.logBase);
	}
	return computeValueRange(series);
}

// ── Display units ────────────────────────────────────────────────

const DISPLAY_UNIT_DIVISORS: Record<string, number> = {
	hundreds: 100,
	thousands: 1_000,
	tenThousands: 10_000,
	hundredThousands: 100_000,
	millions: 1_000_000,
	tenMillions: 10_000_000,
	hundredMillions: 100_000_000,
	billions: 1_000_000_000,
	trillions: 1_000_000_000_000,
};

const DISPLAY_UNIT_LABELS: Record<string, string> = {
	hundreds: 'Hundreds',
	thousands: 'Thousands',
	tenThousands: 'Ten Thousands',
	hundredThousands: 'Hundred Thousands',
	millions: 'Millions',
	tenMillions: 'Ten Millions',
	hundredMillions: 'Hundred Millions',
	billions: 'Billions',
	trillions: 'Trillions',
};

/** Get the numeric divisor for a built-in display unit name. */
export function getDisplayUnitDivisor(unit: string | undefined, customValue?: number): number {
	if (!unit) {
		return 1;
	}
	if (unit === 'custom' && customValue) {
		return customValue;
	}
	return DISPLAY_UNIT_DIVISORS[unit] ?? 1;
}

/** Get the human-readable label for a display unit (custom label overrides built-in). */
export function getDisplayUnitLabel(unit: string | undefined, customLabel?: string): string {
	if (customLabel) {
		return customLabel;
	}
	if (!unit || unit === 'custom') {
		return '';
	}
	return DISPLAY_UNIT_LABELS[unit] ?? '';
}

/** Format an axis value with display unit scaling applied. */
export function formatAxisValueWithUnits(value: number, axis?: PptxChartAxisFormatting): string {
	if (!axis?.displayUnits) {
		return String(value);
	}
	const divisor = getDisplayUnitDivisor(axis.displayUnits, axis.displayUnitsValue);
	const scaled = value / divisor;
	return Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(1);
}

// ── Layout options (secondary axes + data table) ─────────────────

/** Options for extended layout computation with secondary axes and data tables. */
export interface LayoutOptions {
	hasSecondaryValueAxis?: boolean;
	hasSecondaryCategoryAxis?: boolean;
	hasDataTable?: boolean;
	dataTableRowCount?: number;
}

/** Check whether any axis in the list is a secondary value axis (position "r"). */
export function hasSecondaryValueAxis(axes: PptxChartAxisFormatting[] | undefined): boolean {
	if (!axes) {
		return false;
	}
	return axes.some((a) => a.axisType === 'valAx' && a.axPos === 'r');
}

/** Check whether any axis in the list is a secondary category axis (position "t"). */
export function hasSecondaryCategoryAxis(axes: PptxChartAxisFormatting[] | undefined): boolean {
	if (!axes) {
		return false;
	}
	return axes.some((a) => (a.axisType === 'catAx' || a.axisType === 'dateAx') && a.axPos === 't');
}

/** Get the secondary value axis formatting, if present. */
export function getSecondaryValueAxis(
	axes: PptxChartAxisFormatting[] | undefined,
): PptxChartAxisFormatting | undefined {
	if (!axes) {
		return undefined;
	}
	return axes.find((a) => a.axisType === 'valAx' && a.axPos === 'r');
}

/** Get the secondary category axis formatting, if present. */
export function getSecondaryCategoryAxis(
	axes: PptxChartAxisFormatting[] | undefined,
): PptxChartAxisFormatting | undefined {
	if (!axes) {
		return undefined;
	}
	return axes.find((a) => (a.axisType === 'catAx' || a.axisType === 'dateAx') && a.axPos === 't');
}

/** Compute layout options from chart data for use with computeLayout. */
export function computeLayoutOptions(
	axes: PptxChartAxisFormatting[] | undefined,
	dataTable: PptxChartDataTable | undefined,
	seriesCount: number,
): LayoutOptions {
	return {
		hasSecondaryValueAxis: hasSecondaryValueAxis(axes),
		hasSecondaryCategoryAxis: hasSecondaryCategoryAxis(axes),
		hasDataTable: Boolean(dataTable),
		dataTableRowCount: dataTable ? seriesCount : undefined,
	};
}

// ── Series-to-axis mapping ────────────────────────────────────────

/** Get the axis ID of the secondary value axis, if present. */
export function getSecondaryValueAxisId(
	axes: PptxChartAxisFormatting[] | undefined,
): number | undefined {
	const ax = getSecondaryValueAxis(axes);
	return ax?.axisId;
}

/** Get the axis ID of the primary value axis (position "l" or first valAx). */
export function getPrimaryValueAxisId(
	axes: PptxChartAxisFormatting[] | undefined,
): number | undefined {
	if (!axes) {
		return undefined;
	}
	const primary = axes.find((a) => a.axisType === 'valAx' && a.axPos === 'l');
	return primary?.axisId ?? axes.find((a) => a.axisType === 'valAx')?.axisId;
}

/**
 * Determine whether a series is mapped to the secondary axis.
 *
 * A series is secondary if it has an `axisId` that matches the secondary value
 * axis ID. When no axis IDs are set on series this returns false (callers that
 * want a combo heuristic apply it themselves).
 */
export function isSeriesOnSecondaryAxis(
	series: PptxChartSeries,
	axes: PptxChartAxisFormatting[] | undefined,
): boolean {
	if (!axes) {
		return false;
	}
	const secAxisId = getSecondaryValueAxisId(axes);
	if (secAxisId === undefined) {
		return false;
	}

	if (series.axisId !== undefined) {
		return series.axisId === secAxisId;
	}

	return false;
}

/**
 * Split chart series into primary and secondary groups based on axis mapping.
 *
 * Returns `{ primary, secondary }` where each entry preserves the original index.
 */
export function splitSeriesByAxis(
	series: ReadonlyArray<PptxChartSeries>,
	axes: PptxChartAxisFormatting[] | undefined,
): {
	primary: { series: PptxChartSeries; index: number }[];
	secondary: { series: PptxChartSeries; index: number }[];
} {
	const primary: { series: PptxChartSeries; index: number }[] = [];
	const secondary: { series: PptxChartSeries; index: number }[] = [];

	for (let i = 0; i < series.length; i++) {
		if (isSeriesOnSecondaryAxis(series[i], axes)) {
			secondary.push({ series: series[i], index: i });
		} else {
			primary.push({ series: series[i], index: i });
		}
	}

	return { primary, secondary };
}

/** Height occupied by data table rows. */
export function computeDataTableHeight(
	dataTable: PptxChartDataTable | undefined,
	seriesCount: number,
): number {
	if (!dataTable) {
		return 0;
	}
	const rowCount = Math.max(seriesCount, 1);
	return 14 + rowCount * 14;
}
