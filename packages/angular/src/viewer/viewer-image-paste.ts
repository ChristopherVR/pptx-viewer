import { computed, DestroyRef, effect, inject } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';

import { attachEditorImagePaste } from '../internal/shared';
import type { EditorImagePasteTarget } from '../internal/shared';
import type { EditorStateService } from './editor-state.service';
import type { LoadContentService } from './load-content.service';

interface ImagePasteHost {
	rootElement(): HTMLElement | undefined;
	mainElement(): HTMLElement | undefined;
	canEdit(): boolean;
	blocked(): boolean;
	activeSlide(): PptxSlide | undefined;
	activeSlideIndex(): number;
}

/** Bind the shared native-paste controller to Angular's current canvas lifecycle. */
export function setupViewerImagePaste(
	host: ImagePasteHost,
	loader: Pick<LoadContentService, 'slides' | 'loading' | 'error' | 'canvasSize'>,
	editor: Pick<EditorStateService, 'addElement'>,
): void {
	// Element edits replace the editable slide, but must not cancel an image
	// decode. The loaded array changes only when a document is loaded/setData.
	const slideId = computed(() => host.activeSlide()?.id);
	const canvasWidth = computed(() => loader.canvasSize().width);
	const canvasHeight = computed(() => loader.canvasSize().height);
	const enabled = computed(
		() => host.canEdit() && !loader.loading() && !loader.error() && !host.blocked(),
	);
	let bindingContext: readonly unknown[] | undefined;
	let dispose = () => {};
	inject(DestroyRef).onDestroy(() => dispose());
	effect(() => {
		const main = host.mainElement();
		const root = host.rootElement();
		const documentId = loader.slides();
		const activeSlideId = slideId();
		const width = canvasWidth();
		const height = canvasHeight();
		const canPaste = enabled();
		const context = [root, main, documentId, activeSlideId, width, height];
		// Enabling can be flushed after a click-away paste has already started.
		// Keep that valid decode; only invalidation or a new destination rebinds.
		if (canPaste && bindingContext?.every((value, index) => value === context[index])) {
			return;
		}
		dispose();
		dispose = () => {};
		bindingContext = context;
		if (!root) {
			return;
		}
		const getTarget = (): EditorImagePasteTarget | null =>
			enabled() &&
			activeSlideId &&
			host.rootElement() === root &&
			host.mainElement() === main &&
			loader.slides() === documentId &&
			slideId() === activeSlideId &&
			canvasWidth() === width &&
			canvasHeight() === height
				? { documentId, slideId: activeSlideId, canvasSize: { width, height } }
				: null;
		dispose = attachEditorImagePaste(root, {
			getCanvas: () => main?.querySelector<HTMLElement>('.pptx-ng-canvas-stage') ?? null,
			getTarget,
			insertElement: (element) => {
				if (getTarget()) {
					editor.addElement(host.activeSlideIndex(), element);
				}
			},
		});
	});
}
