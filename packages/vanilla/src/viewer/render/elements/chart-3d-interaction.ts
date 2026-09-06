import type { ChartPptxElement, PptxElement } from 'pptx-viewer-core';
import type { ChartPartRef } from 'pptx-viewer-shared';
import { canDrillDown, withChartPointValue } from 'pptx-viewer-shared';

import type { ElementRenderContext } from '../types';

/**
 * Click-to-select interaction hooks shared by every interactive 3D chart
 * scene (bar3D/line3D/area3D/pie3D/surface3D).
 */
export interface Chart3DSelectInteraction {
	onSelect?: (part: ChartPartRef | null) => void;
}

/**
 * Click-to-select + drag-to-value interaction hooks for every interactive 3D
 * chart kind that commits a `(part, value)` pair (bar3D/line3D/area3D/pie3D;
 * surface3D's vertex drag goes through its own hooks instead, see
 * `surface-chart-3d.ts`). Structurally identical to shared's
 * `BarChart3DInteraction`, `CartesianChart3DInteraction`, AND
 * `PieChart3DInteraction`, so one object literal satisfies all three.
 */
export interface Chart3DValueDragInteraction extends Chart3DSelectInteraction {
	onValueDragCommit?: (part: ChartPartRef, value: number) => void;
}

/**
 * Bridge between a mounted 3D chart scene's own click/drag pointer machinery
 * (`pptx-viewer-shared`'s `chart-3d-pointer-interaction`) and the SAME
 * `context.onChartPartSelect` / `context.onChartPointChange` commit path the
 * flat 2D chart's `chart-editable.ts` already threads through, so the chart
 * inspector (`chart-point-index.ts`) reacts to a 3D mark exactly like a 2D
 * one, and a dragged 3D value is one undo step like a dragged 2D value.
 *
 * @module chart-3d-interaction
 */

/**
 * Gate + narrow: only chart elements, on the interactive (authoring) canvas,
 * with editing wired up and drilldown not locked by `noDrilldown`, get
 * interaction hooks. Mirrors `chart-editable.ts`'s `attachChartEditing` gate
 * exactly, so a 3D chart is selectable/draggable in precisely the same
 * circumstances its flat SVG counterpart is.
 */
function chart3DEditingGate(
	element: PptxElement,
	context: ElementRenderContext,
): ChartPptxElement | null {
	if (
		element.type !== 'chart' ||
		!context.interactive ||
		!context.onChartPointChange ||
		!canDrillDown(element)
	) {
		return null;
	}
	return element;
}

/**
 * A mark press reports the part through `context.onChartPartSelect`, exactly
 * like `chart-editable.ts`'s pointerdown handler. Empty-space clicks (which
 * the shared 3D pointer machinery reports as `part: null`, to support
 * clearing a purely-visual highlight) leave the current selection untouched:
 * there is no dedicated "clear chart part selection" hook, and the 2D
 * counterpart never fires on an empty-space press either (the whole-element
 * selection model already resets `chartPartSelection` when a DIFFERENT
 * element is selected; see `editor-selection-state.ts`).
 */
function chartPartSelectHandler(
	element: PptxElement,
	context: ElementRenderContext,
): (part: ChartPartRef | null) => void {
	return (part) => {
		if (part) {
			context.onChartPartSelect?.(element, part);
		}
	};
}

/**
 * Build the interaction hooks for a bar3D/line3D/area3D/pie3D/surface3D
 * scene: click-to-select plus drag-to-value, committed through
 * `context.onChartPointChange` via the already-existing `withChartPointValue`
 * helper (the SAME helper the 2D value-drag state machine uses). A pie3D
 * wedge's drag changes its own value by the ANGLE swept around the pie's
 * centre rather than a position along a vertical axis (see
 * `pptx-viewer-shared`'s `pie-chart-3d-drag.ts`), but the RESULT is the same
 * shape as every other kind's: a `(part, value)` pair applied through this
 * SAME `withChartPointValue` commit path. Returns `undefined` on every
 * non-authoring surface (thumbnails, show stage, export raster), matching
 * `attachChartEditing`'s own gate.
 */
export function buildChart3DValueDragInteraction(
	element: PptxElement,
	context: ElementRenderContext,
): Chart3DValueDragInteraction | undefined {
	const chart = chart3DEditingGate(element, context);
	if (!chart) {
		return undefined;
	}
	return {
		onSelect: chartPartSelectHandler(element, context),
		onValueDragCommit: (part, value) => {
			if (!chart.chartData || part.pointIndex === undefined) {
				return;
			}
			context.onChartPointChange?.(
				element,
				withChartPointValue(chart.chartData, part.seriesIndex, part.pointIndex, value),
			);
		},
	};
}

/**
 * Seed a freshly mounted 3D chart handle's highlighted mark from the
 * persisted store selection (`context.chartPartSelection`), mirroring
 * `chart-editable.ts`'s own re-seed-on-(re)attach behaviour: the ring stays on
 * the clicked mark across a stage rebuild triggered by an unrelated edit, even
 * though the whole scene remounts fresh.
 */
export function seedChart3DSelectedPart(
	element: PptxElement,
	context: ElementRenderContext,
	handle: { setSelectedPart: (part: ChartPartRef | null) => void },
): void {
	handle.setSelectedPart(
		context.chartPartSelection?.elementId === element.id ? context.chartPartSelection.part : null,
	);
}
