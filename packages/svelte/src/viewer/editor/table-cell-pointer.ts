import { readTableCellTarget } from './context-menu-dispatch';
import type { EditorState } from './editor-state.svelte';

/**
 * What a stage pointer-down means for the table cell range.
 *
 * Lives beside the selection model rather than inside `TableView.svelte` so the
 * SFC stays presentation-only (it renders the highlight, it does not decide it)
 * and so the rule is unit-testable without mounting a component. The cell
 * coordinates are read back off the `data-cell-row` / `data-cell-col`
 * attributes `TableView` already stamps, which is also how the context menu
 * finds its target: merge-absorbed cells are not rendered, so a cell's DOM
 * position is not its model position and the attributes are the only truth.
 *
 * @module editor/table-cell-pointer
 */

/**
 * Fold a pointer-down over `elementId` into the cell range.
 *
 * Returns true when the event was CONSUMED, i.e. a Shift-click that stretched
 * an existing range. The caller must then stop: letting it fall through would
 * hit the stage's Shift branch and toggle the table out of the element
 * selection, which is the opposite of extending a range inside it.
 */
export function applyTableCellPointer(
	editor: EditorState,
	elementId: string,
	target: EventTarget | null,
	shiftKey: boolean,
): boolean {
	const cell = readTableCellTarget(target);
	const element = editor.elementById(elementId);
	if (!cell || element?.type !== 'table' || !element.tableData) {
		// Any click that is not inside a table cell abandons the range; a
		// selection the user can no longer see must not keep arming Merge Cells.
		editor.tableCells.clear();
		return false;
	}
	if (shiftKey && editor.selection.has(elementId) && editor.tableCells.elementId === elementId) {
		editor.tableCells.extend(elementId, cell, element.tableData);
		return true;
	}
	editor.tableCells.begin(elementId, cell, element.tableData);
	return false;
}
