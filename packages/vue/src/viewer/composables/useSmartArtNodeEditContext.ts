import { updateSmartArtNodeText } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';
import { provide } from 'vue';

import { SmartArtNodeEditKey } from './smartart-node-edit';

export interface UseSmartArtNodeEditContextInput {
	/** Plain "editing enabled" flag; both the text-commit and style-commit gates use it. */
	canEdit: () => boolean;
	findActiveElement: (id: string) => PptxElement | undefined;
	/** Wraps `ops.updateElement`; a plain function so this composable can be called before `ops` exists. */
	updateElement: (id: string, patch: Partial<PptxElement>) => void;
	/** Whether inline node editing is currently allowed (edit mode + not presenting). */
	canEditInline: () => boolean;
}

/**
 * useSmartArtNodeEditContext: provides the inline SmartArt node-text and
 * per-node fill editing context (`SmartArtNodeEditKey`, injected by
 * `SmartArtRenderer`), routing every commit through the same
 * history-tracked `updateElement` op the inspector uses. Mirrors the
 * `TableCellEditKey` pattern in `useTableCellEditingContext`. Extracted
 * verbatim from `PowerPointViewer.vue`.
 */
export function useSmartArtNodeEditContext(input: UseSmartArtNodeEditContextInput): void {
	const { canEdit, findActiveElement, updateElement, canEditInline } = input;

	provide(SmartArtNodeEditKey, {
		canEdit: canEditInline,
		commit: (elementId: string, nodeId: string, text: string): void => {
			if (!canEdit()) {
				return;
			}
			const el = findActiveElement(elementId);
			if (!el || el.type !== 'smartArt') {
				return;
			}
			const data = el.smartArtData;
			if (!data) {
				return;
			}
			updateElement(elementId, {
				smartArtData: updateSmartArtNodeText(data, nodeId, text),
			} as Partial<PptxElement>);
		},
		commitStyle: (elementId: string, patch: Partial<PptxElement>): void => {
			if (!canEdit()) {
				return;
			}
			updateElement(elementId, patch);
		},
	});
}
