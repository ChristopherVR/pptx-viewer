/**
 * editor-context-menu-context.ts: what the canvas menu is being opened ON.
 *
 * `buildContextMenuEntries` needs a small, framework-free description of the
 * right-click target (element type, cell state, selection size). Deriving that
 * from Angular signals is one line each; the part worth isolating (and testing)
 * is the CELL state, because the menu got it wrong before: Merge Right, Merge
 * Down and Split Cell were all rendered unconditionally, so a cell that already
 * spanned still offered to merge again and an unmerged one still offered to
 * split. PowerPoint offers exactly one of the three states.
 *
 * @module angular-viewer/editor-context-menu-context
 */

import type { TablePptxElement } from 'pptx-viewer-core';

import type { ContextMenuTableContext } from '../internal/shared';
import type { TableCellSelection } from './table-selection.service';

/**
 * Whether the cell at `(row, column)` already spans, and so can be split rather
 * than merged. A span of 1 (or an absent span) is a plain cell.
 */
export function isMergedTableCell(element: TablePptxElement, row: number, column: number): boolean {
	const cell = element.tableData?.rows?.[row]?.cells?.[column];
	if (!cell) {
		return false;
	}
	return (cell.gridSpan ?? 1) > 1 || (cell.rowSpan ?? 1) > 1;
}

/** The shared menu's view of the selected cell. */
export function tableMenuContext(
	element: TablePptxElement,
	selection: TableCellSelection,
): ContextMenuTableContext {
	return {
		hasMultiCellSelection: (selection.selectedCells?.length ?? 0) >= 2,
		isMergedCell: isMergedTableCell(element, selection.rowIndex, selection.columnIndex),
	};
}
