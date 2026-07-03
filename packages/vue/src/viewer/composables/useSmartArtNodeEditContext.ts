import { updateSmartArtNodeText } from 'pptx-viewer-core';
import type { PptxElement, PptxSmartArtData } from 'pptx-viewer-core';
import { rebuildDrawingShapesIfCleared, resolvePalette } from 'pptx-viewer-shared';
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
 *
 * Both commit paths reflow `drawingShapes` back from the layout engine when
 * the edit op clears them (every text/style edit does) via
 * `rebuildDrawingShapesIfCleared` -- otherwise the renderer falls back to the
 * generic SVG layout for every node (not just the edited one) the moment any
 * single node is edited.
 */
export function useSmartArtNodeEditContext(input: UseSmartArtNodeEditContextInput): void {
	const { canEdit, findActiveElement, updateElement, canEditInline } = input;

	function reflow(el: PptxElement, data: PptxSmartArtData): PptxSmartArtData {
		return rebuildDrawingShapesIfCleared(
			data,
			data.layout,
			resolvePalette(data),
			data.style ?? 'flat',
			el.id,
			{ width: el.width, height: el.height },
		);
	}

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
				smartArtData: reflow(el, updateSmartArtNodeText(data, nodeId, text)),
			} as Partial<PptxElement>);
		},
		commitStyle: (elementId: string, patch: Partial<PptxElement>): void => {
			if (!canEdit()) {
				return;
			}
			const el = findActiveElement(elementId);
			const next = (patch as { smartArtData?: PptxSmartArtData }).smartArtData;
			if (el && el.type === 'smartArt' && next) {
				updateElement(elementId, { ...patch, smartArtData: reflow(el, next) });
				return;
			}
			updateElement(elementId, patch);
		},
	});
}
