import { attachEditorImagePaste } from 'pptx-viewer-shared';
import { useLayoutEffect, useRef } from 'react';

import type { SlideCanvasProps } from './canvas-types';

type Input = Pick<
	SlideCanvasProps,
	| 'imagePaste'
	| 'zoom'
	| 'canEdit'
	| 'mode'
	| 'activeSlide'
	| 'editTemplateMode'
	| 'inlineEditingElementId'
	| 'tableEditorState'
	| 'activeTool'
>;

function canPaste(input: Input): boolean {
	return (
		input.canEdit &&
		input.mode === 'edit' &&
		!input.editTemplateMode &&
		!input.inlineEditingElementId &&
		!input.tableEditorState?.isEditing &&
		(input.activeTool ?? 'select') === 'select' &&
		Boolean(input.activeSlide)
	);
}

/** Actual canvas props win over editor defaults, including headless overrides. */
export function useSlideCanvasImagePaste(input: Input): void {
	const latest = useRef(input);
	latest.current = input;
	const eligible = canPaste(input);
	const slideId = input.activeSlide?.id;
	useLayoutEffect(() => {
		const root = input.zoom.canvasViewportRef.current;
		if (!root || !input.imagePaste) {
			return;
		}
		return attachEditorImagePaste(root, {
			getCanvas: () => latest.current.zoom.canvasStageRef.current,
			getTarget: () => {
				const value = latest.current;
				if (!eligible || !canPaste(value) || value.activeSlide?.id !== slideId) {
					return null;
				}
				const target = value.imagePaste?.getTarget();
				return target && target.slideId === value.activeSlide?.id ? target : null;
			},
			insertElement: (element) => latest.current.imagePaste?.insertElement(element),
		});
	}, [input.imagePaste, input.zoom.canvasViewportRef, eligible, slideId]);
}
