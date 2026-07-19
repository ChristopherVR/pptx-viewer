import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';
import type { ViewerProofingOptions } from 'pptx-viewer-shared';
import { applyAutoCorrect, setCellText } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import { remapTextToSegments } from './remap-text';
import type { EditorOperations } from './useEditorOperations';

export interface UseInlineEditingInput {
	canEdit: () => boolean;
	findActiveElement: (id: string) => PptxElement | undefined;
	ops: EditorOperations;
	/**
	 * File > Options > Proofing values. When supplied, AutoCorrect runs over the
	 * typed text on commit (inline element edits and table-cell edits only, so
	 * loaded content is never rewritten).
	 */
	proofing?: () => ViewerProofingOptions | undefined;
}

export interface UseInlineEditingResult {
	inlineEditingElementId: Ref<string | null>;
	inlineEditingText: Ref<string>;
	inlineEditingElement: ComputedRef<PptxElement | undefined>;
	enterInlineEdit: (id: string) => void;
	commitInlineEdit: () => void;
	cancelInlineEdit: () => void;
	commitTableCell: (elementId: string, rowIndex: number, colIndex: number, text: string) => void;
}

/**
 * useInlineEditing: element-level inline text editing (entered by tapping an
 * already-selected element) plus the inline table-cell commit path. Both
 * commit through `ops.updateElement` so undo/redo works. Extracted verbatim
 * from `PowerPointViewer.vue`.
 */
export function useInlineEditing(input: UseInlineEditingInput): UseInlineEditingResult {
	const { canEdit, findActiveElement, ops } = input;

	/** Apply the enabled AutoCorrect rules to a typed-text commit. */
	function autoCorrect(text: string): string {
		const proofing = input.proofing?.();
		return proofing ? applyAutoCorrect(text, proofing) : text;
	}

	const inlineEditingElementId = ref<string | null>(null);
	const inlineEditingText = ref('');
	const inlineEditingElement = computed<PptxElement | undefined>(() =>
		inlineEditingElementId.value ? findActiveElement(inlineEditingElementId.value) : undefined,
	);

	function enterInlineEdit(id: string): void {
		const el = findActiveElement(id);
		// Only elements that carry text (text boxes / shapes) get the element-level
		// inline text editor, and only when text editing is not locked. Mirrors
		// React's gate (useCanvasInteractions: `hasTextProperties(el) &&
		// !el.locks?.noTextEdit`). Without this, tapping a selected table opened the
		// whole-table text editor and masked the per-cell <td> editor.
		if (!el || !hasTextProperties(el) || el.locks?.noTextEdit) {
			return;
		}
		// Equation elements never enter inline text editing: the editor only
		// sees the literal "[Equation]" placeholder, so committing would remap
		// the segments from plain text and permanently drop the OMML
		// (`textSegments[].equationXml`). Mirrors the React/Angular guard.
		if (el.textSegments?.some((seg) => seg.equationXml)) {
			return;
		}
		inlineEditingElementId.value = id;
		inlineEditingText.value = (el as { text?: string }).text ?? '';
	}
	function commitInlineEdit(): void {
		const id = inlineEditingElementId.value;
		if (!id) {
			return;
		}
		const el = findActiveElement(id) as
			| (PptxElement & { textSegments?: unknown; textStyle?: unknown })
			| undefined;
		const text = autoCorrect(inlineEditingText.value);
		inlineEditingElementId.value = null;
		if (el) {
			const segments = remapTextToSegments(
				text,
				(el.textSegments as Parameters<typeof remapTextToSegments>[1]) ?? undefined,
				(el.textStyle as Parameters<typeof remapTextToSegments>[2]) ?? undefined,
			);
			ops.updateElement(id, { text, textSegments: segments } as Partial<PptxElement>);
		}
	}
	function cancelInlineEdit(): void {
		inlineEditingElementId.value = null;
	}
	/**
	 * Commit an inline table-cell edit: resolve the table element, apply the
	 * immutable `setCellText` update, and record it through the history-tracked
	 * editor op so undo/redo works (mirrors React/Angular cell-commit handlers).
	 */
	function commitTableCell(
		elementId: string,
		rowIndex: number,
		colIndex: number,
		text: string,
	): void {
		if (!canEdit()) {
			return;
		}
		const el = findActiveElement(elementId);
		if (!el || el.type !== 'table') {
			return;
		}
		const updated = setCellText(el, rowIndex, colIndex, autoCorrect(text));
		ops.updateElement(elementId, { tableData: updated.tableData } as Partial<PptxElement>);
	}

	return {
		inlineEditingElementId,
		inlineEditingText,
		inlineEditingElement,
		enterInlineEdit,
		commitInlineEdit,
		cancelInlineEdit,
		commitTableCell,
	};
}
