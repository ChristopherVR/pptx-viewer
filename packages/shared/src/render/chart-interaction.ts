/**
 * chart-interaction.ts: framework-agnostic support for direct on-canvas chart
 * editing.
 *
 * The chart view-model engine tags data-mark primitives (bars, dots, slices,
 * series lines) with a `ChartPartRef`. This module is the other half of that
 * contract: it converts part refs to/from DOM `data-*` attributes so bindings
 * can hit-test via event delegation, inverts the value-axis projection so a
 * vertical drag maps back to a data value, and applies the resulting edits to
 * `PptxChartData` immutably so they flow through each binding's normal
 * update/history pipeline.
 *
 * Used by the React / Vue / Angular chart renderers in edit mode; rendering
 * stays untouched when a chart is not editable.
 *
 * @module chart-interaction
 */
import type { PptxChartData } from 'pptx-viewer-core';

import type { ChartPartRef, ChartValueDrag, ValueRange } from './chart-view-model';
import { valueToY } from './chart-view-model';

// ─────────────────────────────────────────────────────────────────────────────
// DOM data-attribute bridge
// ─────────────────────────────────────────────────────────────────────────────

/** Attribute carrying the part role ('dataPoint' | 'series' | 'title'). */
export const CHART_PART_ATTR = 'data-chart-part';
/** Attribute carrying the series index of a tagged mark. */
export const CHART_PART_SERIES_ATTR = 'data-chart-series';
/** Attribute carrying the point/category index of a tagged mark. */
export const CHART_PART_POINT_ATTR = 'data-chart-point';

/** Attribute record for a tagged mark, spreadable onto an SVG node. */
export function chartPartToAttrs(part: ChartPartRef): Record<string, string> {
	const attrs: Record<string, string> = {
		[CHART_PART_ATTR]: part.role,
		[CHART_PART_SERIES_ATTR]: String(part.seriesIndex),
	};
	if (part.pointIndex !== undefined) {
		attrs[CHART_PART_POINT_ATTR] = String(part.pointIndex);
	}
	return attrs;
}

/** Minimal structural view of a DOM element for hit-testing (no DOM lib dependency). */
export interface ChartPartElement {
	getAttribute(qualifiedName: string): string | null;
	closest(selectors: string): ChartPartElement | null;
}

/** Recover a `ChartPartRef` from a tagged element's attributes. */
export function chartPartFromElement(el: ChartPartElement | null): ChartPartRef | null {
	if (!el) {
		return null;
	}
	const role = el.getAttribute(CHART_PART_ATTR);
	if (role !== 'dataPoint' && role !== 'series') {
		return null;
	}
	const seriesIndex = Number.parseInt(el.getAttribute(CHART_PART_SERIES_ATTR) ?? '', 10);
	if (!Number.isInteger(seriesIndex) || seriesIndex < 0) {
		return null;
	}
	const pointRaw = el.getAttribute(CHART_PART_POINT_ATTR);
	if (pointRaw === null) {
		return { role, seriesIndex };
	}
	const pointIndex = Number.parseInt(pointRaw, 10);
	if (!Number.isInteger(pointIndex) || pointIndex < 0) {
		return { role, seriesIndex };
	}
	return { role, seriesIndex, pointIndex };
}

/**
 * Resolve the chart part under an event target by walking up to the nearest
 * tagged ancestor. Accepts the raw `event.target` (unknown) and returns null
 * for anything that is not an element inside a tagged mark.
 */
export function findChartPartTarget(target: unknown): ChartPartRef | null {
	if (!target || typeof target !== 'object') {
		return null;
	}
	const el = target as Partial<ChartPartElement>;
	if (typeof el.closest !== 'function' || typeof el.getAttribute !== 'function') {
		return null;
	}
	return chartPartFromElement((el as ChartPartElement).closest(`[${CHART_PART_ATTR}]`));
}

/** Structural equality for (possibly null) part refs. */
export function isSameChartPart(a: ChartPartRef | null, b: ChartPartRef | null): boolean {
	if (!a || !b) {
		return a === b;
	}
	return a.role === b.role && a.seriesIndex === b.seriesIndex && a.pointIndex === b.pointIndex;
}

// ─────────────────────────────────────────────────────────────────────────────
// Drag-to-value math
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inverse of `valueToY`: map a Y coordinate (view-box units) back to a data
 * value. Mirrors the linear and logarithmic branches of the forward mapping.
 */
export function valueFromY(y: number, range: ValueRange, topY: number, bottomY: number): number {
	const usable = bottomY - topY;
	if (usable === 0) {
		return range.min;
	}
	const ratio = range.reverseOrder ? (y - topY) / usable : (bottomY - y) / usable;
	if (range.logScale && range.logBase) {
		const base = range.logBase;
		const logMin = Math.log(range.min) / Math.log(base);
		const logVal = logMin + ratio * range.span;
		return base ** logVal;
	}
	return range.min + ratio * range.span;
}

/**
 * Round a dragged value to a step two orders of magnitude below the axis span,
 * so drags produce human-scale numbers (span 0..500 snaps to whole units,
 * 0..5 to 0.05) instead of 14-decimal floats.
 */
export function roundDragValue(value: number, range: ValueRange): number {
	if (!Number.isFinite(value) || range.span <= 0) {
		return value;
	}
	const step = 10 ** (Math.floor(Math.log10(range.span)) - 2);
	const rounded = Math.round(value / step) * step;
	// Snap away float noise from the multiplication (e.g. 0.30000000000000004).
	return Number.parseFloat(rounded.toPrecision(12));
}

/** The value range a series maps against (secondary when axis-mapped there). */
function rangeForSeries(drag: ChartValueDrag, seriesIndex: number): ValueRange {
	const useSecondary =
		drag.secondaryRange !== undefined &&
		(drag.secondarySeriesIndexes?.includes(seriesIndex) ?? false);
	return useSecondary && drag.secondaryRange ? drag.secondaryRange : drag.range;
}

/**
 * Value for a dragged data point at `viewY` (view-box units), using the
 * secondary range when the part's series is mapped to the secondary axis.
 */
export function dragValueForPart(viewY: number, drag: ChartValueDrag, seriesIndex: number): number {
	const range = rangeForSeries(drag, seriesIndex);
	return roundDragValue(valueFromY(viewY, range, drag.plotTop, drag.plotBottom), range);
}

/**
 * Y coordinate (view-box units) where a data point's value currently sits.
 * Drags anchor here so the value tracks the pointer's MOVEMENT rather than
 * jumping to the pointer's absolute position when the user grabs the middle
 * of a bar.
 */
export function dragAnchorViewY(value: number, drag: ChartValueDrag, seriesIndex: number): number {
	return valueToY(value, rangeForSeries(drag, seriesIndex), drag.plotTop, drag.plotBottom);
}

// ─────────────────────────────────────────────────────────────────────────────
// Immutable chart-data edits
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return a copy of `chartData` with one point's value replaced. Returns the
 * input unchanged when the series or point index is out of range.
 */
export function withChartPointValue(
	chartData: PptxChartData,
	seriesIndex: number,
	pointIndex: number,
	value: number,
): PptxChartData {
	const series = chartData.series[seriesIndex];
	if (!series || pointIndex < 0 || pointIndex >= series.values.length) {
		return chartData;
	}
	return {
		...chartData,
		series: chartData.series.map((s, i) =>
			i === seriesIndex
				? { ...s, values: s.values.map((v, j) => (j === pointIndex ? value : v)) }
				: s,
		),
	};
}

/**
 * Return a copy of `chartData` with the title replaced. A non-empty title
 * turns the title on; an empty one turns it off (matching PowerPoint, where
 * clearing the title hides it).
 */
export function withChartTitle(chartData: PptxChartData, title: string): PptxChartData {
	const trimmed = title.trim();
	return {
		...chartData,
		title: trimmed,
		style: { ...chartData.style, hasTitle: trimmed.length > 0 },
	};
}
