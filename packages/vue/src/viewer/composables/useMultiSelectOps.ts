import type { Ref } from 'vue';

import type { EditorOperations } from './useEditorOperations';

export interface UseMultiSelectOpsInput {
	selectedElementIds: Ref<string[]>;
	ops: EditorOperations;
	clearSelection: () => void;
}

export interface UseMultiSelectOpsResult {
	deleteSelected: () => void;
	duplicateSelected: () => void;
	bringForward: () => void;
	sendBackward: () => void;
}

/**
 * useMultiSelectOps: apply a single-element editor op (delete / duplicate /
 * bring-forward / send-backward) across every currently selected element as
 * one batch. Extracted verbatim from `PowerPointViewer.vue`.
 */
export function useMultiSelectOps(input: UseMultiSelectOpsInput): UseMultiSelectOpsResult {
	const { selectedElementIds, ops, clearSelection } = input;

	function deleteSelected(): void {
		for (const id of [...selectedElementIds.value]) {
			ops.removeElement(id);
		}
		clearSelection();
	}
	function duplicateSelected(): void {
		const next: string[] = [];
		for (const id of [...selectedElementIds.value]) {
			const newId = ops.duplicateElement(id);
			if (newId) {
				next.push(newId);
			}
		}
		if (next.length > 0) {
			selectedElementIds.value = next;
		}
	}
	function bringForward(): void {
		for (const id of [...selectedElementIds.value]) {
			ops.bringForward(id);
		}
	}
	function sendBackward(): void {
		for (const id of [...selectedElementIds.value]) {
			ops.sendBackward(id);
		}
	}

	return { deleteSelected, duplicateSelected, bringForward, sendBackward };
}
