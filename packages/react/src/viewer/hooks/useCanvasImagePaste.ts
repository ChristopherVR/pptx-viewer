import type { ImagePptxElement } from 'pptx-viewer-core';
import type { EditorImagePasteOptions } from 'pptx-viewer-shared';
import { useMemo, useRef } from 'react';

import type { UseEditorOperationsInput } from './useEditorOperations';

type Input = Pick<UseEditorOperationsInput, 'state' | 'mode' | 'canEdit' | 'handlerRef'> & {
	insertElement(element: ImagePptxElement): void;
};

export type CanvasImagePasteHandlers = Pick<EditorImagePasteOptions, 'getTarget' | 'insertElement'>;

/** Prepare live editor commands; the mounted SlideCanvas owns the listener lifetime. */
export function useCanvasImagePaste(input: Input): CanvasImagePasteHandlers {
	const latest = useRef(input);
	latest.current = input;
	const session = useRef({});
	const { state, canEdit, mode } = input;
	const eligible =
		canEdit &&
		mode === 'edit' &&
		!state.loading &&
		!state.error &&
		!state.editTemplateMode &&
		!state.inlineEditingElementId &&
		!state.tableEditorState?.isEditing &&
		state.activeTool === 'select' &&
		!state.contextMenuState;
	const slideId = state.activeSlide?.id;
	const { loading, error } = state;
	const { width, height } = state.canvasSize;
	return useMemo(
		() => ({
			getTarget: () => {
				if (!eligible || loading || error) {
					return null;
				}
				const current = latest.current;
				const value = current.state;
				if (
					!current.canEdit ||
					current.mode !== 'edit' ||
					value.loading ||
					value.error ||
					value.editTemplateMode ||
					value.inlineEditingElementId ||
					value.tableEditorState?.isEditing ||
					value.activeTool !== 'select' ||
					value.contextMenuState ||
					!value.activeSlide ||
					value.activeSlide.id !== slideId ||
					value.canvasSize.width !== width ||
					value.canvasSize.height !== height
				) {
					return null;
				}
				return {
					documentId: current.handlerRef?.current ?? session.current,
					slideId: value.activeSlide.id,
					canvasSize: value.canvasSize,
				};
			},
			insertElement: (element: ImagePptxElement) => latest.current.insertElement(element),
		}),
		[loading, error, eligible, slideId, width, height],
	);
}
