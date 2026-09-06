import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import type { ChartPartRef } from 'pptx-viewer-shared';
import { withChartPointValue } from 'pptx-viewer-shared';

import type { ChartCanvasEditContext } from './chart-part-selection';

/**
 * chart-3d-interaction-support: the framework-glue shared by all five
 * interactive 3D chart scene composables (bar3D/line3D/area3D/pie3D/surface)
 * to bridge a scene's own click/drag picking (via the `interaction` argument
 * `mount*Chart3D` now accepts) to the SAME `ChartCanvasEditContext` selection
 * + commit path the 2D SVG mark interaction (`chart-canvas-interaction.ts`)
 * already uses, so the chart inspector (`ChartPanel`) reacts to a 3D mark
 * exactly like a 2D one.
 *
 * Pure functions only, no Vue reactivity: each scene composable owns its own
 * refs/handle and calls these from the `interaction` object it builds for its
 * `mount*Chart3D` call.
 */

/** The selection scoped to `elementId`, or null when nothing / another element is selected. */
export function selectedChart3DPart(
	ctx: ChartCanvasEditContext | undefined,
	elementId: string,
): ChartPartRef | null {
	const selection = ctx?.selection.value;
	return selection && selection.elementId === elementId ? selection.part : null;
}

/**
 * `onSelect` handler shared by every 3D chart interaction (bar/line/area/pie/
 * surface): gated on the same `canSelectCharts` the 2D click-select uses, so a
 * 3D mark is only click-selectable on the editable canvas.
 */
export function onChart3DSelect(
	ctx: ChartCanvasEditContext | undefined,
	elementId: string,
	part: ChartPartRef | null,
): void {
	if (!ctx?.canSelectCharts()) {
		return;
	}
	ctx.setSelection(part ? { elementId, part } : null);
}

/**
 * `onValueDragCommit` handler shared by bar3D/line3D/area3D/surface3D: builds the new
 * chart data via the SAME `withChartPointValue` helper the 2D drag commits
 * through, then pushes it through the SAME history-tracked update path (gated
 * on `canEditChart`, mirroring the 2D drag's edit gate).
 */
export function onChart3DValueDragCommit(
	ctx: ChartCanvasEditContext | undefined,
	elementId: string,
	chartData: PptxChartData | undefined,
	part: ChartPartRef,
	value: number,
): void {
	if (!ctx?.canEditChart(elementId) || !chartData || part.pointIndex === undefined) {
		return;
	}
	const next = withChartPointValue(chartData, part.seriesIndex, part.pointIndex, value);
	ctx.updateElement(elementId, { chartData: next } as Partial<PptxElement>);
}
