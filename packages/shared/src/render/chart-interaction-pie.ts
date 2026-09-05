/**
 * chart-interaction-pie.ts: drag-to-value math for a pie / doughnut slice.
 *
 * A pie slice has no vertical value axis to invert (chart-canvas-drag.ts's
 * `ChartValueDrag` model does not apply), so dragging instead follows the
 * ANGLE under the pointer: grabbing a slice's trailing edge and sweeping it
 * changes that point's share of the whole, and every other slice renormalises
 * automatically because a slice's angle is its value's share of the series
 * total. `buildPieDragGeometry` reuses `computePieLayout` (the exact function
 * `buildPieViewModel` lays the disc out with) so the centre/radius can never
 * drift from what is actually on screen.
 *
 * @module chart-interaction-pie
 */
import type { PptxChartData } from 'pptx-viewer-core';

import { roundDragValue, shareToValue } from './chart-interaction';
import { computePieLayout } from './chart-view-model';
import type { ValueRange } from './chart-view-model';

const TWO_PI = Math.PI * 2;
/** Keep the dragged span strictly inside (0, 2*PI) so the share never hits 0 or 1. */
const ANGLE_EPSILON = TWO_PI * 0.001;

/** Geometry a pie/doughnut slice drag needs, resolved once at drag start. */
export interface PieDragGeometry {
	cx: number;
	cy: number;
	/** Series 0's current values (a pie/doughnut chart plots a single series). */
	values: readonly number[];
	pointIndex: number;
	/** Absolute angle (radians) of the first slice's leading edge. */
	startAngle: number;
}

/**
 * Resolve the drag geometry for series 0's slice at `pointIndex`, or `null`
 * when `chartData` is not a pie/doughnut, has no series, or the index is out
 * of range. `element` is the chart's frame box (EMU-agnostic width/height, the
 * same units `PptxElement.width/height` and `computePieLayout` use).
 */
export function buildPieDragGeometry(
	element: { width: number; height: number },
	chartData: PptxChartData,
	pointIndex: number,
): PieDragGeometry | null {
	if (chartData.chartType !== 'pie' && chartData.chartType !== 'doughnut') {
		return null;
	}
	const series = chartData.series[0];
	if (!series || pointIndex < 0 || pointIndex >= series.values.length) {
		return null;
	}
	const isDoughnut = chartData.chartType === 'doughnut',
		{ cx, cy } = computePieLayout(element.width, element.height, chartData, isDoughnut),
		// Mirrors buildPieViewModel's own startAngle line exactly (chart-view-model-pie.ts).
		startAngle = -Math.PI / 2 + ((chartData.firstSliceAngle ?? 0) * Math.PI) / 180;
	return { cx, cy, values: series.values, pointIndex, startAngle };
}

/**
 * New value for the dragged slice given the pointer's (view-box) position.
 * The slice's leading edge stays put; the span from there to the pointer's
 * angle becomes the slice's new share of the series total, and
 * {@link shareToValue} converts that share back to an absolute value holding
 * every other (unchanged) slice's value fixed.
 */
export function resolvePieDragValue(
	geometry: PieDragGeometry,
	pointerX: number,
	pointerY: number,
): number {
	const { cx, cy, values, pointIndex, startAngle } = geometry,
		total = values.reduce((sum, v) => sum + Math.abs(v), 0) || 1,
		before = values.slice(0, pointIndex).reduce((sum, v) => sum + Math.abs(v), 0),
		leadingAngle = startAngle + (before / total) * TWO_PI,
		pointerAngle = Math.atan2(pointerY - cy, pointerX - cx),
		rawSpan = ((pointerAngle - leadingAngle) % TWO_PI) + TWO_PI,
		span = Math.min(Math.max(rawSpan % TWO_PI, ANGLE_EPSILON), TWO_PI - ANGLE_EPSILON),
		share = span / TWO_PI,
		own = values[pointIndex] ?? 0,
		sign = own < 0 ? -1 : 1,
		others = total - Math.abs(own),
		absValue = shareToValue(share, others),
		range: ValueRange = {
			min: 0,
			max: Math.max(total, absValue, 1),
			span: Math.max(total, absValue, 1),
		};
	return roundDragValue(sign * absValue, range);
}
