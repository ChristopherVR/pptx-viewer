/**
 * chart-interaction-mark-drag.ts: begin/advance state machine for dragging a
 * pie/doughnut slice, radar vertex, or stacked/percentStacked segment.
 *
 * `chart-canvas-drag.ts` already provides this shape of glue
 * (`beginChartValueDrag`/`advanceChartValueDrag`) for clustered
 * bar/line/scatter/bubble marks, whose drag tracks a vertical PIXEL DELTA
 * against `ChartViewModel.valueDrag`. The mark kinds this module covers have
 * no single vertical value axis: a pie slice's value follows an ANGLE, a
 * radar vertex a RADIAL distance, and a stacked segment a cumulative value
 * with a per-drag baseline. All three need the pointer's ABSOLUTE position in
 * the chart's SVG view-box, not a delta, so this is a parallel state machine
 * rather than an extension of the existing one.
 *
 * @module chart-interaction-mark-drag
 */
import type { PptxChartData } from 'pptx-viewer-core';

import { CHART_DRAG_THRESHOLD_PX } from './chart-canvas-drag';
import { resolveChartDragValue, withChartPointValue } from './chart-interaction';
import type { ChartMarkDragGeometry } from './chart-interaction';
import type { ChartPartRef } from './chart-view-model';

/** Structural view of `Element.getBoundingClientRect()`, no DOM lib dependency. */
export interface ChartClientRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

/**
 * Map a client-space pointer position into the chart's SVG view-box units,
 * given the rendered `<svg>`'s bounding rect.
 */
export function clientPointToViewBox(
	clientX: number,
	clientY: number,
	rect: ChartClientRect,
	svgWidth: number,
	svgHeight: number,
): { x: number; y: number } {
	if (rect.width === 0 || rect.height === 0) {
		return { x: 0, y: 0 };
	}
	return {
		x: ((clientX - rect.left) / rect.width) * svgWidth,
		y: ((clientY - rect.top) / rect.height) * svgHeight,
	};
}

/** State of an in-flight mark drag. Owned by the calling binding. */
export interface ChartMarkDragState {
	part: ChartPartRef;
	geometry: ChartMarkDragGeometry;
	svgWidth: number;
	svgHeight: number;
	baseChartData: PptxChartData;
	startClientX: number;
	startClientY: number;
	/** Whether the pointer has passed {@link CHART_DRAG_THRESHOLD_PX}. */
	moved: boolean;
	/** Most recent previewed data, or null while the drag is still a click. */
	lastData: PptxChartData | null;
}

/**
 * Start a mark drag, or return `null` when there is no geometry for this part
 * (not a draggable mark kind, or the press was not on a `dataPoint`).
 */
export function beginChartMarkDrag(params: {
	part: ChartPartRef;
	geometry: ChartMarkDragGeometry | null;
	chartData: PptxChartData;
	svgWidth: number;
	svgHeight: number;
	clientX: number;
	clientY: number;
}): ChartMarkDragState | null {
	const { part, geometry, chartData, svgWidth, svgHeight, clientX, clientY } = params;
	if (!geometry || part.role !== 'dataPoint' || part.pointIndex === undefined) {
		return null;
	}
	return {
		part,
		geometry,
		svgWidth,
		svgHeight,
		baseChartData: chartData,
		startClientX: clientX,
		startClientY: clientY,
		moved: false,
		lastData: null,
	};
}

/** Result of one pointermove during a mark drag. */
export interface ChartMarkDragStep {
	/** The chart data with the dragged point's new value applied. */
	chartData: PptxChartData;
	/** The new value, for the floating mid-drag badge. */
	value: number;
}

/**
 * Advance an in-flight mark drag to the pointer's current client position.
 *
 * Returns `null` (leaving `state` untouched) while the press is still inside
 * the click threshold or `rect` is not measurable. Otherwise MUTATES
 * `state.moved` / `state.lastData` and returns the step, so the caller can
 * preview it and commit `state.lastData` once on release.
 */
export function advanceChartMarkDrag(
	state: ChartMarkDragState,
	clientX: number,
	clientY: number,
	rect: ChartClientRect,
): ChartMarkDragStep | null {
	if (state.part.pointIndex === undefined) {
		return null;
	}
	const travelled = Math.hypot(clientX - state.startClientX, clientY - state.startClientY);
	if (!state.moved && travelled < CHART_DRAG_THRESHOLD_PX) {
		return null;
	}
	if (rect.width === 0 || rect.height === 0) {
		return null;
	}
	state.moved = true;
	const pointer = clientPointToViewBox(clientX, clientY, rect, state.svgWidth, state.svgHeight),
		value = resolveChartDragValue(state.geometry, pointer),
		chartData = withChartPointValue(
			state.baseChartData,
			state.part.seriesIndex,
			state.part.pointIndex,
			value,
		);
	state.lastData = chartData;
	return { chartData, value };
}
