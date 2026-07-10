import { downloadBlob } from 'pptx-viewer-shared';

import type { EditorState } from './editor-state.svelte';

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

/** The imperative editing API exposed on the `PowerPointViewer` instance. */
export interface EditingApi {
	undo(): void;
	redo(): void;
	canUndo(): boolean;
	canRedo(): boolean;
	deleteSelected(): void;
	getSelectedElementId(): string | null;
	save(): Promise<Uint8Array>;
	downloadPptx(fileName?: string): Promise<void>;
}

/**
 * Build the imperative editing API bound to a live `EditorState`. Extracted
 * from `PowerPointViewer.svelte` so the component only re-exports thin,
 * one-line bindings (Svelte requires the component's own `export`s for its
 * instance API, but the bodies can live elsewhere).
 */
export function createEditingApi(editor: EditorState): EditingApi {
	return {
		undo: () => editor.undo(),
		redo: () => editor.redo(),
		canUndo: () => editor.canUndo,
		canRedo: () => editor.canRedo,
		deleteSelected: () => editor.deleteSelected(),
		getSelectedElementId: () => editor.selectedElementId,
		save: () => editor.save(),
		downloadPptx: async (fileName = 'presentation.pptx') => {
			const bytes = await editor.save();
			downloadBlob(new Blob([bytes as unknown as BlobPart], { type: PPTX_MIME }), fileName);
		},
	};
}
