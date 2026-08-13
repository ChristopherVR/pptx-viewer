import type { PptxElement } from 'pptx-viewer-core';
import type { ShapeAdjustmentHandleDescriptor } from 'pptx-viewer-shared';
import { canInteractWithElement, getShapeAdjustmentHandleDescriptor } from 'pptx-viewer-shared';

/**
 * What the selection overlay is allowed to offer, given the authored
 * `a:spLocks` on the selected element(s).
 *
 * The lock composition itself is NOT decided here: `canInteractWithElement` in
 * `pptx-viewer-shared` is the one decision function all five bindings consult,
 * and this module only folds its per-element verdict into the collective one an
 * overlay drawn around N elements needs. Keeping it in a plain `.ts` module
 * (rather than inside `EditorController` or the overlay SFC) keeps both of
 * those within the repo's file-size budget and makes the rule unit-testable
 * without a component mount.
 *
 * @module editor/editor-selection-interactivity
 */

/** The chrome the overlay may draw for the current selection. */
export interface SelectionInteractivity {
	/** Draw (and honour) the eight resize handles. */
	resizable: boolean;
	/** Draw (and honour) the rotate stem + knob. */
	rotatable: boolean;
	/** The amber adjustment diamond, or null when there is none to draw. */
	adjust: ShapeAdjustmentHandleDescriptor | null;
}

/** Nothing selected: no handles, no knob, no diamond. */
const NO_SELECTION: SelectionInteractivity = { resizable: false, rotatable: false, adjust: null };

/**
 * What an unlocked, non-adjustable selection resolves to. The overlay's prop
 * default, so a caller that does not pass a verdict gets the pre-lock chrome.
 */
export const DEFAULT_SELECTION_INTERACTIVITY: SelectionInteractivity = {
	resizable: true,
	rotatable: true,
	adjust: null,
};

/**
 * The collective verdict for `elements`.
 *
 * A collective box takes the STRICTEST member: one pinned shape in a
 * rubber-banded pair is enough to withdraw the resize handles, because a
 * collective resize would otherwise silently skip it and distort the group.
 * The adjustment diamond belongs to a single shape's own `a:avLst`, so it is
 * only ever offered for a selection of one.
 */
export function selectionInteractivity(elements: readonly PptxElement[]): SelectionInteractivity {
	if (elements.length === 0) {
		return NO_SELECTION;
	}
	return {
		resizable: elements.every((element) => canInteractWithElement(element, 'resize')),
		rotatable: elements.every((element) => canInteractWithElement(element, 'rotate')),
		adjust: elements.length === 1 ? getShapeAdjustmentHandleDescriptor(elements[0]) : null,
	};
}

/** May a pointer-down on `element` arm a move gesture? */
export function canMoveElement(element: PptxElement | undefined): boolean {
	return canInteractWithElement(element, 'move');
}
