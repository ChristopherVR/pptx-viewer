/**
 * chart-canvas-drag.ts: the framework-neutral half of direct on-canvas chart
 * editing - the value-drag state machine, the hit-target stylesheet, and the
 * selected-part highlight.
 *
 * Every binding's chart projector already emits the `data-chart-*` hit-testing
 * attributes (`chartPartToAttrs`), and the shared view model already carries
 * the inversion data (`ChartViewModel.valueDrag`). What was missing outside
 * React / Vue / Angular was the small amount of glue between a pointer and a
 * new `PptxChartData`, which those three had each written for themselves. It is
 * pure DOM plus arithmetic - no framework touches it - so it lives here and the
 * bindings keep only their own reactive plumbing.
 *
 * The drag is deliberately modelled as an immutable-ish record the caller owns:
 * a binding stores the state wherever its framework prefers (a `let`, a ref, a
 * signal) and calls {@link advanceChartValueDrag} per pointermove. Nothing here
 * subscribes to events, so it is equally usable from an effect, a composable, a
 * Svelte action or a plain DOM listener.
 *
 * @module chart-canvas-drag
 */
import type { PptxChartData } from 'pptx-viewer-core';

import { dragAnchorViewY, dragValueForPart, withChartPointValue } from './chart-interaction';
import type { ChartPartRef, ChartValueDrag, ChartViewModel } from './chart-view-model';

/**
 * Minimum pointer travel (px) before a mark press becomes a value drag.
 *
 * Without a threshold every click on a bar would commit a (tiny) value change,
 * so a user could not select a mark without editing it.
 */
export const CHART_DRAG_THRESHOLD_PX = 3;

const STYLE_ELEMENT_ID = 'pptx-chart-interaction-styles';
const INTERACTION_CSS = `
.pptx-chart-interactive svg [data-chart-part] { pointer-events: auto; cursor: pointer; }
.pptx-chart-interactive svg [data-chart-part]:hover { filter: brightness(1.12); }
.pptx-chart-interactive svg [data-chart-part='title'] { cursor: text; }
.pptx-chart-interactive svg .pptx-chart-part-selected { filter: drop-shadow(0 0 2.5px #3b82f6); }
.pptx-chart-interactive svg .pptx-chart-part-selected:hover { filter: drop-shadow(0 0 2.5px #3b82f6) brightness(1.12); }
`;

/**
 * Inject the (singleton) interaction stylesheet for chart part hit targets.
 *
 * The projectors emit the hit-target attributes unconditionally, but the marks
 * stay pointer-transparent until a root carries `pptx-chart-interactive`, so
 * charts on thumbnails and export surfaces cannot be grabbed.
 */
export function ensureChartInteractionStyles(): void {
	if (typeof document === 'undefined' || document.getElementById(STYLE_ELEMENT_ID)) {
		return;
	}
	const style = document.createElement('style');
	style.id = STYLE_ELEMENT_ID;
	style.textContent = INTERACTION_CSS;
	document.head.appendChild(style);
}

/** Class a chart root carries while its marks are grabbable. */
export const CHART_INTERACTIVE_CLASS = 'pptx-chart-interactive';

/** Class marking the currently selected mark. */
export const CHART_PART_SELECTED_CLASS = 'pptx-chart-part-selected';

/**
 * Re-apply the selected-part highlight class inside `root`.
 *
 * Called after every render: the projectors re-create the SVG marks on each
 * chart change, which drops DOM-only classes. A null `part` only clears.
 */
export function applyChartPartHighlight(root: Element | null, part: ChartPartRef | null): void {
	if (!root) {
		return;
	}
	for (const node of root.querySelectorAll(`.${CHART_PART_SELECTED_CLASS}`)) {
		node.classList.remove(CHART_PART_SELECTED_CLASS);
	}
	if (!part) {
		return;
	}
	const pointSelector =
		part.pointIndex !== undefined
			? `[data-chart-point='${part.pointIndex}']`
			: ':not([data-chart-point])';
	const selector = `[data-chart-part='${part.role}'][data-chart-series='${part.seriesIndex}']${pointSelector}`;
	for (const node of root.querySelectorAll(selector)) {
		node.classList.add(CHART_PART_SELECTED_CLASS);
	}
}

/** State of an in-flight data-point value drag. Owned by the calling binding. */
export interface ChartValueDragState {
	part: ChartPartRef;
	drag: ChartValueDrag;
	svgHeight: number;
	startClientY: number;
	/** View-box Y of the point's value at drag start; the drag tracks deltas from here. */
	anchorViewY: number;
	baseChartData: PptxChartData;
	/** Whether the pointer has passed {@link CHART_DRAG_THRESHOLD_PX}. */
	moved: boolean;
	/** Most recent previewed data, or null while the drag is still a click. */
	lastData: PptxChartData | null;
}

/**
 * Start a value drag on a data-point mark, or return `null` when the press is
 * not on something draggable (a legend swatch, a series line, an axis, or a
 * chart kind whose marks have no single-value meaning - stacked bars sit on
 * running sums, so dragging one would not track the pointer).
 *
 * The view model MUST be built from the COMMITTED chart data, not from a
 * preview, or the axis rescales under the pointer mid-drag and the mark runs
 * away from the cursor.
 */
export function beginChartValueDrag(params: {
	part: ChartPartRef;
	viewModel: ChartViewModel;
	chartData: PptxChartData;
	clientY: number;
}): ChartValueDragState | null {
	const { part, viewModel, chartData, clientY } = params;
	if (part.role !== 'dataPoint' || part.pointIndex === undefined || !viewModel.valueDrag) {
		return null;
	}
	const startValue = chartData.series[part.seriesIndex]?.values[part.pointIndex] ?? 0;
	return {
		part,
		drag: viewModel.valueDrag,
		svgHeight: viewModel.svgHeight,
		startClientY: clientY,
		anchorViewY: dragAnchorViewY(startValue, viewModel.valueDrag, part.seriesIndex),
		baseChartData: chartData,
		moved: false,
		lastData: null,
	};
}

/** Result of one pointermove during a value drag. */
export interface ChartValueDragStep {
	/** The chart data with the dragged point's new value applied. */
	chartData: PptxChartData;
	/** The new value, for the floating mid-drag badge. */
	value: number;
}

/**
 * Advance an in-flight drag to the pointer's current Y.
 *
 * Returns `null` (leaving `state` untouched) while the press is still inside
 * the click threshold or the SVG has no measurable height. Otherwise MUTATES
 * `state.moved` / `state.lastData` and returns the step, so the caller can
 * preview it and commit `state.lastData` once on release.
 *
 * `svgHeight` is the rendered pixel height of the chart's `<svg>`; the drag is
 * scaled by it because the view model is in view-box units and the element is
 * itself inside the slide's zoom transform.
 */
export function advanceChartValueDrag(
	state: ChartValueDragState,
	clientY: number,
	svgHeight: number,
): ChartValueDragStep | null {
	if (!state.moved && Math.abs(clientY - state.startClientY) < CHART_DRAG_THRESHOLD_PX) {
		return null;
	}
	if (svgHeight === 0 || state.part.pointIndex === undefined) {
		return null;
	}
	state.moved = true;
	const deltaViewY = ((clientY - state.startClientY) / svgHeight) * state.svgHeight;
	const value = dragValueForPart(
		state.anchorViewY + deltaViewY,
		state.drag,
		state.part.seriesIndex,
	);
	const chartData = withChartPointValue(
		state.baseChartData,
		state.part.seriesIndex,
		state.part.pointIndex,
		value,
	);
	state.lastData = chartData;
	return { chartData, value };
}
