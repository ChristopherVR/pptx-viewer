/**
 * useMergeShapes: Shape Format > Merge Shapes (Union / Combine / Fragment /
 * Intersect / Subtract) for the Vue editor.
 *
 * Every decision (which shapes qualify, the boolean geometry, where the result
 * lands in the z-order) lives in `pptx-viewer-shared`'s merge-shapes module;
 * this composable only reads the selection IN SELECTION ORDER (the first
 * selected shape's formatting survives), applies the plan as ONE history step
 * and selects the new shape(s).
 */
import type { MergeShapeOperation, PptxElement, PptxSlide } from 'pptx-viewer-core';
import { applyMergeShapesPlan, canMergeShapes, planMergeShapes } from 'pptx-viewer-shared';
import { computed } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import type { MergeShapesController } from './merge-crop-context';

export interface UseMergeShapesInput {
	canEdit: () => boolean;
	slides: Ref<PptxSlide[]>;
	activeSlideIndex: Ref<number>;
	selectedElementIds: Ref<string[]>;
	pushHistory: () => void;
}

export function useMergeShapes(input: UseMergeShapesInput): MergeShapesController {
	const { slides, activeSlideIndex, selectedElementIds } = input;

	/** The selected slide elements, first-selected first. */
	const orderedSelection: ComputedRef<PptxElement[]> = computed(() => {
		const elements = slides.value[activeSlideIndex.value]?.elements ?? [];
		const byId = new Map(elements.map((el) => [el.id, el]));
		return selectedElementIds.value
			.map((id) => byId.get(id))
			.filter((el): el is PptxElement => el !== undefined);
	});

	const canMerge = computed(() => input.canEdit() && canMergeShapes(orderedSelection.value));

	function merge(op: MergeShapeOperation): void {
		if (!canMerge.value) {
			return;
		}
		const index = activeSlideIndex.value;
		const slide = slides.value[index];
		const plan = slide ? planMergeShapes(op, orderedSelection.value) : null;
		if (!slide || !plan) {
			return;
		}
		input.pushHistory();
		const elements = applyMergeShapesPlan(slide.elements, plan);
		slides.value = slides.value.map((s, i) => (i === index ? { ...s, elements } : s));
		selectedElementIds.value = plan.created.map((el) => el.id);
	}

	return { canMerge, merge };
}
