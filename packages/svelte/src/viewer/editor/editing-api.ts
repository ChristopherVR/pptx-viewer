import type { PptxSaveFormat } from 'pptx-viewer-core';
import { downloadBlob, savedPresentationFileName } from 'pptx-viewer-shared';

import type { EditorState } from './editor-state.svelte';

const PRESENTATION_MIME: Record<PptxSaveFormat, string> = {
	pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
	pptm: 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
};

/** The imperative editing API exposed on the `PowerPointViewer` instance. */
export interface EditingApi {
	undo(): void;
	redo(): void;
	canUndo(): boolean;
	canRedo(): boolean;
	deleteSelected(): void;
	getSelectedElementId(): string | null;
	save(format?: PptxSaveFormat): Promise<Uint8Array>;
	downloadAs(format: PptxSaveFormat, fileName?: string): Promise<void>;
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
		save: (format) => editor.save(format),
		// Every name below goes through the shared save-name decision, so a host
		// that passes the deck it opened (`report.ppt`) gets `report.pptx` back
		// rather than a `.ppt` whose bytes are an OpenXML package.
		downloadAs: async (format, fileName) => {
			const bytes = await editor.save(format);
			downloadBlob(
				new Blob([bytes as unknown as BlobPart], { type: PRESENTATION_MIME[format] }),
				savedPresentationFileName(fileName, format),
			);
		},
		downloadPptx: async (fileName) => {
			const bytes = await editor.save('pptx');
			downloadBlob(
				new Blob([bytes as unknown as BlobPart], { type: PRESENTATION_MIME.pptx }),
				savedPresentationFileName(fileName),
			);
		},
	};
}
