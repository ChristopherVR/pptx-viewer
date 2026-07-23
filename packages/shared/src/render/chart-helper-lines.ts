/**
 * chart-helper-lines.ts: shared drop-line / hi-low-line / up-down-bar primitives.
 *
 * OOXML line and stock charts may declare `c:dropLines`, `c:hiLowLines`, and
 * `c:upDownBars` on the chart-type container. Historically these rendered only
 * in the React chart chrome (drop/hi-low), and up-down bars nowhere, so the
 * framework-agnostic view-model (Vue / Angular / Vanilla / Svelte) never drew
 * them. These pure builders project each into `SvgPrimitive[]` so every binding
 * renders them from a single source.
 *
 *   dropLines   - a vertical line from each data point down to the axis baseline.
 *   hiLowLines  - a vertical line spanning the highest and lowest series value
 *                 in each category (requires >= 2 series).
 *   upDownBars  - a bar between the first and last series value in each category,
 *                 coloured by whether the last value rose or fell (>= 2 series).
 *
 * @module chart-helper-lines
 */

import type { PptxChartData } from 'pptx-viewer-core';

import type { PlotLayout, SvgLine, SvgRect, ValueRange } from './chart-view-model';
import { valueToY } from './chart-view-model';

/** Placement context shared by the helper-line builders. */
export interface HelperLineOptions {
	/** `'bar'` centres on category slots; `'line'` anchors at data points. */
	mode: 'line' | 'bar';
	/** Pre-computed per-category X positions (from the horizontal-axis builder). */
	xPositions?: ReadonlyArray<number>;
}

/** X pixel for a category index, preferring an explicit x-position. */
function categoryX(
	index: number,
	catCount: number,
	layout: PlotLayout,
	options: HelperLineOptions,
): number {
	const explicit = options.xPositions?.[index];
	if (explicit !== undefined) {
		return explicit;
	}
	if (options.mode === 'bar') {
		const slot = layout.plotWidth / Math.max(catCount, 1);
		return layout.plotLeft + slot * index + slot / 2;
	}
	const maxIdx = Math.max(catCount - 1, 1);
	return layout.plotLeft + (index / maxIdx) * layout.plotWidth;
}

/** SVG dash pattern for a helper-line dash style, if any. */
function dashFor(dashStyle: string | undefined): string | undefined {
	if (!dashStyle || dashStyle === 'solid') {
		return undefined;
	}
	return dashStyle === 'dot' || dashStyle === 'sysDot' ? '1 2' : '4 3';
}

/**
 * Drop lines: a vertical line from every data point down to the value-axis
 * baseline (`range.min`). Returns `[]` when `c:dropLines` is absent.
 */
export function computeDropLinePrimitives(
	chartData: PptxChartData,
	layout: PlotLayout,
	range: ValueRange,
	catCount: number,
	options: HelperLineOptions,
): SvgLine[] {
	const style = chartData.dropLines;
	if (!style) {
		return [];
	}
	const baselineY = valueToY(range.min, range, layout.plotTop, layout.plotBottom);
	const dashArray = dashFor(style.dashStyle);
	const out: SvgLine[] = [];
	for (const series of chartData.series) {
		series.values.forEach((val, vi) => {
			const x = categoryX(vi, catCount, layout, options);
			out.push({
				kind: 'line',
				x1: x,
				y1: valueToY(val, range, layout.plotTop, layout.plotBottom),
				x2: x,
				y2: baselineY,
				stroke: style.color ?? '#94a3b8',
				strokeWidth: style.width ?? 0.8,
				dashArray,
			});
		});
	}
	return out;
}

/**
 * Hi-low lines: a vertical line joining the highest and lowest series value in
 * each category. Returns `[]` when `c:hiLowLines` is absent or fewer than two
 * series are present.
 */
export function computeHiLowLinePrimitives(
	chartData: PptxChartData,
	layout: PlotLayout,
	range: ValueRange,
	catCount: number,
	options: HelperLineOptions,
): SvgLine[] {
	const style = chartData.hiLowLines;
	if (!style || chartData.series.length < 2) {
		return [];
	}
	const dashArray = dashFor(style.dashStyle);
	const out: SvgLine[] = [];
	for (let vi = 0; vi < catCount; vi++) {
		let high = Number.NEGATIVE_INFINITY;
		let low = Number.POSITIVE_INFINITY;
		for (const series of chartData.series) {
			const v = series.values[vi];
			if (v !== undefined) {
				high = Math.max(high, v);
				low = Math.min(low, v);
			}
		}
		if (!Number.isFinite(high) || !Number.isFinite(low)) {
			continue;
		}
		const x = categoryX(vi, catCount, layout, options);
		out.push({
			kind: 'line',
			x1: x,
			y1: valueToY(high, range, layout.plotTop, layout.plotBottom),
			x2: x,
			y2: valueToY(low, range, layout.plotTop, layout.plotBottom),
			stroke: style.color ?? '#334155',
			strokeWidth: style.width ?? 1,
			dashArray,
		});
	}
	return out;
}

/**
 * Up-down bars: a bar between the first and last series value in each category.
 * Rising categories (last >= first) use the `upBars` fill, falling ones the
 * `downBars` fill. Returns `[]` when `c:upDownBars` is absent or fewer than two
 * series are present.
 */
export function computeUpDownBarPrimitives(
	chartData: PptxChartData,
	layout: PlotLayout,
	range: ValueRange,
	catCount: number,
	options: HelperLineOptions,
): SvgRect[] {
	const bars = chartData.upDownBars;
	if (!bars || chartData.series.length < 2) {
		return [];
	}
	const first = chartData.series[0];
	const last = chartData.series[chartData.series.length - 1];
	const slot = layout.plotWidth / Math.max(catCount, 1);
	const gapWidth = bars.gapWidth ?? 150;
	const barW = Math.max(slot / (1 + Math.max(gapWidth, 0) / 100), 1);
	const upFill = bars.upBars?.fillColor ?? '#e2e8f0';
	const downFill = bars.downBars?.fillColor ?? '#334155';
	const out: SvgRect[] = [];
	for (let vi = 0; vi < catCount; vi++) {
		const firstVal = first.values[vi];
		const lastVal = last.values[vi];
		if (firstVal === undefined || lastVal === undefined) {
			continue;
		}
		const firstY = valueToY(firstVal, range, layout.plotTop, layout.plotBottom);
		const lastY = valueToY(lastVal, range, layout.plotTop, layout.plotBottom);
		const x = categoryX(vi, catCount, layout, options) - barW / 2;
		out.push({
			kind: 'rect',
			x,
			y: Math.min(firstY, lastY),
			w: barW,
			h: Math.max(Math.abs(firstY - lastY), 1),
			fill: lastVal >= firstVal ? upFill : downFill,
		});
	}
	return out;
}

/**
 * Convenience: all three helper-line families for a chart, concatenated.
 * Drawn under the series marks by the caller (they push the data marks first).
 */
export function computeHelperLinePrimitives(
	chartData: PptxChartData,
	layout: PlotLayout,
	range: ValueRange,
	catCount: number,
	options: HelperLineOptions,
): Array<SvgLine | SvgRect> {
	return [
		...computeUpDownBarPrimitives(chartData, layout, range, catCount, options),
		...computeDropLinePrimitives(chartData, layout, range, catCount, options),
		...computeHiLowLinePrimitives(chartData, layout, range, catCount, options),
	];
}
