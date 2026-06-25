/**
 * useClipboardHandlers: Copy, cut, paste, duplicate, and delete handlers
 * extracted from useElementManipulation.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import { makeCloneId } from '../utils/template-editing';
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
		setClipboardPayload({
			element: structuredClone(selectedElement),
			isTemplate: editTemplateMode,
		});
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

	const handlePaste = () => {
		if (!clipboardPayload || !activeSlide) {
			return;
		}
		const clone = structuredClone(clipboardPayload.element);
		// In edit-template mode the clone is inserted into the template store, so
		// keep a template-prefixed id so later edits route to the same store.
		clone.id = makeCloneId(editTemplateMode, clipboardPayload.element.id);
		clone.x += 20;
		clone.y += 20;
		ops.updateActiveElements((els) => [...els, clone]);
		ops.applySelection(clone.id);
		history.markDirty();
	};

	const handleDuplicate = () => {
		if (!selectedElement || !activeSlide) {
			return;
		}
		const clone = structuredClone(selectedElement);
		clone.id = makeCloneId(editTemplateMode, selectedElement.id);
		clone.x += 20;
		clone.y += 20;
		ops.updateActiveElements((els) => [...els, clone]);
		ops.applySelection(clone.id);
		history.markDirty();
	};

	return {
		handleCopy,
		handleCut,
		handlePaste,
		handleDuplicate,
		handleDelete,
	};
}
