/**
 * useClipboardHandlers: Copy, cut, paste, duplicate, and delete handlers
 * extracted from useElementManipulation.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import { generateElementId } from '../utils/generate-id';
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
		activeSlideIndex,
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
		// Template (master/layout) elements live in `slide.elements` too, so every
		// delete flows through the same slides path; deleting a template element
		// persists to the shared part via the core save writer.
		ops.updateSlides((prev) =>
			prev.map((s, i) =>
				i === activeSlideIndex
					? { ...s, elements: s.elements.filter((el) => !idSet.has(el.id)) }
					: s,
			),
		);
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
		clone.id = generateElementId();
		clone.x += 20;
		clone.y += 20;
		ops.updateSlides((prev) =>
			prev.map((s, i) => (i === activeSlideIndex ? { ...s, elements: [...s.elements, clone] } : s)),
		);
		ops.applySelection(clone.id);
		history.markDirty();
	};

	const handleDuplicate = () => {
		if (!selectedElement || !activeSlide) {
			return;
		}
		const clone = structuredClone(selectedElement);
		clone.id = generateElementId();
		clone.x += 20;
		clone.y += 20;
		ops.updateSlides((prev) =>
			prev.map((s, i) => (i === activeSlideIndex ? { ...s, elements: [...s.elements, clone] } : s)),
		);
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
