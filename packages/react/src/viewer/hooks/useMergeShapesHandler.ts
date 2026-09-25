/**
 * useMergeShapesHandler: PowerPoint's Shape Format > Merge Shapes (Union,
 * Combine, Fragment, Intersect, Subtract).
 *
 * A thin wrapper over the shared planner: `pptx-viewer-shared` decides which
 * selections can merge, what the result looks like and where it lands in the
 * z-order, so the five bindings cannot drift. This hook only applies the plan
 * to React state as ONE slide update (one undo step) and selects the result.
 */
import type { MergeShapeOperation, PptxElement, PptxSlide } from 'pptx-viewer-core';
import {
	applyMergeShapesPlan,
	canMergeShapes as canMergeSelection,
	planMergeShapes,
} from 'pptx-viewer-shared';

import type { EditorHistoryResult } from './useEditorHistory';
import type { ElementOperations } from './useElementOperations';

/** Input for the merge shapes handler. */
export interface MergeShapesHandlerInput {
	activeSlide: PptxSlide | undefined;
	activeSlideIndex: number;
	/** The selection in SELECTION order: the first entry's formatting survives. */
	selectedElements: PptxElement[];
	effectiveSelectedIds: string[];
	setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
	ops: ElementOperations;
	history: EditorHistoryResult;
}

/** Handlers returned by the merge shapes hook. */
export interface MergeShapesHandlers {
	handleMergeShapes: (operation: MergeShapeOperation) => void;
	canMergeShapes: boolean;
}

export function useMergeShapesHandler(input: MergeShapesHandlerInput): MergeShapesHandlers {
	const { activeSlide, activeSlideIndex, selectedElements, ops, history } = input;
	const canMergeShapes = canMergeSelection(selectedElements);

	const handleMergeShapes = (operation: MergeShapeOperation) => {
		if (!activeSlide) {
			return;
		}
		const plan = planMergeShapes(operation, selectedElements);
		if (!plan) {
			return;
		}
		// Only slide-level shapes merge: a layout/master element selected in
		// template mode is not in `slide.elements`, and applying the plan there
		// would drop the other sources without inserting the result.
		const onSlide = new Set(activeSlide.elements.map((el) => el.id));
		if (!plan.removedIds.every((id) => onSlide.has(id))) {
			return;
		}
		ops.updateSlides((prev) =>
			prev.map((slide, i) =>
				i === activeSlideIndex
					? { ...slide, elements: applyMergeShapesPlan(slide.elements, plan) }
					: slide,
			),
		);
		const createdIds = plan.created.map((el) => el.id);
		ops.applySelection(createdIds[0] ?? null, createdIds.length > 1 ? createdIds : []);
		history.markDirty();
	};

	return { handleMergeShapes, canMergeShapes };
}
