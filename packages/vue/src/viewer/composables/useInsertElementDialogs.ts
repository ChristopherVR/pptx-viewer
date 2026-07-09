import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { ref } from 'vue';
import type { Ref } from 'vue';

import type { EditorOperations } from './useEditorOperations';

export interface UseInsertElementDialogsInput {
	ops: EditorOperations;
	selectedElementIds: Ref<string[]>;
	findActiveElement: (id: string) => PptxElement | undefined;
}

export interface UseInsertElementDialogsResult {
	showInsertSmartArt: Ref<boolean>;
	showEquationEditor: Ref<boolean>;
	/** The OMML being edited, or null when the dialog is in "insert" mode. */
	editingEquationOmml: Ref<Record<string, unknown> | null>;
	onInsertElement: (element: PptxElement) => void;
	/** Open the equation editor seeded from an existing equation element; returns
	 *  false when `el` carries no equation segment (so the caller can fall back to
	 *  ordinary inline text editing). */
	openEquationEditorForElement: (el: PptxElement) => boolean;
	/** Apply an edited equation segment back onto the element being edited. */
	onApplyEquation: (segment: TextSegment) => void;
	/** Close the equation editor and drop any edit-mode state. */
	closeEquationEditor: () => void;
}

/**
 * useInsertElementDialogs: Insert ▸ SmartArt / Equation dialogs. SmartArt and a
 * fresh equation hand back a fully-built element to add and select; an existing
 * equation is instead re-opened in edit mode (`editingEquationOmml` set) and its
 * segment patched in place via `onApplyEquation`, never routed through plain-text
 * inline editing (which would drop the OMML). Mirrors React's
 * `openEquationEditorForElement` / `handleUpdateEquation` split.
 */
export function useInsertElementDialogs(
	input: UseInsertElementDialogsInput,
): UseInsertElementDialogsResult {
	const { ops, selectedElementIds, findActiveElement } = input;

	const showInsertSmartArt = ref(false);
	const showEquationEditor = ref(false);
	const editingEquationOmml = ref<Record<string, unknown> | null>(null);
	// The element whose equation is being edited (kept explicit so the patch
	// targets it even if selection changes while the dialog is open).
	const editingEquationElementId = ref<string | null>(null);

	function onInsertElement(element: PptxElement): void {
		ops.addElement(element);
		selectedElementIds.value = [element.id];
		showInsertSmartArt.value = false;
		showEquationEditor.value = false;
		editingEquationOmml.value = null;
		editingEquationElementId.value = null;
	}

	function openEquationEditorForElement(el: PptxElement): boolean {
		if (!hasTextProperties(el)) {
			return false;
		}
		const eqSeg = el.textSegments?.find((seg) => seg.equationXml);
		if (!eqSeg?.equationXml) {
			return false;
		}
		editingEquationElementId.value = el.id;
		editingEquationOmml.value = eqSeg.equationXml;
		if (!selectedElementIds.value.includes(el.id)) {
			selectedElementIds.value = [el.id];
		}
		showEquationEditor.value = true;
		return true;
	}

	function onApplyEquation(segment: TextSegment): void {
		const id = editingEquationElementId.value;
		if (id) {
			const el = findActiveElement(id);
			if (el) {
				// Replace only the equation segment, preserving the host element
				// (id, geometry, everything else). Never remap from the literal
				// "[Equation]" placeholder text: that was the 2026-07-04 data-loss
				// bug that discarded the OMML.
				ops.updateElement(id, { textSegments: [segment] } as Partial<PptxElement>);
			}
		}
		closeEquationEditor();
	}

	function closeEquationEditor(): void {
		showEquationEditor.value = false;
		editingEquationOmml.value = null;
		editingEquationElementId.value = null;
	}

	return {
		showInsertSmartArt,
		showEquationEditor,
		editingEquationOmml,
		onInsertElement,
		openEquationEditorForElement,
		onApplyEquation,
		closeEquationEditor,
	};
}
