/**
 * merge-shapes-action.ts: the Angular binding's Merge Shapes handler, shared by
 * the Home > Arrange ribbon dropdown and the canvas context menu.
 *
 * The geometry and the slide rewrite are the shared `render/merge-shapes`
 * module's (`planMergeShapes` / `applyMergeShapesPlan`); this only feeds it the
 * selection IN SELECTION ORDER (the first-selected shape's formatting
 * survives, as in PowerPoint), commits the result as one undoable slide
 * update, and selects the new shape(s).
 *
 * @module angular-viewer/merge-shapes-action
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import { applyMergeShapesPlan, canMergeShapes, planMergeShapes } from '../internal/shared';
import type { MergeShapeOperation } from '../internal/shared';

/** The subset of {@link EditorStateService} a merge needs. */
export interface MergeShapesEditor {
	slides(): readonly PptxSlide[];
	selectedIds(): readonly string[];
	applyReplacement(slides: readonly PptxSlide[], label?: string): void;
	select(ids: readonly string[]): void;
}

/** The selected elements of `slide`, in the order they were selected. */
export function selectedElementsInOrder(
	slide: PptxSlide | undefined,
	ids: readonly string[],
): PptxElement[] {
	if (!slide) {
		return [];
	}
	return ids
		.map((id) => slide.elements.find((el) => el.id === id))
		.filter((el): el is PptxElement => el !== undefined);
}

/** Whether Merge Shapes is available for the current selection on `slideIndex`. */
export function canMergeSelection(editor: MergeShapesEditor, slideIndex: number): boolean {
	return canMergeShapes(selectedElementsInOrder(editor.slides()[slideIndex], editor.selectedIds()));
}

/**
 * Run `operation` over the selection on `slideIndex` as ONE undoable update.
 * Returns false (and changes nothing) when the selection cannot be merged or
 * the result is empty.
 */
export function runMergeShapes(
	editor: MergeShapesEditor,
	slideIndex: number,
	operation: MergeShapeOperation,
	label?: string,
): boolean {
	const slides = editor.slides();
	const slide = slides[slideIndex];
	const plan = planMergeShapes(operation, selectedElementsInOrder(slide, editor.selectedIds()));
	if (!slide || !plan) {
		return false;
	}
	editor.applyReplacement(
		slides.map((s, i) =>
			i === slideIndex ? { ...s, elements: applyMergeShapesPlan(s.elements, plan) } : s,
		),
		label,
	);
	editor.select(plan.created.map((el) => el.id));
	return true;
}
