import { attachEditorImagePaste } from 'pptx-viewer-shared';
import type { EditorImagePasteOptions } from 'pptx-viewer-shared';
import { untrack } from 'svelte';

/** Scalar dependencies keep ordinary element edits from cancelling an image decode. */
export function useCanvasImagePaste(
	getRoot: () => HTMLElement | null,
	options: EditorImagePasteOptions,
): void {
	const documentId = $derived(options.getTarget()?.documentId);
	const slideId = $derived(options.getTarget()?.slideId);
	const width = $derived(options.getTarget()?.canvasSize.width);
	const height = $derived(options.getTarget()?.canvasSize.height);
	$effect(() => {
		const root = getRoot();
		// Reading these invalidates the listener on load, navigation or permission changes.
		void [documentId, slideId, width, height];
		if (root) {
			return untrack(() => attachEditorImagePaste(root, options));
		}
	});
}
