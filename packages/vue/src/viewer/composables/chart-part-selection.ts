import type { PptxElement } from 'pptx-viewer-core';
import type { ChartPartRef } from 'pptx-viewer-shared';
import type { InjectionKey, Ref } from 'vue';
import { inject, provide, ref, watchEffect } from 'vue';

/**
 * chart-part-selection (Vue): the bridge between on-canvas chart part clicks
 * (`useChartCanvasInteraction`, wired into `ChartRenderer`) and the chart
 * inspector (`ChartPanel` / `ChartDataGrid`), without threading props through
 * the hot `SlideStage` -> `ElementRenderer` chain. Mirrors React's
 * `ChartPartSelectionContext` using the same provide/inject pattern as
 * `SmartArtNodeEditKey` / `TableCellEditKey`.
 *
 * The context also carries the edit gate and the commit path: on-canvas chart
 * edits route through the SAME history-tracked editor op the inspector uses
 * (`useEditorOperations.updateElement`), so undo/redo and the save round-trip
 * work identically for canvas drags and grid keystrokes.
 */

/** A selected chart sub-part, scoped to the chart element that owns it. */
export interface ChartPartSelection {
	elementId: string;
	part: ChartPartRef;
}

export interface ChartCanvasEditContext {
	/** Current on-canvas chart part selection (shared with the inspector). */
	selection: Ref<ChartPartSelection | null>;
	/** Replace (or clear) the current chart part selection. */
	setSelection: (selection: ChartPartSelection | null) => void;
	/**
	 * Whether charts should accept pointer events at all (edit mode + not
	 * presenting). The chart root is otherwise click-transparent, so this is
	 * what makes a chart click-SELECTABLE on the editable canvas in the first
	 * place (mirrors the SmartArt `.pptx-vue-smartart-editable` opt-in).
	 */
	canSelectCharts: () => boolean;
	/**
	 * Whether direct on-canvas editing is active for a chart element: edit mode,
	 * not presenting, and the element is currently selected on the canvas.
	 */
	canEditChart: (elementId: string) => boolean;
	/** Commit an on-canvas chart edit through the history-tracked update path. */
	updateElement: (elementId: string, patch: Partial<PptxElement>) => void;
}

/** Typed injection key for the on-canvas chart editing context. */
export const ChartCanvasEditKey: InjectionKey<ChartCanvasEditContext> = Symbol(
	'pptx-vue-chart-canvas-edit',
);

/**
 * Resolve the injected {@link ChartCanvasEditContext}, if any. Returns
 * `undefined` when no editing context is provided (read-only viewer, tests,
 * thumbnails outside the viewer), in which case charts render inert.
 */
export function injectChartCanvasEdit(): ChartCanvasEditContext | undefined {
	return inject(ChartCanvasEditKey, undefined);
}

export interface UseChartCanvasEditContextInput {
	/** Whether on-canvas editing is currently allowed (edit mode + not presenting). */
	canEditInline: () => boolean;
	/** Whether the element is currently part of the canvas selection. */
	isElementSelected: (elementId: string) => boolean;
	/** Wraps `ops.updateElement`; commits get history + dirty marking for save. */
	updateElement: (elementId: string, patch: Partial<PptxElement>) => void;
}

/**
 * useChartCanvasEditContext: provides the on-canvas chart editing context at
 * the viewer root. Also drops a stale part selection the moment its chart
 * stops being editable (deselected, presentation started, edit mode left) so
 * the inspector ring-highlight does not linger.
 */
export function useChartCanvasEditContext(input: UseChartCanvasEditContextInput): {
	chartPartSelection: Ref<ChartPartSelection | null>;
} {
	const selection = ref<ChartPartSelection | null>(null);

	const canEditChart = (elementId: string): boolean =>
		input.canEditInline() && input.isElementSelected(elementId);

	provide(ChartCanvasEditKey, {
		selection,
		setSelection: (next: ChartPartSelection | null): void => {
			selection.value = next;
		},
		canSelectCharts: input.canEditInline,
		canEditChart,
		updateElement: input.updateElement,
	});

	// Clear the selection when its chart is deselected or editing turns off.
	// Guarded on a non-null selection so the eager first run touches none of
	// the input closures (they may capture state declared later in setup).
	watchEffect(() => {
		const current = selection.value;
		if (current && !canEditChart(current.elementId)) {
			selection.value = null;
		}
	});

	return { chartPartSelection: selection };
}
