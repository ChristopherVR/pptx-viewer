import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, PptxSlide, TextStyle } from 'pptx-viewer-core';
import type { CollaborationLivePatcher, ViewerProofingOptions } from 'pptx-viewer-shared';
import {
	applyAutoCorrect,
	canInteractWithElement,
	publishLiveInlineText,
	resolveInlineEditAutoFitHeight,
	setCellText,
} from 'pptx-viewer-shared';
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
	/**
	 * Collaboration live-preview channel. Typed text only reaches `slides` (and
	 * therefore the Y.Doc reconcile) on commit, so peers saw nothing while a
	 * peer typed; `updateInlineText` publishes each keystroke through this.
	 */
	livePatcher?: () => CollaborationLivePatcher | undefined;
	/** The slide the edited element belongs to (needed by the live channel). */
	activeSlide?: () => PptxSlide | undefined;
}

export interface UseInlineEditingResult {
	inlineEditingElementId: Ref<string | null>;
	inlineEditingText: Ref<string>;
	inlineEditingElement: ComputedRef<PptxElement | undefined>;
	/** Set the in-progress text and mirror it to collaborators. */
	updateInlineText: (text: string) => void;
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

	/**
	 * Publish everything queued on the live channel right now. Called before a
	 * commit/cancel so a queued interim frame cannot land AFTER the committed
	 * (AutoCorrected) text and revert it.
	 */
	function flushLiveText(): void {
		input.livePatcher?.()?.flush();
	}

	function updateInlineText(text: string): void {
		inlineEditingText.value = text;
		publishLiveInlineText(
			input.livePatcher?.(),
			input.activeSlide?.(),
			inlineEditingElementId.value,
			text,
		);
	}

	function enterInlineEdit(id: string): void {
		const el = findActiveElement(id);
		// Only elements that carry text (text boxes / shapes) get the element-level
		// inline text editor, and only when text editing is not locked. The lock
		// composition (`noSelect` subsumes `noTextEdit`) is decided once, in shared
		// `element-locks`, rather than re-read flag by flag here. Without the text
		// gate, tapping a selected table opened the whole-table text editor and
		// masked the per-cell <td> editor.
		if (!el || !hasTextProperties(el) || !canInteractWithElement(el, 'textEdit')) {
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
		flushLiveText();
		const text = autoCorrect(inlineEditingText.value);
		inlineEditingElementId.value = null;
		if (el) {
			// Clicking into a text box and clicking straight back out is not an
			// edit, and PowerPoint does not offer to undo it. Committing anyway
			// recorded a snapshot identical to the live deck, and because this
			// path fires on every blur - including the blur caused by pressing
			// the ribbon's own Undo button - the stack gained a fresh no-op entry
			// faster than Undo could drain it. Two real edits later, Undo popped
			// only the no-op it had just created and the deck never moved: the
			// button stayed lit forever and the earlier edits became unreachable.
			//
			// Comparing the committed text also protects the segments: an element
			// carrying rich `textSegments` but no plain `text` seeded the editor
			// with '', so a no-op commit remapped its runs from an empty string
			// and erased them.
			const currentText = (el as { text?: string }).text ?? '';
			if (text === currentText) {
				return;
			}
			const segments = remapTextToSegments(
				text,
				(el.textSegments as Parameters<typeof remapTextToSegments>[1]) ?? undefined,
				(el.textStyle as Parameters<typeof remapTextToSegments>[2]) ?? undefined,
			);
			// `a:spAutoFit` ("Resize shape to fit text"): grow/shrink the shape to
			// the text's natural content height, the way PowerPoint does. Vue has
			// not yet applied the `null` that unmounts the editor's DOM node at
			// this point (that happens on the next render, when the reactive
			// `inlineEditingElementId` update flushes), so `[data-inline-editor]`
			// still resolves to the live, just-blurred node.
			const editorEl =
				typeof document !== 'undefined'
					? document.querySelector<HTMLElement>('[data-inline-editor]')
					: null;
			const newHeight = resolveInlineEditAutoFitHeight(
				el.textStyle as TextStyle | undefined,
				(el as { height?: number }).height ?? 0,
				editorEl,
			);
			ops.updateElement(id, {
				text,
				textSegments: segments,
				...(newHeight !== undefined ? { height: newHeight } : {}),
			} as Partial<PptxElement>);
		}
	}
	function cancelInlineEdit(): void {
		flushLiveText();
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
		updateInlineText,
		enterInlineEdit,
		commitInlineEdit,
		cancelInlineEdit,
		commitTableCell,
	};
}
