/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file:
   independent aliased re-exports, not one statement */
import {
	advanceChartValueDrag as advanceSharedChartValueDrag,
	applyChartPartHighlight as applySharedChartPartHighlight,
	beginChartValueDrag as beginSharedChartValueDrag,
	CHART_DRAG_THRESHOLD_PX,
	ensureChartInteractionStyles,
} from 'pptx-viewer-shared';
import type { ChartValueDragState } from 'pptx-viewer-shared';

/**
 * chart-canvas-interaction-support: Vue's names for the framework-neutral
 * on-canvas chart editing support, which now lives in
 * `pptx-viewer-shared/render/chart-canvas-drag`.
 *
 * The stylesheet, the highlight applier and the in-flight drag record are pure
 * DOM plus arithmetic, so keeping a Vue-local copy of them meant Svelte and
 * Vanilla had to grow their own before their charts could be dragged at all.
 * This module is now a thin alias so the Vue composable keeps its existing
 * imports and there is exactly one implementation.
 */

/** Minimum pointer travel (px) before a mark press becomes a value drag. */
export const DRAG_THRESHOLD_PX = CHART_DRAG_THRESHOLD_PX;

/** Inject the (singleton) interaction stylesheet for chart part hit targets. */
export const ensureInteractionStyles = ensureChartInteractionStyles;

/** Re-apply the selected-part highlight class inside `root`. */
export const applyChartPartHighlight = applySharedChartPartHighlight;

/** Start a value drag on a data-point mark, or null when the press is not draggable. */
export const beginChartValueDrag = beginSharedChartValueDrag;

/** Advance an in-flight drag to the pointer's current Y. */
export const advanceChartValueDrag = advanceSharedChartValueDrag;

/** State of an in-flight data-point value drag. */
export type ActiveValueDrag = ChartValueDragState;
