/**
 * table-cell-pointer.ts — what a press on the slide canvas means for a table's
 * CELL range, as opposed to the slide's ELEMENT selection.
 *
 * Both selections are driven by the same `pointerdown`, and every binding has to
 * arbitrate between them. Getting it wrong is invisible until the user tries to
 * merge: a Shift-click that falls through to the element-level additive branch
 * TOGGLES the table out of the slide selection, and a binding that clears its
 * cell range whenever the owning element is deselected then throws away the very
 * anchor the range is measured from. That is exactly what Vue did, so
 * `computeCellSelection` - which is correct - was always handed a null previous
 * selection and could only ever return a single cell. The context menu offered
 * "merge right / merge down" where React offered "merge selected cells", and no
 * unit test could see it because the defect was in the gesture, not the maths.
 *
 * The rule is therefore stated once, here, as a pure decision function, and each
 * binding only has to obey the returned intent.
 *
 * @module render/table-cell-pointer
 */

/** What a canvas press should do to the table cell range. */
export type TableCellPointerIntent =
	/**
	 * Stretch the existing range to the pressed cell. The caller MUST also
	 * consume the event (stop it reaching the element-level Shift toggle).
	 */
	| 'extend'
	/** (Re)anchor the range on the pressed cell, then handle the press normally. */
	| 'anchor'
	/**
	 * The press was not inside a table cell: drop any range, so a selection the
	 * user can no longer see stops arming Merge Cells, then handle it normally.
	 */
	| 'clear';

/** The facts a binding can always establish about a canvas press. */
export interface TableCellPointerInput {
	/** True when the press landed inside a `<td>` of a table element. */
	isTableCell: boolean;
	/** Whether the Shift modifier was held. */
	shiftKey: boolean;
	/** Whether the pressed table is already in the slide's element selection. */
	elementSelected: boolean;
	/** Whether the current cell range belongs to this same table element. */
	rangeOnSameElement: boolean;
}

/**
 * Decide what a canvas press means for the cell range.
 *
 * A Shift-click only extends when there is something to extend FROM: the table
 * must already be selected and must already own the range. Anything else
 * anchors, so a Shift-click is never a silent no-op.
 */
export function tableCellPointerIntent(input: TableCellPointerInput): TableCellPointerIntent {
	if (!input.isTableCell) {
		return 'clear';
	}
	if (input.shiftKey && input.elementSelected && input.rangeOnSameElement) {
		return 'extend';
	}
	return 'anchor';
}
