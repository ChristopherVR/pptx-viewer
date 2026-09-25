import type { MergeShapeOperation, PptxElement } from 'pptx-viewer-core';
import { applyMergeShapesPlan, planMergeShapes } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import { getActiveElements, replaceActiveElements } from './editor-active-elements';
import type { EditorOps } from './editor-operations';

/** Shape Format > Merge Shapes (Union / Combine / Fragment / Intersect / Subtract). */
export interface MergeActions {
	mergeShapes(operation: MergeShapeOperation): void;
}

export interface MergeActionsDeps {
	store: Store<ViewerState>;
	ops: EditorOps;
}

/**
 * The selection in SELECTION order (first-selected first): the shared planner
 * keeps the first shape's formatting, so the order is load-bearing and must not
 * be the slide's paint order.
 */
function selectedInSelectionOrder(state: ViewerState): PptxElement[] {
	const byId = new Map(getActiveElements(state).map((element) => [element.id, element]));
	return state.selectedElementIds
		.map((id) => byId.get(id))
		.filter((element): element is PptxElement => element !== undefined);
}

/**
 * Merge Shapes over the current selection as ONE undoable step. The geometry
 * and the slide rewrite are the shared `planMergeShapes` /
 * `applyMergeShapesPlan`; this only snapshots history and selects the result.
 */
export function createMergeActions(deps: MergeActionsDeps): MergeActions {
	const { store, ops } = deps;
	return {
		mergeShapes(operation) {
			const state = store.get();
			if (!state.editable) {
				return;
			}
			const plan = planMergeShapes(operation, selectedInSelectionOrder(state));
			if (!plan) {
				return;
			}
			const createdIds = plan.created.map((element) => element.id);
			ops.pushHistory();
			store.set({
				...replaceActiveElements(state, applyMergeShapesPlan(getActiveElements(state), plan)),
				selectedElementId: createdIds.at(-1) ?? null,
				selectedElementIds: createdIds,
			});
			ops.commitChange();
		},
	};
}
