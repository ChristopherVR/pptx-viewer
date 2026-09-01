/**
 * chart-view-model-scale.ts: palette, value-range and axis-value helpers of
 * the chart engine. Split out of `chart-view-model.ts`, which re-exports
 * everything here; see that module's header for the palette caveat.
 *
 * @module chart-view-model-scale
 */
/* eslint-disable one-var -- this module predates the rule and combining every
   sibling `const`/`let` in a function into one comma-list (oxlint's own
   `--fix` cannot do this safely once a non-declaration statement sits between
   them) would churn geometry code far beyond this change's scope. */

import type { PptxChartSeries } from 'pptx-viewer-core';

import { niceValueAxisBounds } from './chart-axis-nice';
import { DEFAULT_CHART_PALETTE } from './chart-helpers';
import { formatChartNumber } from './chart-number-format';

// ─────────────────────────────────────────────────────────────────────────────
// Palette
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default Office accent palette (accent1-accent6 plus the two chart extras).
 *
 * An alias of `DEFAULT_CHART_PALETTE` (chart-helpers.ts), on purpose: the two
 * shared entry points used to carry different fallback palettes, so the same
 * unstyled chart painted Office accents in one binding and a Tailwind-ish set
 * in another depending on which helper its renderer imported.
 */
export const DEFAULT_PALETTE: readonly string[] = DEFAULT_CHART_PALETTE;

/** Return the palette colour for an index, preferring a parsed colour palette. */
export function paletteColor(index: number, colorPalette: readonly string[] | undefined): string {
	const pal = colorPalette && colorPalette.length > 0 ? colorPalette : DEFAULT_PALETTE;
	return pal[index % pal.length];
}

/**
 * Resolve a series' colour, preferring the series' own `color` property, then
 * its marker fill (scatter series often author `a:ln/a:noFill` on the series
 * and put the colour on `c:marker/c:spPr`; the points paint that fill, so the
 * legend swatch must match it), then the palette.
 */
export function seriesColor(
	series: PptxChartSeries,
	index: number,
	colorPalette: readonly string[] | undefined,
): string {
	return series.color ?? series.marker?.spPr?.fillColor ?? paletteColor(index, colorPalette);
}

// ─────────────────────────────────────────────────────────────────────────────
// Value range
// ─────────────────────────────────────────────────────────────────────────────

/** Min/max/span of a value axis. */
export interface ValueRange {
	min: number;
	max: number;
	span: number;
	/** When true, the range is log-scaled (min/max are data-space power-of-base bounds, span is in log-space). */
	logScale?: boolean;
	/** Logarithmic base (e.g. 10, 2, Math.E). Only meaningful when logScale is true. */
	logBase?: number;
	/** Whether values increase from top to bottom. */
	reverseOrder?: boolean;
	/**
	 * Step between major gridlines when the bounds came from the automatic
	 * scale. See the same field on `ValueRange` in `chart-helpers.ts`.
	 */
	majorUnit?: number;
}

/**
 * Automatic Y-axis range, on PowerPoint's terms. See `chart-axis-nice.ts`; this
 * mirrors `computeValueRange` in `chart-helpers.ts`.
 */
export function computeValueRange(series: ReadonlyArray<PptxChartSeries>): ValueRange {
	let dataMin = Number.POSITIVE_INFINITY,
		dataMax = Number.NEGATIVE_INFINITY;
	for (const item of series) {
		for (const value of item.values) {
			if (value < dataMin) {
				dataMin = value;
			}
			if (value > dataMax) {
				dataMax = value;
			}
		}
	}
	if (dataMin === Number.POSITIVE_INFINITY) {
		return { min: 0, max: 1, span: 1 };
	}
	const { min, max, majorUnit } = niceValueAxisBounds(dataMin, dataMax);
	return { min, max, span: Math.max(max - min, Number.EPSILON), majorUnit };
}

/**
 * Value range for a stacked bar: the per-category sums, then the same automatic
 * scale as any other value axis.
 */
export function computeStackedValueRange(
	series: ReadonlyArray<PptxChartSeries>,
	catCount: number,
): ValueRange {
	let maxSum = 0,
		minSum = 0;
	for (let ci = 0; ci < catCount; ci++) {
		let pos = 0,
			neg = 0;
		for (const s of series) {
			const v = s.values[ci] ?? 0;
			if (v >= 0) {
				pos += v;
			} else {
				neg += v;
			}
		}
		maxSum = Math.max(maxSum, pos);
		minSum = Math.min(minSum, neg);
	}
	const { min, max, majorUnit } = niceValueAxisBounds(Math.min(minSum, 0), Math.max(maxSum, 0));
	return { min, max, span: Math.max(max - min, Number.EPSILON), majorUnit };
}

/**
 * Map a data value to a Y pixel coordinate (top = max, bottom = min).
 * Routes through logarithmic scaling when `range.logScale` is set (the branch is
 * inlined here, mirroring `valueToYLog` in `chart-axis.ts`, to avoid a circular
 * import). Linear behaviour is unchanged when `logScale`/`logBase` are absent.
 */
export function valueToY(val: number, range: ValueRange, topY: number, bottomY: number): number {
	const usable = bottomY - topY;
	let ratio: number;
	if (range.logScale && range.logBase) {
		const base = range.logBase,
			clampedVal = Math.max(val, range.min),
			logVal = Math.log(clampedVal) / Math.log(base),
			logMin = Math.log(range.min) / Math.log(base);
		ratio = (logVal - logMin) / range.span;
	} else {
		ratio = (val - range.min) / range.span;
	}
	return range.reverseOrder ? topY + ratio * usable : bottomY - ratio * usable;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a numeric axis or data label to a short human-readable string, or
 * through the chart's own `c:numFmt/@formatCode` when it declares one. See
 * `formatAxisValue` in `chart-helpers.ts`, which this mirrors.
 */
export function formatAxisValue(val: number, formatCode?: string): string {
	const formatted = formatChartNumber(val, formatCode);
	if (formatted !== undefined) {
		return formatted;
	}
	if (Math.abs(val) >= 1_000_000) {
		return `${(val / 1_000_000).toFixed(1)}M`;
	}
	if (Math.abs(val) >= 1_000) {
		return `${(val / 1_000).toFixed(1)}K`;
	}
	if (Number.isInteger(val)) {
		return String(val);
	}
	return val.toFixed(1);
}

/**
 * Build the hover-tooltip text for a plain data mark (bar / line / area /
 * scatter / bubble / pie / radar point), projected as each primitive's `title`
 * field (see the doc comment on `SvgPath.title`).
 *
 * Mirrors the region map's own `"<name>: <value>"` tooltip (chart-waterfall-map.ts):
 * join whichever of the series name and category/point label are known, then
 * append the formatted value. Either label may be absent (a scatter/bubble
 * point has no category; an un-named series has no name); the result degrades
 * to just the value when neither is.
 */
export function buildMarkTooltip(
	seriesName: string | undefined,
	categoryLabel: string | undefined,
	value: number,
	numberFormat?: string,
): string {
	const label = [seriesName, categoryLabel]
			.filter((part): part is string => Boolean(part && part.length > 0))
			.join(', '),
		formatted = formatAxisValue(value, numberFormat);
	return label.length > 0 ? `${label}: ${formatted}` : formatted;
}
