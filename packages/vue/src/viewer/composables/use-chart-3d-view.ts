/**
 * useChart3DView: Vue glue between a chart element's `<pptx-three-view>` and
 * this binding's chart-part selection / value-commit path. Everything that
 * decides WHICH element gets a 3D spec, and what a click/drag on it means,
 * lives in `pptx-viewer-shared` (`resolveChartThreeViewSpec`,
 * `applyChart3DSelect`, `applyChart3DDrag`); this composable only adapts it to
 * the injected `ChartCanvasEditContext`, the SAME context the 2D mark
 * interaction (`chart-canvas-interaction.ts`) uses, so the chart inspector
 * and undo history react identically to a 2D or a 3D mark. Mirrors React's
 * `use-chart-3d-view.ts`.
 */
import type { PptxElement } from 'pptx-viewer-core';
import {
	applyChart3DDrag,
	applyChart3DSelect,
	formatAxisValue,
	resolveChartThreeViewSpec,
} from 'pptx-viewer-shared';
import type {
	Chart3DSelectionBridge,
	ChartPartRef,
	ThreeViewDragDetail,
	ThreeViewSpec,
} from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import type { ComputedRef } from 'vue';

import { injectChartCanvasEdit } from './chart-part-selection';
import { useRendering3DFlags } from './rendering-3d-flags';

export interface Chart3DView {
	/** `null` when this element does not resolve to a 3D scene: render the 2D path only. */
	spec: ComputedRef<ThreeViewSpec | null>;
	/** The chart part selected on this element (mirrored onto the scene). */
	selectedPart: ComputedRef<ChartPartRef | null>;
	/**
	 * Whether the scene takes pointer input (select, drag): on the
	 * editable canvas AND with this chart selected, the same gate that arms
	 * its 2D marks, so a first click on an unselected chart selects it.
	 */
	interactive: ComputedRef<boolean>;
	/** Formatted value for the mid-drag badge, or `null` when not dragging. */
	dragLabel: ComputedRef<string | null>;
	onSelect: (part: ChartPartRef | null) => void;
	onDrag: (detail: ThreeViewDragDetail) => void;
}

/** The `<pptx-three-view>` spec for a chart element, plus its event handlers. */
export function useChart3DView(
	element: () => PptxElement,
	interactive: () => boolean,
): Chart3DView {
	const flags = useRendering3DFlags();
	const ctx = injectChartCanvasEdit();
	const dragValue = ref<number | null>(null);

	const spec = computed(() => resolveChartThreeViewSpec(element(), flags.value));
	const selectedPart = computed(() => {
		const selection = ctx?.selection.value;
		return selection && selection.elementId === element().id ? selection.part : null;
	});

	const editable = computed(() => interactive() && Boolean(ctx?.canEditChart(element().id)));

	function bridge(): Chart3DSelectionBridge {
		const el = element();
		return {
			elementId: el.id,
			chartData: el.type === 'chart' ? el.chartData : undefined,
			canSelect: editable.value,
			selectedElementId: ctx?.selection.value?.elementId ?? null,
			setSelection: (selection) => ctx?.setSelection(selection),
			setDragValue: (value) => {
				dragValue.value = value;
			},
			commitChartData: ctx?.canEditChart(el.id)
				? (next) => ctx.updateElement(el.id, { chartData: next } as Partial<PptxElement>)
				: undefined,
		};
	}

	return {
		spec,
		selectedPart,
		interactive: editable,
		dragLabel: computed(() => (dragValue.value === null ? null : formatAxisValue(dragValue.value))),
		onSelect: (part) => applyChart3DSelect(bridge(), part),
		onDrag: (detail) => applyChart3DDrag(bridge(), detail),
	};
}
