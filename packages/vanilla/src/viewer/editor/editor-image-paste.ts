import type { PptxHandler, ImagePptxElement } from 'pptx-viewer-core';
import { attachEditorImagePaste } from 'pptx-viewer-shared';
import type { EditorImagePasteTarget } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';

interface ImagePasteDeps {
	store: Store<ViewerState>;
	getHandler(): PptxHandler | null;
	isEditing(): boolean;
	insertElement(element: ImagePptxElement): void;
}

/** Canvas-owned native paste, rebound when the store changes its editable destination. */
export function attachCanvasImagePaste(
	root: HTMLElement,
	canvas: HTMLElement,
	deps: ImagePasteDeps,
): () => void {
	const getTarget = (): EditorImagePasteTarget | null => {
		const state = deps.store.get();
		const handler = deps.getHandler();
		const slide = state.slides[state.currentSlide];
		if (
			!state.editable ||
			state.loading ||
			state.error ||
			state.presenting ||
			state.masterViewTarget ||
			state.editTemplateMode ||
			state.drawTool !== 'select' ||
			deps.isEditing() ||
			!slide ||
			!handler
		) {
			return null;
		}
		return { documentId: handler, slideId: slide.id, canvasSize: state.canvasSize };
	};
	const attach = () =>
		attachEditorImagePaste(root, {
			getCanvas: () => canvas,
			getTarget,
			insertElement: deps.insertElement,
		});
	let previous = getTarget();
	let detach = attach();
	const unsubscribe = deps.store.subscribe(() => {
		const target = getTarget();
		if (
			target?.documentId !== previous?.documentId ||
			target?.slideId !== previous?.slideId ||
			target?.canvasSize.width !== previous?.canvasSize.width ||
			target?.canvasSize.height !== previous?.canvasSize.height
		) {
			detach();
			detach = attach();
		}
		previous = target;
	});
	return () => {
		unsubscribe();
		detach();
	};
}
