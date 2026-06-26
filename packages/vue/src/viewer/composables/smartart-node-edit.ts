import type { PptxElement } from 'pptx-viewer-core';
import type { InjectionKey } from 'vue';
import { inject } from 'vue';

/**
 * Inline SmartArt node-text editing context, provided once at the viewer root
 * and injected by `SmartArtRenderer` so the hot `SlideStage` ->
 * `ElementRenderer` prop chain does not have to thread an `editable` flag and a
 * commit callback through every element. This mirrors the `TableCellEditKey`
 * pattern in `table-edit`, and routes every commit through the SAME
 * history-tracked editor op the inspector uses (`updateSmartArtNodeText` via
 * `useEditorOperations.updateElement`), so undo/redo and save round-trip work
 * identically for on-canvas edits and inspector edits.
 */
export interface SmartArtNodeEditContext {
	/** Whether inline node editing is currently allowed (edit mode + not presenting). */
	canEdit: () => boolean;
	/**
	 * Commit a single node's new text. The handler resolves the SmartArt element
	 * by id, applies the immutable `updateSmartArtNodeText` op, and records the
	 * change through the history-tracked editor op.
	 */
	commit: (elementId: string, nodeId: string, text: string) => void;
	/**
	 * Commit a per-node style patch (e.g. fill colour) via `updateElement`.
	 * Optional; absent in read-only viewers.
	 */
	commitStyle?: (elementId: string, patch: Partial<PptxElement>) => void;
}

/** Typed injection key for the SmartArt node-edit context. */
export const SmartArtNodeEditKey: InjectionKey<SmartArtNodeEditContext> = Symbol(
	'pptx-vue-smartart-node-edit',
);

/**
 * Resolve the injected {@link SmartArtNodeEditContext}, if any. Returns
 * `undefined` when no editing context is provided (read-only viewer), in which
 * case the renderer draws without inline node editing.
 */
export function injectSmartArtNodeEdit(): SmartArtNodeEditContext | undefined {
	return inject(SmartArtNodeEditKey, undefined);
}
