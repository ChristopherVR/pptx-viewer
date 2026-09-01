/**
 * chart-view-model-points.ts: pie / doughnut, scatter, bubble and radar
 * geometry of the chart engine. Split out of `chart-view-model.ts`, which
 * re-exports everything here.
 *
 * @module chart-view-model-points
 */
/* eslint-disable one-var -- this module predates the rule and combining every
   sibling `const`/`let` in a function into one comma-list (oxlint's own
   `--fix` cannot do this safely once a non-declaration statement sits between
   them) would churn geometry code far beyond this change's scope. */

import type { PptxChartData } from 'pptx-viewer-core';

import {
	chartFrameToViewOffset,
	manualLayoutOf,
	resolveManualLayoutRect,
} from './chart-manual-layout';
import { valueToY } from './chart-view-model-scale';
import type { ValueRange } from './chart-view-model-scale';
import type { PlotLayout } from './chart-view-model-types';

// ─────────────────────────────────────────────────────────────────────────────
// Pie / doughnut
// ─────────────────────────────────────────────────────────────────────────────

export interface PieSliceGeometry {
	d: string;
	midAngle: number;
	labelX: number;
	labelY: number;
}

export function computePieSlicePath(
	cx: number,
	cy: number,
	outerR: number,
	innerR: number,
	startAngle: number,
	endAngle: number,
): PieSliceGeometry {
	const largeArc = endAngle - startAngle > Math.PI ? 1 : 0,
		x1 = cx + outerR * Math.cos(startAngle),
		y1 = cy + outerR * Math.sin(startAngle),
		x2 = cx + outerR * Math.cos(endAngle),
		y2 = cy + outerR * Math.sin(endAngle);

	let d: string;
	if (innerR > 0) {
		const ix1 = cx + innerR * Math.cos(startAngle),
			iy1 = cy + innerR * Math.sin(startAngle),
			ix2 = cx + innerR * Math.cos(endAngle),
			iy2 = cy + innerR * Math.sin(endAngle);
		d = `M${x1},${y1} A${outerR},${outerR} 0 ${largeArc} 1 ${x2},${y2} L${ix2},${iy2} A${innerR},${innerR} 0 ${largeArc} 0 ${ix1},${iy1} Z`;
	} else {
		d = `M${cx},${cy} L${x1},${y1} A${outerR},${outerR} 0 ${largeArc} 1 ${x2},${y2} Z`;
	}

	const midAngle = (startAngle + endAngle) / 2,
		labelR = outerR * 0.7,
		labelX = cx + labelR * Math.cos(midAngle),
		labelY = cy + labelR * Math.sin(midAngle);

	return { d, midAngle, labelX, labelY };
}

export function computePieLayout(
	elementWidth: number,
	elementHeight: number,
	chartData: PptxChartData,
	isDoughnut: boolean,
): { cx: number; cy: number; outerR: number; innerR: number; size: number } {
	const size = Math.min(Math.max(elementWidth, 1), Math.max(elementHeight, 1)),
		titleOffset = chartData.style?.hasTitle ? 20 : 0,
		legendOffset = chartData.style?.hasLegend ? 20 : 0;
	let cx = size / 2,
		cy = titleOffset + (size - titleOffset - legendOffset) / 2,
		outerR = Math.max((size - titleOffset - legendOffset) * 0.42, 0);
	// c:plotArea/c:layout/c:manualLayout is measured on the element, while the
	// pie is laid out on a centred `size x size` square: translate the automatic
	// disc out to the element, resolve, and translate the centre back in. The
	// pie fills the smaller side of whatever rectangle the author drew.
	const offset = chartFrameToViewOffset(
			{ width: elementWidth, height: elementHeight },
			{ svgWidth: size, svgHeight: size },
		),
		manual = resolveManualLayoutRect(
			manualLayoutOf(chartData, 'plotArea'),
			{ width: elementWidth, height: elementHeight },
			{
				x: offset.x + cx - outerR,
				y: offset.y + cy - outerR,
				width: 2 * outerR,
				height: 2 * outerR,
			},
		);
	if (manual) {
		cx = manual.x + manual.width / 2 - offset.x;
		cy = manual.y + manual.height / 2 - offset.y;
		outerR = Math.min(manual.width, manual.height) / 2;
	}
	// Honour c:holeSize (10-90% of the outer diameter) when parsed; otherwise
	// keep the legacy 0.55 ratio byte-for-byte.
	const holeRatio =
			isDoughnut && chartData.doughnutHoleSize !== undefined
				? Math.min(Math.max(chartData.doughnutHoleSize, 10), 90) / 100
				: 0.55,
		innerR = isDoughnut ? outerR * holeRatio : 0;
	return { cx, cy, outerR, innerR, size };
}

/** Options for {@link computePieSlices}: start-angle rotation and per-slice explosion. */
export interface PieSliceOptions {
	/** Absolute start angle (radians). Defaults to -PI/2 (12 o'clock). */
	startAngle?: number;
	/** Per-slice pull-out distance as a percentage of the outer radius (0-100). */
	explosions?: ReadonlyArray<number>;
}

export function computePieSlices(
	values: ReadonlyArray<number>,
	cx: number,
	cy: number,
	outerR: number,
	innerR: number,
	options?: PieSliceOptions,
): PieSliceGeometry[] {
	const total = values.reduce((s, v) => s + Math.abs(v), 0) || 1;
	let cumAngle = options?.startAngle ?? -Math.PI / 2;
	return values.map((val, i) => {
		const sliceAngle = (Math.abs(val) / total) * Math.PI * 2,
			startAngle = cumAngle;
		cumAngle += sliceAngle;
		// A c:explosion pulls the slice outward along its bisector.
		const explosion = options?.explosions?.[i] ?? 0;
		if (explosion > 0) {
			const mid = (startAngle + cumAngle) / 2,
				offset = outerR * (explosion / 100);
			return computePieSlicePath(
				cx + Math.cos(mid) * offset,
				cy + Math.sin(mid) * offset,
				outerR,
				innerR,
				startAngle,
				cumAngle,
			);
		}
		return computePieSlicePath(cx, cy, outerR, innerR, startAngle, cumAngle);
	});
}

// ─────────────────────────────────────────────────────────────────────────────
// Scatter
// ─────────────────────────────────────────────────────────────────────────────

export interface ScatterDot {
	cx: number;
	cy: number;
}

/**
 * The x extent a scatter / bubble plot is drawn against.
 *
 * Every `CT_ScatterSer` / `CT_BubbleSer` carries its own `c:xVal`, so the
 * domain has to be computed ACROSS series before any of them is projected;
 * letting each series derive its own min/span would stretch every series to
 * fill the plot and destroy the relationship between them.
 */
export interface ScatterXDomain {
	min: number;
	span: number;
}

/**
 * Union x domain of several series' x values. Returns `undefined` when no
 * series declares a finite x value, in which case callers fall back to
 * positioning points by index.
 */
export function computeScatterXDomain(
	seriesXValues: ReadonlyArray<ReadonlyArray<number> | undefined>,
): ScatterXDomain | undefined {
	const finite: number[] = [];
	for (const values of seriesXValues) {
		for (const value of values ?? []) {
			if (Number.isFinite(value)) {
				finite.push(value);
			}
		}
	}
	if (finite.length === 0) {
		return undefined;
	}
	const min = Math.min(...finite);
	return { min, span: Math.max(Math.max(...finite) - min, 1) };
}

export function computeScatterDots(
	values: ReadonlyArray<number>,
	maxXIndex: number,
	layout: PlotLayout,
	range: ValueRange,
	xValues?: ReadonlyArray<number>,
	xDomain?: ScatterXDomain,
): ScatterDot[] {
	const finiteX = xValues?.slice(0, values.length).filter(Number.isFinite),
		minX = xDomain ? xDomain.min : finiteX?.length ? Math.min(...finiteX) : 0,
		spanX = xDomain
			? xDomain.span
			: finiteX?.length
				? Math.max(Math.max(...finiteX) - minX, 1)
				: maxXIndex;
	return values.map((val, i) => ({
		cx:
			layout.plotLeft +
			(spanX > 0 ? (Number.isFinite(xValues?.[i]) ? xValues![i] - minX : i) / spanX : 0) *
				layout.plotWidth,
		cy: valueToY(val, range, layout.plotTop, layout.plotBottom),
	}));
}

// ─────────────────────────────────────────────────────────────────────────────
// Bubble
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Radius of a bubble given its size value, the max size in the chart, and a
 * median radius derived from the plot area. Mirrors `renderBubbleChart` in
 * React's chart-scatter-bubble.tsx: when no size value is present the bubble
 * uses the median radius; otherwise it scales from 0.5x to 2x the median.
 */
export function computeBubbleRadius(
	sizeVal: number | undefined,
	maxBubble: number,
	medianRadius: number,
): number {
	if (sizeVal === undefined) {
		return medianRadius;
	}
	const denom = maxBubble > 0 ? maxBubble : 1;
	return medianRadius * 0.5 + (Math.abs(sizeVal) / denom) * medianRadius * 1.5;
}

// ─────────────────────────────────────────────────────────────────────────────
// Radar
// ─────────────────────────────────────────────────────────────────────────────

/** Angle (radians) of the i-th radar spoke; 0 points up (-90°), clockwise. */
export function radarAngle(index: number, catCount: number): number {
	const n = Math.max(catCount, 1);
	return (Math.PI * 2 * index) / n - Math.PI / 2;
}

export interface RadarPoint {
	x: number;
	y: number;
}

/** Project a series' values onto radar (polar) coordinates around (cx, cy). */
export function computeRadarPoints(
	values: ReadonlyArray<number>,
	maxVal: number,
	radius: number,
	cx: number,
	cy: number,
	catCount: number,
): RadarPoint[] {
	const denom = maxVal > 0 ? maxVal : 1;
	return values.slice(0, Math.max(catCount, 1)).map((val, i) => {
		const angle = radarAngle(i, catCount),
			r = (Math.abs(val) / denom) * radius;
		return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
	});
}

/** Points string for a radar gridline ring at radius `rr`. */
export function radarRingPoints(cx: number, cy: number, rr: number, catCount: number): string {
	const n = Math.max(catCount, 1);
	return Array.from({ length: n }, (_, i) => {
		const angle = radarAngle(i, n);
		return `${(cx + rr * Math.cos(angle)).toFixed(2)},${(cy + rr * Math.sin(angle)).toFixed(2)}`;
	}).join(' ');
}
