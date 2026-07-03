import type { PptxElement } from 'pptx-viewer-core';
import { ref } from 'vue';
import type { Ref } from 'vue';

import type { EditorOperations } from './useEditorOperations';

export interface UseInsertElementDialogsInput {
	ops: EditorOperations;
	selectedElementIds: Ref<string[]>;
}

export interface UseInsertElementDialogsResult {
	showInsertSmartArt: Ref<boolean>;
	showEquationEditor: Ref<boolean>;
	onInsertElement: (element: PptxElement) => void;
}

/**
 * useInsertElementDialogs: Insert ▸ SmartArt / Equation dialogs, both of which
 * hand back a fully-built element to add and select. Extracted verbatim from
 * `PowerPointViewer.vue`.
 */
export function useInsertElementDialogs(
	input: UseInsertElementDialogsInput,
): UseInsertElementDialogsResult {
	const { ops, selectedElementIds } = input;

	const showInsertSmartArt = ref(false);
	const showEquationEditor = ref(false);
	function onInsertElement(element: PptxElement): void {
		ops.addElement(element);
		selectedElementIds.value = [element.id];
		showInsertSmartArt.value = false;
		showEquationEditor.value = false;
	}

	return { showInsertSmartArt, showEquationEditor, onInsertElement };
}
