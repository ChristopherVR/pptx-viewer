import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import type { EditorOperations } from './useEditorOperations';

export interface UseSelectionPaneWiringInput {
	findActiveElement: (id: string) => PptxElement | undefined;
	activeSlide: ComputedRef<PptxSlide | undefined>;
	selectedElementIds: Ref<string[]>;
	ops: EditorOperations;
}

export interface UseSelectionPaneWiringResult {
	showSelectionPane: Ref<boolean>;
	onSelectionPaneSelect: (id: string) => void;
	onSelectionPaneToggleVisibility: (id: string) => void;
	onSelectionPaneReorder: (payload: { from: number; to: number }) => void;
}

/**
 * useSelectionPaneWiring: View ▸ Selection Pane (object list + z-order +
 * visibility over the active slide's elements). Extracted verbatim from
 * `PowerPointViewer.vue`.
 */
export function useSelectionPaneWiring(
	input: UseSelectionPaneWiringInput,
): UseSelectionPaneWiringResult {
	const { findActiveElement, activeSlide, selectedElementIds, ops } = input;

	const showSelectionPane = ref(false);
	function onSelectionPaneSelect(id: string): void {
		selectedElementIds.value = [id];
	}
	function onSelectionPaneToggleVisibility(id: string): void {
		const el = findActiveElement(id);
		if (el) {
			ops.updateElement(id, { hidden: !el.hidden } as Partial<PptxElement>);
		}
	}
	function onSelectionPaneReorder(payload: { from: number; to: number }): void {
		const el = activeSlide.value?.elements[payload.from];
		if (el) {
			ops.reorder(el.id, payload.to);
		}
	}

	return {
		showSelectionPane,
		onSelectionPaneSelect,
		onSelectionPaneToggleVisibility,
		onSelectionPaneReorder,
	};
}
