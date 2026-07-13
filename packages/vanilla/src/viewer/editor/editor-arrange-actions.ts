import type { PptxElement } from 'pptx-viewer-core';
import type { AlignEdge } from 'pptx-viewer-shared';
import {
	bringForward,
	bringToFront,
	generateElementId,
	makeCloneId,
	sendBackward,
	sendToBack,
} from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import { getActiveElements, replaceActiveElements } from './editor-active-elements';
import type { ApplyToSelected } from './editor-apply-to-selected';
import {
	alignSelection,
	alignToCanvas,
	distributeSelection,
	flipElement,
	groupSelection,
	ungroupSelection,
} from './editor-arrange-mutations';
import type { EditorOps } from './editor-operations';

/**
 * Z-order, align, flip, and group/ungroup actions for the ribbon's
 * Home > Arrange group.
 *
 * Align/distribute: the vanilla editor's selection model is single-element
 * only (see `state/viewer-state.ts`), so `alignElements` reaches the
 * single-selection "align to slide" mode ({@link alignToCanvas}), matching
 * PowerPoint's own behaviour when nothing else is selected. Multi-selection
 * "align to selection bounding box" / distribute (needing >= 2 / >= 3
 * elements, see `editor-arrange-mutations.ts`) is unreachable until a
 * multi-select model lands; `canDistribute` is therefore always `false` today
 * (see `editing-chrome-sync.ts`), a documented limitation rather than a bug.
 *
 * Group: needs >= 2 selected elements to be meaningful, so it too is
 * unreachable under single selection; `groupSelected` is a deliberate no-op
 * kept only so the ribbon button (permanently disabled, with an explanatory
 * title) has something to call. Ungroup works today: it applies to whichever
 * single `group` element is selected.
 */
export interface ArrangeActions {
	bringForward(): void;
	sendBackward(): void;
	bringToFront(): void;
	sendToBack(): void;
	alignElements(edge: AlignEdge): void;
	distributeElements(axis: 'horizontal' | 'vertical'): void;
	flipHorizontal(): void;
	flipVertical(): void;
	groupSelected(): void;
	ungroupSelected(): void;
}

export interface ArrangeActionsDeps {
	store: Store<ViewerState>;
	ops: EditorOps;
	applyToSelected: ApplyToSelected;
}

export function createArrangeActions(deps: ArrangeActionsDeps): ArrangeActions {
	const { store, ops, applyToSelected } = deps;

	const reorder = (transform: (els: readonly PptxElement[], id: string) => PptxElement[]): void => {
		const state = store.get();
		const id = state.selectedElementId;
		const elements = getActiveElements(state);
		if (!state.editable || !id || !elements) {
			return;
		}
		if (transform(elements, id) === elements) {
			return;
		}
		ops.pushHistory();
		store.set(replaceActiveElements(state, transform(elements, id)));
		ops.commitChange();
	};

	return {
		bringForward: () => reorder(bringForward),
		sendBackward: () => reorder(sendBackward),
		bringToFront: () => reorder(bringToFront),
		sendToBack: () => reorder(sendToBack),

		alignElements(edge) {
			const state = store.get();
			if (state.selectedElementIds.length < 2) {
				applyToSelected((el) => alignToCanvas(el, edge, state.canvasSize));
				return;
			}
			ops.pushHistory();
			store.set(
				replaceActiveElements(
					state,
					alignSelection(getActiveElements(state), state.selectedElementIds, edge),
				),
			);
			ops.commitChange();
		},

		distributeElements(axis) {
			const state = store.get();
			if (!state.editable || state.selectedElementIds.length < 3) {
				return;
			}
			ops.pushHistory();
			store.set(
				replaceActiveElements(
					state,
					distributeSelection(getActiveElements(state), state.selectedElementIds, axis),
				),
			);
			ops.commitChange();
		},

		flipHorizontal: () => applyToSelected((el) => flipElement(el, 'horizontal')),
		flipVertical: () => applyToSelected((el) => flipElement(el, 'vertical')),

		groupSelected() {
			const state = store.get();
			if (!state.editable || state.selectedElementIds.length < 2) {
				return;
			}
			const result = groupSelection(
				getActiveElements(state),
				state.selectedElementIds,
				state.editTemplateMode
					? makeCloneId(true, state.selectedElementIds[0])
					: generateElementId(),
			);
			if (!result.groupId) {
				return;
			}
			ops.pushHistory();
			store.set({
				...replaceActiveElements(state, result.elements),
				selectedElementId: result.groupId,
				selectedElementIds: [result.groupId],
			});
			ops.commitChange();
		},

		ungroupSelected() {
			const state = store.get();
			const id = state.selectedElementId;
			const elements = getActiveElements(state);
			const el = ops.selectedElement(state);
			if (!state.editable || !id || !elements || !el || el.type !== 'group') {
				return;
			}
			const childIds = el.children.map((child) =>
				state.editTemplateMode ? makeCloneId(true, child.id || el.id) : generateElementId(),
			);
			const result = ungroupSelection(elements, id, childIds);
			if (result.childIds.length === 0) {
				return;
			}
			ops.pushHistory();
			store.set({
				...replaceActiveElements(state, result.elements),
				selectedElementId: result.childIds.at(-1) ?? null,
				selectedElementIds: result.childIds,
			});
			ops.commitChange();
		},
	};
}
