/**
 * useClipboardHandlers: Copy, cut, paste, duplicate, and delete handlers
 * extracted from useElementManipulation.
 *
 * Thin wrapper over the shared element-clipboard module
 * (`pptx-viewer-shared`, render/element-clipboard.ts), which owns the pure
 * payload building + paste cloning (fresh template-aware ids, cascade offset).
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { buildElementClipboardPayload, cloneElementForPaste } from 'pptx-viewer-shared';

import type { ClipboardHandlers } from './element-manipulation-types';
import type { EditorHistoryResult } from './useEditorHistory';
import type { ElementOperations } from './useElementOperations';

interface ClipboardInput {
	activeSlide: PptxSlide | undefined;
	activeSlideIndex: number;
	selectedElement: PptxElement | null;
	effectiveSelectedIds: string[];
	editTemplateMode: boolean;
	clipboardPayload: { element: PptxElement; isTemplate: boolean } | null;
	setClipboardPayload: React.Dispatch<
		React.SetStateAction<{ element: PptxElement; isTemplate: boolean } | null>
	>;
	ops: ElementOperations;
	history: EditorHistoryResult;
}

export function useClipboardHandlers(input: ClipboardInput): ClipboardHandlers {
	const {
		activeSlide,
		selectedElement,
		effectiveSelectedIds,
		editTemplateMode,
		clipboardPayload,
		setClipboardPayload,
		ops,
		history,
	} = input;

	const handleCopy = () => {
		if (!selectedElement) {
			return;
		}
		setClipboardPayload(buildElementClipboardPayload(selectedElement, editTemplateMode));
	};

	const handleDelete = () => {
		const idsToDelete = effectiveSelectedIds;
		if (!idsToDelete.length || !activeSlide) {
			return;
		}
		const idSet = new Set(idsToDelete);
		// Route to whichever store is being edited: in edit-template mode the
		// selected ids are template elements in the template store; otherwise they
		// are normal slide elements. Template deletes persist via buildSaveSlides.
		ops.updateActiveElements((els) => els.filter((el) => !idSet.has(el.id)));
		ops.clearSelection();
		history.markDirty();
	};

	const handleCut = () => {
		handleCopy();
		handleDelete();
	};

	const insertClone = (source: PptxElement) => {
		// In edit-template mode the clone is inserted into the template store, so
		// it keeps a template-prefixed id so later edits route to the same store.
		const clone = cloneElementForPaste(source, { intoTemplate: editTemplateMode });
		ops.updateActiveElements((els) => [...els, clone]);
		ops.applySelection(clone.id);
		history.markDirty();
	};

	const handlePaste = () => {
		if (!clipboardPayload || !activeSlide) {
			return;
		}
		insertClone(clipboardPayload.element);
	};

	const handleDuplicate = () => {
		if (!selectedElement || !activeSlide) {
			return;
		}
		insertClone(selectedElement);
	};

	return {
		handleCopy,
		handleCut,
		handlePaste,
		handleDuplicate,
		handleDelete,
	};
}
