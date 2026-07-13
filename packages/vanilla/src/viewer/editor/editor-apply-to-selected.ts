import type { PptxElement } from 'pptx-viewer-core';

import type { Store, ViewerState } from '../state';
import { getActiveElements, replaceActiveElements } from './editor-active-elements';
import type { EditorOps } from './editor-operations';

/**
 * Shared "apply a formatting patch to the selected element, history-integrated"
 * helper used by every action-composer file (`editor-text-actions.ts`,
 * `editor-arrange-actions.ts`, ...). Extracted from `editor-edit-ops.ts` so
 * each action file can build its own small, focused handler set without
 * duplicating the push-history / no-op-guard boilerplate.
 */
export type ApplyToSelected = (build: (el: PptxElement) => Partial<PptxElement>) => void;

export function createApplyToSelected(store: Store<ViewerState>, ops: EditorOps): ApplyToSelected {
	return (build) => {
		const state = store.get();
		const id = state.selectedElementId;
		const el = ops.selectedElement(state);
		if (!state.editable || !id || !el) {
			return;
		}
		const patch = build(el);
		if (Object.keys(patch).length === 0) {
			return;
		}
		ops.pushHistory();
		store.set(
			replaceActiveElements(
				state,
				getActiveElements(state).map((element) =>
					element.id === id ? ({ ...element, ...patch } as PptxElement) : element,
				),
			),
		);
		ops.commitChange();
	};
}
