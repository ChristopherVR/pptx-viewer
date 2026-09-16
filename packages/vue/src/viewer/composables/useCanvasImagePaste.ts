import { attachEditorImagePaste } from 'pptx-viewer-shared';
import type { EditorImagePasteOptions } from 'pptx-viewer-shared';
import type { Ref } from 'vue';
import { watch } from 'vue';

/** Rebind on destination/permission changes, aborting even an away-and-back navigation. */
export function useCanvasImagePaste(
	root: Ref<HTMLElement | null>,
	options: EditorImagePasteOptions,
): void {
	watch(
		[
			root,
			() => options.getTarget()?.documentId,
			() => options.getTarget()?.slideId,
			() => options.getTarget()?.canvasSize.width,
			() => options.getTarget()?.canvasSize.height,
		],
		(_next, _previous, onCleanup) => {
			if (root.value) {
				onCleanup(attachEditorImagePaste(root.value, options));
			}
		},
		{ immediate: true, flush: 'sync' },
	);
}
