/**
 * The table-specific element context-menu entries (row / column / merge /
 * split), split out of `useContextMenu.ts` to keep that composable within the
 * file-size budget. Each result is written through `ops.updateElement`, so
 * every entry is one undo step.
 */
import type { PptxElement, PptxTableData, TablePptxElement } from 'pptx-viewer-core';

import {
	applyDeleteColumn,
	applyDeleteRow,
	applyInsertColumn,
	applyInsertRow,
	applyMergeDown,
	applyMergeRight,
	applyMergeSelected,
	applySplitCell,
} from './table-mutations';
import type { TableSelectionState } from './table-selection';
import type { EditorOperations } from './useEditorOperations';

/** The right-clicked table plus the cell selection inside it. */
export interface ContextTableTarget {
	el: TablePptxElement;
	sel: TableSelectionState;
}

/** Run a `table-*` context-menu action; a no-op for any other id. */
export function runContextTableAction(
	actionId: string,
	tbl: ContextTableTarget | null,
	ops: EditorOperations,
): void {
	const td = tbl?.el.tableData;
	if (!tbl || !td) {
		return;
	}
	const applyData = (next: PptxTableData | null): void => {
		if (next) {
			ops.updateElement(tbl.el.id, { tableData: next } as Partial<PptxElement>);
		}
	};
	const applyElement = (next: TablePptxElement | null): void => {
		if (next && next !== tbl.el) {
			ops.updateElement(tbl.el.id, {
				tableData: next.tableData,
				rawXml: next.rawXml,
			} as Partial<PptxElement>);
		}
	};
	const { rowIndex, columnIndex } = tbl.sel;
	switch (actionId) {
		case 'table-insert-row-above':
			applyElement(applyInsertRow(tbl.el, rowIndex, 'above'));
			break;
		case 'table-insert-row-below':
			applyElement(applyInsertRow(tbl.el, rowIndex, 'below'));
			break;
		case 'table-delete-row':
			applyElement(applyDeleteRow(tbl.el, rowIndex));
			break;
		case 'table-insert-col-left':
			applyElement(applyInsertColumn(tbl.el, columnIndex, 'left'));
			break;
		case 'table-insert-col-right':
			applyElement(applyInsertColumn(tbl.el, columnIndex, 'right'));
			break;
		case 'table-delete-col':
			applyElement(applyDeleteColumn(tbl.el, columnIndex));
			break;
		case 'table-merge-right':
			applyData(applyMergeRight(td, rowIndex, columnIndex));
			break;
		case 'table-merge-down':
			applyData(applyMergeDown(td, rowIndex, columnIndex));
			break;
		case 'table-merge-selected':
			applyData(applyMergeSelected(td, tbl.sel.selectedCells));
			break;
		case 'table-split':
			applyData(applySplitCell(td, rowIndex, columnIndex));
			break;
	}
}
